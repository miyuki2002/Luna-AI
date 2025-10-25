const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ProfileDB = require('../../services/profiledb.js');
const logger = require('../../utils/logger.js');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetuserdb')
    .setDescription('Xóa tất cả user profiles (chỉ dành cho owner)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const ownerId = process.env.OWNER_ID;
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ 
        content: 'Bạn không có quyền sử dụng lệnh này. Chỉ owner mới có thể reset user database.', 
        ephemeral: true 
      });
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('resetuser_confirm')
          .setLabel('Đồng ý')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId('resetuser_cancel')
          .setLabel('Từ chối')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );

    await interaction.reply({
      content: `⚠️ **XÁC NHẬN RESET USER DATABASE** ⚠️\n\n` +
               `Bạn có chắc chắn muốn xóa tất cả user profiles không?\n\n` +
               `**Cảnh báo:**\n` +
               `> Tất cả user profiles sẽ bị xóa vĩnh viễn\n` +
               `> Không thể khôi phục sau khi reset\n` +
               `> Tất cả XP, level, achievements sẽ mất\n` +
               `> Users sẽ phải đồng ý consent lại\n\n` +
               `**Hành động này không thể hoàn tác!**`,
      components: [row],
      ephemeral: true
    });
  },
};
