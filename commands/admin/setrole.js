const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const TokenService = require('../../services/TokenService.js');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setrole')
    .setDescription('Đặt vai trò cho người dùng (Owner/Admin only)')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Người dùng cần đặt vai trò')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('role')
        .setDescription('Vai trò mới')
        .setRequired(true)
        .addChoices(
          { name: 'Owner', value: 'owner' },
          { name: 'Admin', value: 'admin' },
          { name: 'Helper', value: 'helper' },
          { name: 'User', value: 'user' }
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
          content: '❌ Bạn không có quyền sử dụng lệnh này! Chỉ Owner và Admin mới có thể đặt vai trò.',
          ephemeral: true
        });
      }

      const targetUser = interaction.options.getUser('user');
      const newRole = interaction.options.getString('role');

      // Kiểm tra không thể set role owner trừ khi bạn là owner
      if (newRole === 'owner' && executorRole !== 'owner') {
        return await interaction.editReply({
          content: '❌ Chỉ Owner mới có thể đặt vai trò Owner cho người khác!',
          ephemeral: true
        });
      }

      // Đặt role mới
      await TokenService.setUserRole(targetUser.id, newRole);

      // Lấy thông tin token mới
      const tokenData = await TokenService.getUserTokenData(targetUser.id);

      const roleNames = {
        owner: 'Owner',
        admin: 'Admin',
        helper: 'Helper',
        user: 'Người dùng'
      };

      const embed = new EmbedBuilder()
        .setTitle('Đặt vai trò thành công')
        .setColor('#00ff00')
        .addFields(
          { name: 'Người dùng', value: `${targetUser.tag}`, inline: true },
          { name: 'Vai trò mới', value: roleNames[newRole], inline: true },
          { name: 'Giới hạn token', value: tokenData.limits.daily === -1 ? 'Không giới hạn' : `${tokenData.limits.daily.toLocaleString()} tokens/ngày`, inline: true }
        )
        .setFooter({ text: `Được thực hiện bởi ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      logger.info('ADMIN', `${interaction.user.tag} đặt role ${newRole} cho ${targetUser.tag}`);
    } catch (error) {
      logger.error('ADMIN', 'Lỗi khi đặt role:', error);
      await interaction.editReply({
        content: `❌ Lỗi khi đặt vai trò: ${error.message}`,
        ephemeral: true
      });
    }
  },
};

