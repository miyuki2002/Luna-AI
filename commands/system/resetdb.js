const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const storageDB = require('../../services/storagedb.js');
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
        content: 'Bạn không có quyền sử dụng lệnh này. Chỉ owner mới có thể reset cơ sở dữ liệu.', 
        ephemeral: true 
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Thực hiện reset cơ sở dữ liệu
      const success = await storageDB.resetDatabase();

      if (success) {
        await interaction.editReply({ 
          content: 'Đã xóa và tạo lại cơ sở dữ liệu thành công! Bot sẽ không còn nhớ các cuộc trò chuyện trước đây.', 
          ephemeral: true 
        });
      } else {
        await interaction.editReply({ 
          content: 'Có lỗi xảy ra khi reset cơ sở dữ liệu. Vui lòng kiểm tra logs để biết thêm chi tiết.', 
          ephemeral: true 
        });
      }
    } catch (error) {
      console.error('Lỗi khi thực hiện lệnh resetdb:', error);
      await interaction.editReply({ 
        content: 'Đã xảy ra lỗi khi thực hiện lệnh. Vui lòng thử lại sau.', 
        ephemeral: true 
      });
    }
  },
};
