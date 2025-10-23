const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const TokenService = require('../../services/TokenService.js');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resettoken')
    .setDescription('Reset giới hạn token cho người dùng (Owner/Admin only)')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Người dùng cần reset token')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Loại reset')
        .setRequired(true)
        .addChoices(
          { name: 'Hàng ngày', value: 'daily' },
          { name: 'Hàng tuần', value: 'weekly' },
          { name: 'Hàng tháng', value: 'monthly' },
          { name: 'Tất cả', value: 'all' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Kiểm tra quyền owner/admin
      const executorRole = await TokenService.getUserRole(interaction.user.id);
      if (executorRole !== 'owner' && executorRole !== 'admin') {
        return await interaction.editReply({
          content: 'Bạn không có quyền sử dụng lệnh này! Chỉ Owner và Admin mới có thể reset token.',
          ephemeral: true
        });
      }

      const targetUser = interaction.options.getUser('user');
      const resetType = interaction.options.getString('type');

      // Reset tokens
      await TokenService.resetUserTokens(targetUser.id, resetType);

      // Lấy thông tin token mới
      const stats = await TokenService.getUserTokenStats(targetUser.id);

      const resetTypeNames = {
        daily: 'hàng ngày',
        weekly: 'hàng tuần',
        monthly: 'hàng tháng',
        all: 'tất cả'
      };

      const embed = new EmbedBuilder()
        .setTitle('Reset token thành công')
        .setColor('#00ff00')
        .addFields(
          { name: 'Người dùng', value: `${targetUser.tag}`, inline: true },
          { name: 'Loại reset', value: resetTypeNames[resetType], inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: 'Token hôm nay', value: `${stats.usage.daily.toLocaleString()} tokens`, inline: true },
          { name: 'Token tuần này', value: `${stats.usage.weekly.toLocaleString()} tokens`, inline: true },
          { name: 'Token tháng này', value: `${stats.usage.monthly.toLocaleString()} tokens`, inline: true }
        )
        .setFooter({ text: `Được thực hiện bởi ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      logger.info('ADMIN', `${interaction.user.tag} reset ${resetType} tokens cho ${targetUser.tag}`);
    } catch (error) {
      logger.error('ADMIN', 'Lỗi khi reset token:', error);
      await interaction.editReply({
        content: `Lỗi khi reset token: ${error.message}`,
        ephemeral: true
      });
    }
  },
};

