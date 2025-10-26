const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const MessageService = require('../../services/TokenService.js');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quotas')
    .setDescription('Xem thống kê lượt nhắn tin đã sử dụng')
    .addSubcommand(subcommand =>
      subcommand
        .setName('user')
        .setDescription('Xem thống kê lượt nhắn tin đã sử dụng của một người dùng')
        .addUserOption(option =>
          option
            .setName('target')
            .setDescription('Người dùng cần xem thống kê (để trống để xem của bản thân)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('system')
        .setDescription('Xem thống kê lượt nhắn tin đã sử dụng của toàn hệ thống (Owner/Admin only)')
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'user') {
        await handleUserStats(interaction);
      } else if (subcommand === 'system') {
        await handleSystemStats(interaction);
      }
    } catch (error) {
      logger.error('ADMIN', 'Lỗi khi xem thống kê lượt nhắn tin đã sử dụng:', error);
      await interaction.editReply({
        content: `Lỗi khi lấy thống kê: ${error.message}`,
        ephemeral: true
      });
    }
  },
};

async function handleUserStats(interaction) {
  const targetUser = interaction.options.getUser('target') || interaction.user;
  const requesterId = interaction.user.id;
  
  // Kiểm tra quyền nếu xem thống kê người khác
  if (targetUser.id !== requesterId) {
    const requesterRole = await MessageService.getUserRole(requesterId);
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return await interaction.editReply({
        content: 'Bạn không có quyền xem thống kê của người khác!',
        ephemeral: true
      });
    }
  }

  const stats = await MessageService.getUserMessageStats(targetUser.id);

  const roleNames = {
    owner: 'Owner',
    admin: 'Admin',
    helper: 'Helper',
    user: 'Người dùng'
  };

  const embed = new EmbedBuilder()
    .setTitle(`Thống kê Lượt nhắn tin đã sử dụng - ${targetUser.username}`)
    .setColor('#0099ff')
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      { name: 'Vai trò', value: roleNames[stats.role] || stats.role, inline: true },
      { name: 'Lượt hạn mức', value: stats.limits.daily === -1 ? 'Không giới hạn' : `${stats.limits.daily.toLocaleString()} lượt/ngày`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: 'Hôm nay', value: `${stats.usage.daily.toLocaleString()} lượt`, inline: true },
      { name: 'Tuần này', value: `${stats.usage.weekly.toLocaleString()} lượt`, inline: true },
      { name: 'Tháng này', value: `${stats.usage.monthly.toLocaleString()} lượt`, inline: true },
      { name: 'Tổng cộng', value: `${stats.usage.total.toLocaleString()} lượt`, inline: true },
      { name: 'Còn lại hôm nay', value: stats.remaining.daily === -1 ? 'Không giới hạn' : `${stats.remaining.daily.toLocaleString()} lượt`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true }
    )
    .setFooter({ text: `User ID: ${targetUser.id}` })
    .setTimestamp();

  // Hiển thị lịch sử gần đây nếu có
  if (stats.recentHistory && stats.recentHistory.length > 0) {
    const historyText = stats.recentHistory
      .slice(-5)
      .reverse()
      .map(h => `• ${h.messages.toLocaleString()} lượt - ${h.operation}`)
      .join('\n');
    embed.addFields({ name: 'Hoạt động gần đây', value: historyText || 'Không có', inline: false });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleSystemStats(interaction) {
  // Kiểm tra quyền owner/admin
  const requesterRole = await MessageService.getUserRole(interaction.user.id);
  if (requesterRole !== 'owner' && requesterRole !== 'admin') {
    return await interaction.editReply({
      content: 'Bạn không có quyền xem thống kê hệ thống!',
      ephemeral: true
    });
  }

  const stats = await MessageService.getSystemStats();

  const embed = new EmbedBuilder()
    .setTitle('Thống kê Hạn ngạch Hệ thống')
    .setColor('#ff9900')
    .addFields(
      { name: 'Tổng người dùng', value: stats.totalUsers.toLocaleString(), inline: true },
      { name: 'Owner', value: stats.byRole.owner.toString(), inline: true },
      { name: 'Admin', value: stats.byRole.admin.toString(), inline: true },
      { name: 'Helper', value: stats.byRole.helper.toString(), inline: true },
      { name: 'User', value: stats.byRole.user.toString(), inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: 'Hạn ngạch hôm nay', value: `${stats.totalMessagesUsed.daily.toLocaleString()} lượt`, inline: true },
      { name: 'Hạn ngạch tuần này', value: `${stats.totalMessagesUsed.weekly.toLocaleString()} lượt`, inline: true },
      { name: 'Hạn ngạch tháng này', value: `${stats.totalMessagesUsed.monthly.toLocaleString()} lượt`, inline: true },
      { name: 'Tổng hạn ngạch', value: `${stats.totalMessagesUsed.total.toLocaleString()} lượt`, inline: false }
    )
    .setFooter({ text: `Được yêu cầu bởi ${interaction.user.tag}` })
    .setTimestamp();

  // Hiển thị top users
  if (stats.topUsers && stats.topUsers.length > 0) {
    const topUsersText = stats.topUsers
      .map((u, i) => `${i + 1}. <@${u.userId}>: ${u.daily.toLocaleString()} lượt (${u.role})`)
      .join('\n');
    embed.addFields({ name: 'Top 10 người dùng hôm nay', value: topUsersText, inline: false });
  }

  await interaction.editReply({ embeds: [embed] });
}

