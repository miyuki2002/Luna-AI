const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const CommandsJSONService = require('../../services/CommandsJSONService');
const logger = require('../../utils/logger.js');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('generatecommands')
    .setDescription('Tạo file JSON chứa thông tin tất cả lệnh của bot (chỉ dành cho owner)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const ownerId = process.env.OWNER_ID;
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ 
        content: 'Bạn không có quyền sử dụng lệnh này!', 
        ephemeral: true 
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const success = await CommandsJSONService.generateCommandsJSON();
      
      if (success) {
        const fileInfo = await CommandsJSONService.getFileInfo();
        const commandsData = await CommandsJSONService.scanCommands();
        
        await interaction.editReply({
          content: `✅ **Đã tạo file JSON thành công!**\n\n` +
                   `📁 **Thông tin:**\n` +
                   `> File: \`assets/commands.json\`\n` +
                   `> Số lệnh: **${commandsData.length}**\n` +
                   `> Kích thước: **${fileInfo?.size || 0} bytes**\n` +
                   `> Cập nhật: **${fileInfo?.modified?.toLocaleString('vi-VN') || 'N/A'}**\n\n` +
                   `🌐 **Sử dụng:**\n` +
                   `> File này có thể được sử dụng cho website\n` +
                   `> Tự động cập nhật khi khởi động bot\n` +
                   `> Format tương thích với Mai bot`
        });
      } else {
        await interaction.editReply({
          content: '❌ **Lỗi khi tạo file JSON!**\n\n' +
                   'Vui lòng kiểm tra log để biết thêm chi tiết.'
        });
      }

    } catch (error) {
      logger.error('COMMANDS_JSON', 'Lỗi khi tạo file JSON lệnh:', error);
      await interaction.editReply({
        content: '❌ **Lỗi khi tạo file JSON!**\n\n' +
                 `Lỗi: \`${error.message}\`\n` +
                 'Vui lòng kiểm tra log để biết thêm chi tiết.'
      });
    }
  },
};

