const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const storageDB = require('../services/storagedb.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetdb')
    .setDescription('Xóa và tạo lại cơ sở dữ liệu (chỉ dành cho admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Kiểm tra quyền admin
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ 
        content: 'Bạn không có quyền sử dụng lệnh này. Chỉ admin mới có thể reset cơ sở dữ liệu.', 
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
