const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const packageJson = require('../../package.json');
const stringUtils = require('../../utils/string');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Kiểm tra độ trễ và trạng thái kết nối của bot'),
	
	async execute(interaction) {
		const sent = await interaction.deferReply({ fetchReply: true });
		const pingLatency = (sent.createdTimestamp - interaction.createdTimestamp) / 100;
		
		// Tạo placeholder embed ban đầu
		const initialEmbed = createStatusEmbed({
			ping: pingLatency,
			ws: interaction.client.ws.ping,
		});
		const response = await interaction.editReply({
			embeds: [initialEmbed],
			components: [createActionRow(false)]
		});


		// Cập nhật embed với thông tin mới
		const updatedEmbed = createStatusEmbed({
			ping: pingLatency,
			ws: interaction.client.ws.ping,
		});

		// Cập nhật tin nhắn gốc với embed mới và các nút tương tác
		await interaction.editReply({
			embeds: [updatedEmbed],
			components: [createActionRow(true)]
		});

		// Tạo collector để xử lý các sự kiện nút nhấn
		const collector = response.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 60000
		});

		collector.on('collect', async (i) => {
			// Chỉ người dùng ban đầu mới có thể tương tác
			if (i.user.id !== interaction.user.id) {
				return i.reply({
					content: 'Chỉ người dùng lệnh mới có thể sử dụng các nút này.',
					ephemeral: true
				});
			}

			if (i.customId === 'refresh_status') {
				// Gửi phản hồi tạm thời
				await i.update({
					embeds: [createStatusEmbed({
						ping: pingLatency,
						ws: interaction.client.ws.ping,
						mongo: "Đang làm mới...",
						ai: "Đang làm mới..."
					})],
					components: [createActionRow(false)]
				});

				// Lấy dữ liệu mới
				const newPingLatency = Date.now() - i.createdTimestamp;
				const [newMongoResult, newAiResult] = await Promise.all([
					checkMongoDB(),
					checkAIService()
				]);

				// Cập nhật tin nhắn với dữ liệu mới
				await i.editReply({
					embeds: [createStatusEmbed({
						ping: newPingLatency,
						ws: interaction.client.ws.ping,
						mongo: newMongoResult,
						ai: newAiResult
					})],
					components: [createActionRow(true)]
				});
			} else if (i.customId === 'detailed_info') {
				// Hiển thị thông tin chi tiết
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
			// Vô hiệu hóa các nút sau khi collector kết thúc
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

			interaction.editReply({ components: [disabledRow] }).catch(() => {});
		});
	},
};

/**
 * Tạo embed hiển thị trạng thái
 */
function createStatusEmbed({ ping, ws, mongo, ai }) {
	// Xác định màu dựa trên ping
	let statusColor;
	if (ping < 200) statusColor = 0x57F287; // Xanh lá - tốt
	else if (ping < 400) statusColor = 0xFEE75C; // Vàng - trung bình
	else statusColor = 0xED4245; // Đỏ - chậm

	return new EmbedBuilder()
		.setColor(statusColor)
		.setAuthor({ 
			name: 'Luna AI', 
			iconURL: 'https://cdn.discordapp.com/avatars/1167040553745023047/44b01eced3cfea85ab32eda3ef2bc11b.webp' 
		})
		.setTitle('📊 Trạng thái hệ thống')
		.addFields(
			{ 
				name: '🤖 Độ trễ',
				value: `> **Bot**: \`${ping}ms\`\n> **WebSocket**: \`${ws}ms\``,
				inline: false 
			},
			{ 
				name: '📦 Cơ sở dữ liệu', 
				value: mongo, 
				inline: true 
			},
			{ 
				name: '🧠 Dịch vụ AI', 
				value: ai, 
				inline: true 
			}
		)
		.setFooter({ 
			text: `Luna v${packageJson.version} • ${stringUtils.formatUptime(process.uptime())}`,
		})
		.setTimestamp();
}

/**
 * Tạo hàng chứa các nút tương tác
 */
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