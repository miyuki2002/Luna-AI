const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { forceDeployCommandsToAllGuilds } = require('../../handlers/guildHandler.js');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deploycommands')
    .setDescription('Force deploy tất cả commands cho tất cả servers (Owner only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Kiểm tra quyền owner
      const ownerId = process.env.OWNER_ID;
      if (interaction.user.id !== ownerId) {
        return await interaction.editReply({
          content: 'Bạn không có quyền sử dụng lệnh này! Chỉ Owner mới có thể force deploy commands.',
          ephemeral: true
        });
      }

      await interaction.editReply({
        content: 'Đang force deploy commands cho tất cả servers... Vui lòng đợi!',
        ephemeral: true
      });

      // Force deploy commands
      await forceDeployCommandsToAllGuilds(interaction.client);

      await interaction.editReply({
        content: 'Đã force deploy commands thành công cho tất cả servers!',
        ephemeral: true
      });

      logger.info('ADMIN', `${interaction.user.tag} đã force deploy commands cho tất cả guilds`);
    } catch (error) {
      logger.error('ADMIN', 'Lỗi khi force deploy commands:', error);
      await interaction.editReply({
        content: `Lỗi khi force deploy commands: ${error.message}`,
        ephemeral: true
      });
    }
  },
};
