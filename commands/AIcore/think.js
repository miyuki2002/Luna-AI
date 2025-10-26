const { SlashCommandBuilder } = require('discord.js');
const AICore = require('../../services/AICore');
const logger = require('../../utils/logger.js');
const { splitMessageRespectWords } = require('../../handlers/messageHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('think')
    .setDescription('Hiển thị quá trình suy nghĩ của AI khi trả lời câu hỏi của bạn')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Nhập câu hỏi hoặc vấn đề bạn muốn AI phân tích')
        .setRequired(true)),

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');

    await interaction.deferReply();

    try {
      // Kiểm tra token limit trước khi xử lý
      const MessageService = require('../../services/TokenService.js');
      const userId = interaction.user.id;
      const messageCheck = await MessageService.canUseMessages(userId, 1);

      if (!messageCheck.allowed) {
        const roleNames = {
          user: 'Người dùng',
          helper: 'Helper',
          admin: 'Admin',
          owner: 'Owner'
        };
        
        await interaction.editReply(
          `**Giới hạn Lượt nhắn tin**\n\n` +
          `Bạn đã sử dụng hết giới hạn lượt nhắn tin hàng ngày!\n\n` +
          `**Thông tin:**\n` +
          `• Vai trò: ${roleNames[messageCheck.role] || messageCheck.role}\n` +
          `• Đã sử dụng: ${messageCheck.current.toLocaleString()} lượt\n` +
          `• Giới hạn: ${messageCheck.limit.toLocaleString()} lượt/ngày\n` +
          `• Còn lại: ${messageCheck.remaining.toLocaleString()} lượt\n\n` +
          `Giới hạn sẽ được reset vào ngày mai. Vui lòng quay lại sau!`
        );
        return;
      }

      const result = await AICore.getThinkingResponse(prompt);
      let response = result.content;

      // Ghi nhận message usage
      if (result.usage && result.usage.total_tokens) {
        await MessageService.recordMessageUsage(userId, 1, 'think');
      }

      if (response.length <= 2000) {
        await interaction.editReply({
          content: response
        });
      } else {
        const chunks = splitMessageRespectWords(response, 2000);

        await interaction.editReply({
          content: chunks[0]
        });

        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp({
            content: chunks[i]
          });
        }
      }
    } catch (error) {
      logger.error('COMMAND', 'Lỗi khi xử lý lệnh /think:', error);

      let errorMsg = '💭 Không thể phân tích câu hỏi này lúc này.';
      
      if (error.message.includes('Không có API provider nào được cấu hình')) {
        errorMsg += '\n\nHệ thống AI hiện tại không khả dụng.';
      } else if (error.message.includes('Tất cả providers đã thất bại')) {
        errorMsg += '\n\nTất cả nhà cung cấp AI đều không khả dụng.';
      } else if (error.message.includes('timeout')) {
        errorMsg += '\n\nYêu cầu bị timeout. Vui lòng thử lại.';
      } else {
        errorMsg += '\n\nVui lòng thử lại sau hoặc liên hệ admin để được hỗ trợ.';
      }
      
      errorMsg += '\n\nGợi ý: Thử sử dụng lệnh `@Luna` thay thế!';

      await interaction.editReply(errorMsg);
    }
  }
};

