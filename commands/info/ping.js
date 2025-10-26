const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const packageJson = require('../../package.json');
const stringUtils = require('../../utils/string');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Kiểm tra độ trễ và trạng thái kết nối của bot'),

	async execute(interaction) {
		const sent = await interaction.deferReply({ fetchReply: true });
		const pingLatency = ((sent.createdTimestamp - interaction.createdTimestamp) / 100).toFixed(2);

		const initialEmbed = createStatusEmbed({
			ping: pingLatency,
			ws: interaction.client.ws.ping,
		});
		const response = await interaction.editReply({
			embeds: [initialEmbed],
			components: [createActionRow(false)]
		});


		const updatedEmbed = createStatusEmbed({
			ping: pingLatency,
			ws: interaction.client.ws.ping,
		});

		await interaction.editReply({
			embeds: [updatedEmbed],
			components: [createActionRow(true)]
		});

		const collector = response.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 60000
		});

		collector.on('collect', async (i) => {
			if (i.user.id !== interaction.user.id) {
				return i.reply({
					content: 'Chỉ người dùng lệnh mới có thể sử dụng các nút này.',
					ephemeral: true
				});
			}

			if (i.customId === 'refresh_status') {
				await i.update({
					embeds: [createStatusEmbed({
						ping: pingLatency,
						ws: interaction.client.ws.ping
					})],
					components: [createActionRow(false)]
				});

				const newPingLatency = ((Date.now() - i.createdTimestamp) / 100).toFixed(2);

				await i.editReply({
					embeds: [createStatusEmbed({
						ping: newPingLatency,
						ws: interaction.client.ws.ping,
					})],
					components: [createActionRow(true)]
				});
			} else if (i.customId === 'detailed_info') {
				const detailedEmbed = new EmbedBuilder()
					.setColor(0x9B59B6)
					.setTitle('📈 Thông tin chi tiết')
					.addFields(
						{ name: '🤖 Phiên bản Bot', value: `\`${packageJson.version}\``, inline: true },
						{ name: '📚 Discord.js', value: `\`${packageJson.dependencies['discord.js'].replace('^', '')}\``, inline: true },
						{ name: '📦 Node.js', value: `\`${process.version}\``, inline: true },
						{ name: '🔄 Thời gian hoạt động', value: `\`${stringUtils.formatUptime(process.uptime())}\``, inline: false },
						{ name: '💾 Sử dụng bộ nhớ', value: `\`${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\``, inline: true },
						{ name: '💻 Hệ điều hành', value: `\`${process.platform} ${process.arch}\``, inline: true },
						{ name: '🧵 Số lượng shards', value: `\`${interaction.client.shard ? interaction.client.shard.count : 1}\``, inline: true }
					)
					.setFooter({ text: 'Luna AI • Developed by s4ory' })
					.setTimestamp();

				await i.reply({
					embeds: [detailedEmbed],
					ephemeral: true
				});
			}
		});

		collector.on('end', () => {
			const disabledRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('refresh_status')
					.setLabel('Làm mới')
					.setEmoji('🔄')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId('detailed_info')
					.setLabel('Thông tin chi tiết')
					.setEmoji('ℹ️')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(true)
			);

			interaction.editReply({ components: [disabledRow] }).catch(() => { });
		});
	},
};

function createStatusEmbed({ ping, ws }) {
	let statusColor;
	if (ping < 200) statusColor = 0x57F287;
	else if (ping < 400) statusColor = 0xFEE75C;
	else statusColor = 0xED4245;

	const embed = new EmbedBuilder()
		.setColor(statusColor)
		.setAuthor({
			name: 'Luna AI',
			iconURL: 'https://raw.githubusercontent.com/miyuki2002/Luna-AI/refs/heads/main/assets/luna-avatar.png'
		})
		.setTitle('📊 Trạng thái hệ thống')
		.addFields(
			{
				name: '🤖 Độ trễ',
				value: `> **Bot**: \`${ping}ms\`\n> **WebSocket**: \`${ws}ms\``,
				inline: false
			}
		);
	return embed
		.setFooter({
			text: `Luna v${packageJson.version} • ${stringUtils.formatUptime(process.uptime())}`,
		})
		.setTimestamp();
}

function createActionRow(enabled = true) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId('refresh_status')
			.setLabel('Làm mới')
			.setEmoji('🔄')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(!enabled),
		new ButtonBuilder()
			.setCustomId('detailed_info')
			.setLabel('Thông tin chi tiết')
			.setEmoji('ℹ️')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(!enabled)
	);
}