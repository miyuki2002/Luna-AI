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

    try {
      // Không cần deferReply và editReply vì progressTracker sẽ xử lý việc hiển thị tiến trình
      // Truyền đối tượng interaction vào generateImage để hiển thị tiến trình
      const imageResult = await NeuralNetworks.generateImage(prompt, interaction);
      
      // Tạo attachment từ buffer
      const attachment = new AttachmentBuilder(imageResult.buffer, { name: 'generated-image.png' });

      // Chuẩn bị nội dung phản hồi
      let replyContent = `🎨 Bức tranh theo ý bạn.\n\n > "${prompt}"`;
      
      // Gửi ảnh dưới dạng tệp đính kèm - không cần editReply vì progressTracker đã tạo thông báo ban đầu
      // Dùng followUp để gửi thêm một tin nhắn mới
      await interaction.followUp({
        content: replyContent,
        files: [attachment]
      });
    } catch (error) {
      logger.error('COMMAND', 'Lỗi khi tạo hình ảnh:', error);
      
    }
  },
};
