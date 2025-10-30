const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ConversationService = require('../../services/ConversationService.js');
const { logModAction } = require('../../utils/modUtils.js');
const { sendModLog, createModActionEmbed } = require('../../utils/modLogUtils.js');
const logger = require('../../utils/logger.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unban')
		.setDescription('Unban một người dùng khỏi server')
		.addStringOption((option) =>
			option.setName('userid').setDescription('ID của người dùng cần unban').setRequired(true),
		)
		.addStringOption((option) =>
			option.setName('reason').setDescription('Lý do unban').setRequired(false),
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

	async execute(interaction) {
		if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
			return interaction.reply({
				content: 'Bạn không có quyền unban người dùng!',
				ephemeral: true,
			});
		}

		const userId = interaction.options.getString('userid');
		const reason = interaction.options.getString('reason') || 'Không có lý do được cung cấp';

		if (!/^\d{17,19}$/.test(userId)) {
			return interaction.reply({
				content: 'ID người dùng không hợp lệ. ID phải là một chuỗi số từ 17-19 chữ số.',
				ephemeral: true,
			});
		}

		await interaction.deferReply();

		try {
			const banList = await interaction.guild.bans.fetch();
			const bannedUser = banList.find((ban) => ban.user.id === userId);

			if (!bannedUser) {
				return interaction.editReply({
					content: 'Người dùng này không bị ban từ server.',
					ephemeral: true,
				});
			}

			const user = bannedUser.user;

			const prompts = require('../../config/prompts.js');
			const prompt = prompts.moderation.unban
				.replace('${username}', user.username)
				.replace('${reason}', reason);

			const aiResponse = await ConversationService.getCompletion(prompt);

			const unbanEmbed = new EmbedBuilder()
				.setColor(0x00ffff)
				.setTitle(`🔓 Người dùng đã được unban`)
				.setDescription(aiResponse)
				.addFields(
					{ name: 'Người dùng', value: `${user.tag}`, inline: true },
					{ name: 'ID', value: user.id, inline: true },
					{ name: 'Lý do', value: reason, inline: false },
				)
				.setFooter({ text: `Unbanned by ${interaction.user.tag}` })
				.setTimestamp();

			await interaction.guild.members.unban(user, reason);

			await logModAction({
				guildId: interaction.guild.id,
				targetId: user.id,
				moderatorId: interaction.user.id,
				action: 'unban',
				reason: reason,
			});

			await interaction.editReply({ embeds: [unbanEmbed] });

			const logEmbed = createModActionEmbed({
				title: `🔓 Người dùng đã được unban`,
				description: `${user.tag} đã được unban khỏi server.`,
				color: 0x00ffff,
				fields: [
					{ name: 'Người dùng', value: `${user.tag}`, inline: true },
					{ name: 'ID', value: user.id, inline: true },
					{
						name: 'Người unban',
						value: `${interaction.user.tag} (<@${interaction.user.id}>)`,
						inline: true,
					},
					{ name: 'Lý do', value: reason, inline: false },
					{ name: 'Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
				],
				footer: `Server: ${interaction.guild.name}`,
			});

			await sendModLog(interaction.guild, logEmbed, true);
		} catch (error) {
			logger.error('MODERATION', 'Lỗi khi unban người dùng:', error);
			await interaction.editReply({
				content: `Đã xảy ra lỗi khi unban người dùng: ${error.message}`,
				ephemeral: true,
			});
		}
	},
};
