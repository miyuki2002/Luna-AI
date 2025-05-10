const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const NeuralNetworks = require('../../services/NeuralNetworks');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Vẽ một hình ảnh từ trí tưởng tượng của bạn')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Hãy mô tả bức tranh bạn muốn tôi vẽ')
        .setRequired(true)),

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');

    await interaction.deferReply();

    try {
      await interaction.editReply(`🔍 Đang tạo hình ảnh với chủ đề: "${prompt}". Quá trình này có thể mất từ 10-30 giây...`);
      
      const imageResult = await NeuralNetworks.generateImage(prompt);
      
      // Tạo attachment từ buffer
      const attachment = new AttachmentBuilder(imageResult.buffer, { name: 'generated-image.png' });

      // Chuẩn bị nội dung phản hồi
      let replyContent = `🎨 Bức tranh từ "${prompt}"`;
      
      // Thêm thông tin về nguồn nếu có
      if (imageResult.source) {
        replyContent += ` (${imageResult.source})`;
      }

      // Gửi ảnh dưới dạng tệp đính kèm
      await interaction.editReply({
        content: replyContent,
        files: [attachment]
      });
    } catch (error) {
      logger.error('COMMAND', 'Lỗi khi tạo hình ảnh:', error);
      
      let errorMessage = '❌ Không thể tạo hình ảnh. ';
      
      // Xử lý trường hợp lỗi cụ thể liên quan đến Hugging Face space
      if (error.message && error.message.includes('NOT_FOUND')) {
        errorMessage += 'Không tìm thấy Gradio Space. Vui lòng kiểm tra cài đặt HF_TOKEN và GRADIO_IMAGE_SPACE trong file .env.';
      } else if (error.message && error.message.includes('AUTH_ERROR')) {
        errorMessage += 'HF_TOKEN không hợp lệ hoặc không có quyền truy cập. Vui lòng kiểm tra token trong file .env.';
      } else if (error.message && error.message.includes('content moderation') || 
                error.message && error.message.includes('safety') || 
                error.message && error.message.includes('inappropriate')) {
        errorMessage += 'Nội dung yêu cầu không tuân thủ nguyên tắc kiểm duyệt. Vui lòng thử chủ đề khác.';
      } else if (error.message && error.message.includes('API endpoint')) {
        errorMessage += 'Không tìm thấy API endpoint phù hợp trong Gradio Space. Space có thể đã thay đổi cấu trúc hoặc đang offline.';
      } else {
        errorMessage += 'Chi tiết lỗi: ' + error.message;
      }
      
      await interaction.editReply(errorMessage);
    }
  },
};
