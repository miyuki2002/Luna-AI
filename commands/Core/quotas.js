const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const MessageService = require('../../services/TokenService.js');
const logger = require('../../utils/logger.js');
const { translate: t } = require('../../utils/i18n');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('quotas')
		.setDescription('Xem thống kê hạn ngạch tin nhắn')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('user')
				.setDescription('Xem thống kê hạn ngạch tin nhắn của người dùng')
				.addUserOption((option) =>
					option
						.setName('target')
						.setDescription('Người dùng cần xem (để trống để xem của bạn)')
						.setRequired(false),
			),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('system')
				.setDescription('Xem thống kê hạn ngạch toàn hệ thống (Owner/Admin)'),
		),

	async execute(interaction) {
		try {
			await interaction.deferReply({ ephemeral: true });

			const subcommand = interaction.options.getSubcommand();

			if (subcommand === 'user') {
				await handleUserStats(interaction);
			} else {
				await handleSystemStats(interaction);
			}
		} catch (error) {
			logger.error('ADMIN', 'Error while retrieving quota statistics:', error);
			await interaction.editReply({
				content: t(interaction, 'commands.quotas.errors.general', { message: error.message }),
				ephemeral: true,
			});
		}
	},
};

async function handleUserStats(interaction) {
	const targetUser = interaction.options.getUser('target') || interaction.user;
	const requesterId = interaction.user.id;

	if (targetUser.id !== requesterId) {
		const requesterRole = await MessageService.getUserRole(requesterId);
		if (!['owner', 'admin'].includes(requesterRole)) {
			await interaction.editReply({
				content: t(interaction, 'commands.quotas.errors.noPermissionOther'),
				ephemeral: true,
			});
			return;
		}
	}

	const stats = await MessageService.getUserMessageStats(targetUser.id);
	const roleNames = t(interaction, 'commands.quotas.roles') || {};

	const embed = new EmbedBuilder()
		.setTitle(t(interaction, 'commands.quotas.embeds.user.title', { username: targetUser.username }))
		.setColor('#0099ff')
		.setThumbnail(targetUser.displayAvatarURL())
		.addFields(
			{
				name: t(interaction, 'commands.quotas.embeds.user.fields.role'),
				value: roleNames[stats.role] || stats.role,
				inline: true,
			},
			{
				name: t(interaction, 'commands.quotas.embeds.user.fields.dailyLimit'),
				value: formatLimit(interaction, stats.limits.daily),
				inline: true,
			},
			{ name: '\u200b', value: '\u200b', inline: true },
			{
				name: t(interaction, 'commands.quotas.embeds.user.fields.today'),
				value: formatUses(interaction, stats.usage.daily),
				inline: true,
			},
			{
				name: t(interaction, 'commands.quotas.embeds.user.fields.week'),
				value: formatUses(interaction, stats.usage.weekly),
				inline: true,
			},
			{
				name: t(interaction, 'commands.quotas.embeds.user.fields.month'),
				value: formatUses(interaction, stats.usage.monthly),
				inline: true,
			},
			{
				name: t(interaction, 'commands.quotas.embeds.user.fields.total'),
				value: formatUses(interaction, stats.usage.total),
				inline: true,
			},
			{
				name: t(interaction, 'commands.quotas.embeds.user.fields.remainingToday'),
				value: formatLimit(interaction, stats.remaining.daily),
				inline: true,
			},
			{ name: '\u200b', value: '\u200b', inline: true },
		)
		.setFooter({ text: t(interaction, 'commands.quotas.embeds.user.footer', { id: targetUser.id }) })
		.setTimestamp();

	if (stats.recentHistory && stats.recentHistory.length > 0) {
		const historyLines = stats.recentHistory
			.slice(-5)
			.reverse()
			.map((entry) =>
				t(interaction, 'commands.quotas.embeds.user.historyEntry', {
					count: entry.messages.toLocaleString(),
					operation: entry.operation,
				}),
			)
			.join('\n');

		embed.addFields({
			name: t(interaction, 'commands.quotas.embeds.user.historyTitle'),
			value: historyLines || t(interaction, 'commands.quotas.embeds.user.historyEmpty'),
			inline: false,
		});
	}

	await interaction.editReply({ embeds: [embed] });
}

async function handleSystemStats(interaction) {
	const requesterRole = await MessageService.getUserRole(interaction.user.id);
	if (!['owner', 'admin'].includes(requesterRole)) {
		await interaction.editReply({
			content: t(interaction, 'commands.quotas.errors.noPermissionSystem'),
			ephemeral: true,
		});
		return;
	}

	const stats = await MessageService.getSystemStats();
	const roleNames = t(interaction, 'commands.quotas.roles') || {};

	const embed = new EmbedBuilder()
		.setTitle(t(interaction, 'commands.quotas.embeds.system.title'))
		.setColor('#ff9900')
		.addFields(
			{
				name: t(interaction, 'commands.quotas.embeds.system.fields.totalUsers'),
				value: stats.totalUsers.toLocaleString(),
				inline: true,
			},
			{
				name: roleNames.owner || 'Owner',
				value: stats.byRole.owner.toString(),
				inline: true,
			},
			{
				name: roleNames.admin || 'Admin',
				value: stats.byRole.admin.toString(),
				inline: true,
			},
			{
				name: roleNames.helper || 'Helper',
				value: stats.byRole.helper.toString(),
				inline: true,
			},
			{
				name: roleNames.user || 'User',
				value: stats.byRole.user.toString(),
				inline: true,
			},
			{ name: '\u200b', value: '\u200b', inline: true },
			{
				name: t(interaction, 'commands.quotas.embeds.system.fields.dailyUsage'),
				value: formatUses(interaction, stats.totalMessagesUsed.daily),
				inline: true,
			},
			{
				name: t(interaction, 'commands.quotas.embeds.system.fields.weeklyUsage'),
				value: formatUses(interaction, stats.totalMessagesUsed.weekly),
				inline: true,
			},
			{
				name: t(interaction, 'commands.quotas.embeds.system.fields.monthlyUsage'),
				value: formatUses(interaction, stats.totalMessagesUsed.monthly),
				inline: true,
			},
			{
				name: t(interaction, 'commands.quotas.embeds.system.fields.totalUsage'),
				value: formatUses(interaction, stats.totalMessagesUsed.total),
				inline: false,
			},
		)
		.setFooter({
			text: t(interaction, 'commands.quotas.embeds.system.footer', { tag: interaction.user.tag }),
		})
		.setTimestamp();

	if (stats.topUsers && stats.topUsers.length > 0) {
		const topUsersText = stats.topUsers
			.slice(0, 10)
			.map((user, index) =>
				t(interaction, 'commands.quotas.embeds.system.topEntry', {
					position: index + 1,
					userId: user.userId,
					count: user.daily.toLocaleString(),
					role: roleNames[user.role] || user.role,
				}),
			)
			.join('\n');

		embed.addFields({
			name: t(interaction, 'commands.quotas.embeds.system.topTitle'),
			value: topUsersText,
			inline: false,
		});
	}

	await interaction.editReply({ embeds: [embed] });
}

function formatLimit(context, value) {
	if (value === -1) {
		return t(context, 'commands.quotas.labels.noLimit');
	}
	return t(context, 'commands.quotas.labels.limitPerDay', { count: value.toLocaleString() });
}

function formatUses(context, value) {
	return t(context, 'commands.quotas.labels.usageCount', { count: value.toLocaleString() });
}





