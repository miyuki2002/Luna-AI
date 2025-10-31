const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const storageDB = require('../../services/storagedb.js');
const logger = require('../../utils/logger.js');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetdb')
    .setDescription('Xóa và tạo lại cơ sở dữ liệu (chỉ dành cho owner)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const ownerId = process.env.OWNER_ID;
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ 
        content: 'Bạn không có quyền sử dụng lệnh này!', 
        ephemeral: true 
      });
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('resetdb_confirm')
          .setLabel('Đồng ý')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('resetdb_cancel')
          .setLabel('Từ chối')
          .setStyle(ButtonStyle.Danger),
      );

    await interaction.reply({
      content: `⚠️ **XÁC NHẬN RESET DATABASE** ⚠️\n\n` +
               `Bạn có chắc chắn muốn xóa và tạo lại toàn bộ cơ sở dữ liệu không?\n\n` +
               `**Cảnh báo:**\n` +
               `> Tất cả dữ liệu sẽ bị xóa vĩnh viễn\n` +
               `> Không thể khôi phục sau khi reset\n` +
               `> Bot sẽ mất tất cả cuộc trò chuyện trước đây\n\n` +
               `**Hành động này không thể hoàn tác!**`,
      components: [row],
      ephemeral: true
    });
  },
};
