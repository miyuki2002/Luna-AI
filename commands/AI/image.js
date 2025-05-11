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
    await interaction.deferReply();
    const prompt = interaction.options.getString('prompt');
    
    let progressTracker = null;
    
    try {
      progressTracker = NeuralNetworks.trackImageGenerationProgress(interaction, prompt);

      await progressTracker.update("Đang khởi tạo", 5);

      const imageResult = await NeuralNetworks.generateImage(prompt, interaction, progressTracker);
      
      const attachment = new AttachmentBuilder(imageResult.buffer, { name: 'generated-image.png' });
      
      await interaction.followUp({
        files: [attachment]
      });
    } catch (error) {
      logger.error('COMMAND', 'Lỗi khi tạo hình ảnh:', error);
      
      try {
        if (progressTracker && typeof progressTracker.error === 'function') {
          await progressTracker.error(`Lỗi khi tạo hình ảnh: ${error.message}`);
        } else {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Đã xảy ra lỗi khi tạo hình ảnh!', ephemeral: true });
          } else if (interaction.deferred) {
            await interaction.editReply('Đã xảy ra lỗi khi tạo hình ảnh!');
          } else {
            await interaction.followUp({ content: 'Đã xảy ra lỗi khi tạo hình ảnh!', ephemeral: true });
          }
        }
      } catch (followupError) {
        logger.error('COMMAND', 'Lỗi khi hiển thị thông báo lỗi:', followupError);
      }
    }
  },
};
