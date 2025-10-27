const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const packageJson = require('../../package.json');
const stringUtils = require('../../utils/string');
const { translate: t } = require('../../utils/i18n');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription(t('en-US', 'commands.ping.description'))
		.setDescriptionLocalizations({
			vi: t('vi', 'commands.ping.description'),
		}),

	async execute(interaction) {
		const sent = await interaction.deferReply({ fetchReply: true });
		const pingLatency = ((sent.createdTimestamp - interaction.createdTimestamp) / 100).toFixed(0);

		const initialEmbed = createStatusEmbed(interaction, {
			ping: pingLatency,
			ws: interaction.client.ws.ping,
		});

		const response = await interaction.editReply({
			embeds: [initialEmbed],
			components: [createActionRow(interaction, false)],
		});

		const updatedEmbed = createStatusEmbed(interaction, {
			ping: pingLatency,
			ws: interaction.client.ws.ping,
		});

		await interaction.editReply({
			embeds: [updatedEmbed],
			components: [createActionRow(interaction, true)],
		});

		const collector = response.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 60000,
		});

		collector.on('collect', async (i) => {
			if (i.user.id !== interaction.user.id) {
				return i.reply({
					content: t(i, 'commands.ping.errors.notInvoker'),
					ephemeral: true,
				});
			}

			if (i.customId === 'refresh_status') {
				await i.update({
					embeds: [createStatusEmbed(i, {
						ping: pingLatency,
						ws: interaction.client.ws.ping,
					})],
					components: [createActionRow(i, false)],
				});

				const newPingLatency = pingLatency;
				const newWsLatency = interaction.client.ws.ping;

				await i.editReply({
					embeds: [createStatusEmbed(i, {
						ping: newPingLatency,
						ws: newWsLatency,
					})],
					components: [createActionRow(i, true)],
				});
			} else if (i.customId === 'detailed_info') {
				const detailedEmbed = createDetailedEmbed(i);
				await i.reply({
					embeds: [detailedEmbed],
					ephemeral: true,
				});
			}
		});

		collector.on('end', () => {
			interaction.editReply({
				components: [createActionRow(interaction, false)],
			}).catch(() => {});
		});
	},
};

function createDetailedEmbed(context) {
	const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
	const shardCount = context.client.shard ? context.client.shard.count : 1;

	return new EmbedBuilder()
		.setColor(0x9B59B6)
		.setTitle(t(context, 'commands.ping.embeds.detailed.title'))
		.addFields(
			{ name: t(context, 'commands.ping.embeds.detailed.fields.botVersion'), value: `\`${packageJson.version}\``, inline: true },
			{ name: t(context, 'commands.ping.embeds.detailed.fields.discordVersion'), value: `\`${packageJson.dependencies['discord.js'].replace('^', '')}\``, inline: true },
			{ name: t(context, 'commands.ping.embeds.detailed.fields.nodeVersion'), value: `\`${process.version}\``, inline: true },
			{ name: t(context, 'commands.ping.embeds.detailed.fields.uptime'), value: `\`${stringUtils.formatUptime(process.uptime())}\``, inline: false },
			{ name: t(context, 'commands.ping.embeds.detailed.fields.memory'), value: `\`${memoryUsage} MB\``, inline: true },
			{ name: t(context, 'commands.ping.embeds.detailed.fields.platform'), value: `\`${process.platform} ${process.arch}\``, inline: true },
			{ name: t(context, 'commands.ping.embeds.detailed.fields.shards'), value: `\`${shardCount}\``, inline: true },
		)
		.setFooter({ text: t(context, 'common.footer.credit') })
		.setTimestamp();
}

function createStatusEmbed(context, { ping, ws }) {
	let statusColor;
	if (ping < 200) statusColor = 0x57F287;
	else if (ping < 400) statusColor = 0xFEE75C;
	else statusColor = 0xED4245;

	const latencyLines = [
		`> **${t(context, 'commands.ping.embeds.status.botLabel')}**: \`${ping}ms\``,
		`> **${t(context, 'commands.ping.embeds.status.wsLabel')}**: \`${ws}ms\``,
	].join('\n');

	return new EmbedBuilder()
		.setColor(statusColor)
		.setAuthor({
			name: 'Luna AI',
			iconURL: 'https://raw.githubusercontent.com/miyuki2002/Luna-AI/refs/heads/main/assets/luna-avatar.png',
		})
		.setTitle(t(context, 'commands.ping.embeds.status.title'))
		.addFields({
			name: t(context, 'commands.ping.embeds.status.latencyField'),
			value: latencyLines,
			inline: false,
		})
		.setFooter({
			text: t(context, 'common.footer.versionUptime', {
				version: packageJson.version,
				uptime: stringUtils.formatUptime(process.uptime()),
			}),
		})
		.setTimestamp();
}

function createActionRow(context, enabled = true) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId('refresh_status')
			.setLabel(t(context, 'commands.ping.buttons.refresh'))
			.setEmoji('ðŸ”„')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(!enabled),
		new ButtonBuilder()
			.setCustomId('detailed_info')
			.setLabel(t(context, 'commands.ping.buttons.detailed'))
			.setEmoji('â„¹ï¸')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(!enabled),
	);
}

