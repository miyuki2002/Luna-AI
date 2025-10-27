const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { translate: t } = require('../../utils/i18n.js');
const mongoClient = require('../../services/mongoClient.js');
const { getModLogChannel } = require('../../utils/modLogUtils.js');
const logger = require('../../utils/logger.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('logchannel')
		.setDescription('Xem cài đặt kênh log hiện tại')
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

	async execute(interaction) {
		if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
			return interaction.reply({
				content: t(interaction, 'commands.logchannel.errors.noPermission'),
				ephemeral: true,
			});
		}

		await interaction.deferReply();

		try {
			const db = mongoClient.getDb();

			const logSettings = await db.collection('mod_settings').findOne({
				guildId: interaction.guild.id,
			});

			const modActionLogChannel = await getModLogChannel(interaction.guild, true);
			const monitorLogChannel = await getModLogChannel(interaction.guild, false);

			if (!logSettings) {
				const defaultLogEmbed = new EmbedBuilder()
					.setColor(0x3498db)
					.setTitle(t(interaction, 'commands.logchannel.embeds.default.title'))
					.setDescription(t(interaction, 'commands.logchannel.embeds.default.description'))
					.addFields(
						{
							name: t(interaction, 'commands.logchannel.embeds.default.fields.modActionLogChannel'),
							value: modActionLogChannel
								? `<#${modActionLogChannel.id}>`
								: t(interaction, 'commands.logchannel.embeds.default.fields.notFound'),
							inline: true,
						},
						{
							name: t(interaction, 'commands.logchannel.embeds.default.fields.monitorLogChannel'),
							value: monitorLogChannel
								? `<#${monitorLogChannel.id}>`
								: t(interaction, 'commands.logchannel.embeds.default.fields.notFound'),
							inline: true,
						},
						{
							name: t(interaction, 'commands.logchannel.embeds.default.fields.howToSetup'),
							value: t(interaction, 'commands.logchannel.embeds.default.fields.setupCommand'),
							inline: false,
						},
					)
					.setFooter({
						text: t(interaction, 'common.footer.server', { server: interaction.guild.name }),
					})
					.setTimestamp();

				return interaction.editReply({ embeds: [defaultLogEmbed] });
			}

			let logChannel;
			try {
				logChannel = await interaction.guild.channels.fetch(logSettings.logChannelId);
			} catch (error) {
				logger.error(
					'MODERATION',
					`Không thể tìm thấy kênh log ${logSettings.logChannelId}:`,
					error,
				);
			}

			const logEmbed = new EmbedBuilder()
				.setColor(0x00ff00)
				.setTitle(t(interaction, 'commands.logchannel.embeds.current.title'))
				.setDescription(
					logChannel
						? t(interaction, 'commands.logchannel.embeds.current.description.current', {
								channel: `<#${logChannel.id}>`,
							})
						: t(interaction, 'commands.logchannel.embeds.current.description.notFound'),
				)
				.addFields(
					{
						name: t(interaction, 'commands.logchannel.embeds.current.fields.modActionLogs'),
						value:
							logSettings.modActionLogs !== false
								? t(interaction, 'common.enabled')
								: t(interaction, 'common.disabled'),
						inline: true,
					},
					{
						name: t(interaction, 'commands.logchannel.embeds.current.fields.monitorLogs'),
						value:
							logSettings.monitorLogs !== false
								? t(interaction, 'common.enabled')
								: t(interaction, 'common.disabled'),
						inline: true,
					},
				)
				.setFooter({
					text: t(interaction, 'common.footer.server', { server: interaction.guild.name }),
				})
				.setTimestamp();

			if (logSettings.updatedBy) {
				logEmbed.addFields(
					{
						name: t(interaction, 'commands.logchannel.embeds.current.fields.setBy'),
						value: `<@${logSettings.updatedBy}>`,
						inline: true,
					},
					{
						name: t(interaction, 'commands.logchannel.embeds.current.fields.setTime'),
						value: logSettings.updatedAt
							? `<t:${Math.floor(new Date(logSettings.updatedAt).getTime() / 1000)}:R>`
							: t(interaction, 'common.unknown'),
						inline: true,
					},
				);
			}

			logEmbed.addFields({
				name: t(interaction, 'commands.logchannel.embeds.current.fields.howToReconfigure'),
				value: t(interaction, 'commands.logchannel.embeds.current.fields.reconfigureCommand'),
				inline: false,
			});

			await interaction.editReply({ embeds: [logEmbed] });
		} catch (error) {
			logger.error('MODERATION', 'Lỗi khi xem cài đặt kênh log:', error);
			await interaction.editReply({
				content: t(interaction, 'commands.logchannel.errors.general', { error: error.message }),
				ephemeral: true,
			});
		}
	},
};
