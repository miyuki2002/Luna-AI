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
      const imageResult = await NeuralNetworks.generateImage(prompt);

      if (typeof imageResult === 'string') {
        await interaction.editReply(`❌ ${imageResult}`);
        return;
      }
      
      // Tạo attachment từ buffer
      const attachment = new AttachmentBuilder(imageResult.buffer, { name: 'generated-image.png' });

      // Gửi ảnh dưới dạng tệp đính kèm
      await interaction.editReply({
        content: `🎨 Đây là bức tranh tôi vẽ theo ý tưởng của bạn: "${prompt}"`,
        files: [attachment]
      });
    } catch (error) {
      logger.error('COMMAND', 'Lỗi khi tạo hình ảnh:', error);
      await interaction.editReply('Xin lỗi, tôi không thể hoàn thành bức tranh lúc này. Hãy thử lại sau nhé!');
    }
  },
};
