const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { translate: t } = require('../../utils/i18n.js');
const { logModAction } = require('../../utils/modUtils.js');
const { sendModLog, createModActionEmbed } = require('../../utils/modLogUtils.js');
const { handlePermissionError } = require('../../utils/permissionUtils.js');
const logger = require('../../utils/logger.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('kick')
		.setDescription(t('en-US', 'commands.kick.description'))
		.setDescriptionLocalizations({
			vi: t('vi', 'commands.kick.description'),
		})
		.addUserOption((option) =>
			option
				.setName('user')
				.setDescription(t('en-US', 'commands.kick.options.user'))
				.setDescriptionLocalizations({
					vi: t('vi', 'commands.kick.options.user'),
				})
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName('reason')
				.setDescription(t('en-US', 'commands.kick.options.reason'))
				.setDescriptionLocalizations({
					vi: t('vi', 'commands.kick.options.reason'),
				})
				.setRequired(false),
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

	async execute(interaction) {
		if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
			return interaction.reply({
				content: t(interaction, 'commands.kick.errors.noPermission'),
				ephemeral: true,
			});
		}

		const targetUser = interaction.options.getUser('user');
		const targetMember = interaction.options.getMember('user');

		if (!targetMember) {
			return interaction.reply({
				content: t(interaction, 'commands.kick.errors.userNotFound'),
				ephemeral: true,
			});
		}

		const reason = interaction.options.getString('reason')?.trim()
			|| t(interaction, 'commands.kick.defaultReason');

		if (!targetMember.kickable) {
			return interaction.reply({
				content: t(interaction, 'commands.kick.errors.cannotKick'),
				ephemeral: true,
			});
		}

		await interaction.deferReply();

		try {
			const kickEmbed = new EmbedBuilder()
				.setColor(0xFFA500)
				.setTitle(t(interaction, 'commands.kick.embeds.success.title'))
				.setDescription(t(interaction, 'commands.kick.embeds.success.description', {
					user: targetUser.tag,
				}))
				.addFields(
					{
						name: t(interaction, 'commands.kick.embeds.success.fields.user'),
						value: targetUser.tag,
						inline: true,
					},
					{
						name: t(interaction, 'commands.kick.embeds.success.fields.userId'),
						value: targetUser.id,
						inline: true,
					},
					{
						name: t(interaction, 'commands.kick.embeds.success.fields.reason'),
						value: reason,
						inline: false,
					},
					{
						name: t(interaction, 'commands.kick.embeds.success.fields.moderator'),
						value: interaction.user.tag,
						inline: true,
					},
					{
						name: t(interaction, 'commands.kick.embeds.success.fields.date'),
						value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
						inline: true,
					},
				)
				.setFooter({
					text: t(interaction, 'commands.kick.embeds.success.footer', {
						moderator: interaction.user.tag,
					}),
				})
				.setTimestamp();

			await targetMember.kick(reason);

			await logModAction({
				guildId: interaction.guild.id,
				targetId: targetUser.id,
				moderatorId: interaction.user.id,
				action: 'kick',
				reason,
			});

			try {
				await interaction.editReply({ embeds: [kickEmbed] });
			} catch (error) {
				if (error.code === 50013 || error.message.includes('permission')) {
					await handlePermissionError(interaction, 'embedLinks', interaction.user.username, 'editReply');
				} else {
					throw error;
				}
			}

			const logEmbed = createModActionEmbed({
				title: t(interaction, 'commands.kick.embeds.success.title'),
				description: t(interaction, 'commands.kick.embeds.success.description', {
					user: targetUser.tag,
				}),
				color: 0xFFA500,
				fields: [
					{
						name: t(interaction, 'commands.kick.embeds.success.fields.user'),
						value: `${targetUser.tag}`,
						inline: true,
					},
					{
						name: t(interaction, 'commands.kick.embeds.success.fields.userId'),
						value: targetUser.id,
						inline: true,
					},
					{
						name: t(interaction, 'commands.kick.embeds.success.fields.moderator'),
						value: `${interaction.user.tag} (<@${interaction.user.id}>)`,
						inline: true,
					},
					{
						name: t(interaction, 'commands.kick.embeds.success.fields.reason'),
						value: reason,
						inline: false,
					},
					{
						name: t(interaction, 'commands.kick.embeds.success.fields.date'),
						value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
						inline: false,
					},
				],
				footer: t(interaction, 'commands.kick.embeds.success.footerServer', {
					server: interaction.guild.name,
				}),
			});

			await sendModLog(interaction.guild, logEmbed, true);
		} catch (error) {
			const errorMessage = t(interaction, 'commands.kick.errors.general', {
				user: targetUser.tag,
				error: error.message,
			});

			logger.error('MODERATION', errorMessage);

			await interaction.editReply({
				content: errorMessage,
			});
		}
	},
};


