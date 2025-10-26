const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const ImageService = require('../../services/ImageService.js');
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
    await interaction.deferReply();
    const prompt = interaction.options.getString('prompt');

    let progressTracker = null;

    try {
      progressTracker = ImageService.trackImageGenerationProgress(interaction, prompt);

      await progressTracker.update("Đang khởi tạo", 5);

      const imageResult = await ImageService.generateImage(prompt, interaction, progressTracker);
      
      if (imageResult && imageResult.buffer) {
        const attachment = new AttachmentBuilder(imageResult.buffer, { name: 'generated-image.png' });
        
        await interaction.followUp({
          files: [attachment]
        });
      } else {
        return logger.warn('IMAGE', 'Không nhận được dữ liệu hình ảnh');
      }
    } catch (error) {
      logger.error('COMMAND', 'Lỗi khi tạo hình ảnh:', error);
    }
  },
};
