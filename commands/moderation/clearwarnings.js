const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { translate: t } = require('../../utils/i18n.js');
const mongoClient = require('../../services/mongoClient.js');
const ConversationService = require('../../services/ConversationService.js');
const logger = require('../../utils/logger.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('clearwarnings')
		.setDescription('Xóa cảnh cáo của một thành viên')
		.addUserOption((option) =>
			option.setName('user').setDescription('Thành viên cần xóa cảnh cáo').setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName('type')
				.setDescription('Loại xóa cảnh cáo')
				.setRequired(true)
				.addChoices({ name: 'Tất cả', value: 'all' }, { name: 'Mới nhất', value: 'latest' }),
		)
		.addStringOption((option) =>
			option.setName('reason').setDescription('Lý do xóa cảnh cáo').setRequired(false),
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

	async execute(interaction) {
		if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
			return interaction.reply({
				content: t(interaction, 'commands.clearwarnings.errors.noPermission'),
				ephemeral: true,
			});
		}

		const targetUser = interaction.options.getUser('user');
		const type = interaction.options.getString('type');
		const reason =
			interaction.options.getString('reason') ||
			t(interaction, 'commands.clearwarnings.defaultReason');

		await interaction.deferReply();

		try {
			const db = mongoClient.getDb();

			const warningCount = await db.collection('warnings').countDocuments({
				userId: targetUser.id,
				guildId: interaction.guild.id,
			});

			if (warningCount === 0) {
				return interaction.editReply({
					content: t(interaction, 'commands.clearwarnings.errors.noWarnings', {
						user: targetUser.tag,
					}),
					ephemeral: false,
				});
			}

			let deletedCount = 0;

			if (type === 'all') {
				const result = await db.collection('warnings').deleteMany({
					userId: targetUser.id,
					guildId: interaction.guild.id,
				});

				deletedCount = result.deletedCount;
			} else if (type === 'latest') {
				const latestWarning = await db.collection('warnings').findOne(
					{
						userId: targetUser.id,
						guildId: interaction.guild.id,
					},
					{
						sort: { timestamp: -1 },
					},
				);

				if (latestWarning) {
					await db.collection('warnings').deleteOne({ _id: latestWarning._id });
					deletedCount = 1;
				}
			}

			const prompts = require('../../config/prompts.js');
			const prompt = prompts.moderation.clearwarnings
				.replace('${type}', type === 'all' ? 'tất cả' : 'cảnh cáo mới nhất')
				.replace('${username}', targetUser.username)
				.replace('${reason}', reason)
				.replace('${deletedCount}', deletedCount);

			const aiResponse = await ConversationService.getCompletion(prompt);

			const clearEmbed = new EmbedBuilder()
				.setColor(0x00ff00)
				.setTitle(t(interaction, 'commands.clearwarnings.embeds.success.title'))
				.setDescription(aiResponse)
				.addFields(
					{
						name: t(interaction, 'commands.clearwarnings.embeds.success.fields.member'),
						value: `${targetUser.tag}`,
						inline: true,
					},
					{
						name: t(interaction, 'commands.clearwarnings.embeds.success.fields.id'),
						value: targetUser.id,
						inline: true,
					},
					{
						name: t(interaction, 'commands.clearwarnings.embeds.success.fields.deletedCount'),
						value: `${deletedCount}`,
						inline: true,
					},
					{
						name: t(interaction, 'commands.clearwarnings.embeds.success.fields.type'),
						value:
							type === 'all'
								? t(interaction, 'commands.clearwarnings.embeds.success.fields.all')
								: t(interaction, 'commands.clearwarnings.embeds.success.fields.latest'),
						inline: true,
					},
					{
						name: t(interaction, 'commands.clearwarnings.embeds.success.fields.reason'),
						value: reason,
						inline: false,
					},
				)
				.setFooter({
					text: t(interaction, 'commands.clearwarnings.embeds.success.footer', {
						moderator: interaction.user.tag,
					}),
				})
				.setTimestamp();

			await interaction.editReply({ embeds: [clearEmbed] });

			try {
				const dmEmbed = new EmbedBuilder()
					.setColor(0x00ff00)
					.setTitle(
						t(interaction, 'commands.clearwarnings.dm.title', { server: interaction.guild.name }),
					)
					.setDescription(
						t(interaction, 'commands.clearwarnings.dm.description', {
							type:
								type === 'all'
									? t(interaction, 'commands.clearwarnings.dm.all')
									: t(interaction, 'commands.clearwarnings.dm.latest'),
							count: deletedCount,
							reason: reason,
						}),
					)
					.setFooter({
						text: t(interaction, 'commands.clearwarnings.dm.footer', {
							moderator: interaction.user.tag,
						}),
					})
					.setTimestamp();

				await targetUser.send({ embeds: [dmEmbed] });
			} catch (error) {
				logger.error('MODERATION', `Không thể gửi DM cho ${targetUser.tag}`);
			}
		} catch (error) {
			logger.error('MODERATION', 'Lỗi khi xóa cảnh cáo của thành viên:', error);
			await interaction.editReply({
				content: t(interaction, 'commands.clearwarnings.errors.general', {
					user: targetUser.tag,
					error: error.message,
				}),
				ephemeral: true,
			});
		}
	},
};
