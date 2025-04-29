const { SlashCommandBuilder } = require('discord.js');
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
      // Call the generateImage function from NeuralNetworks
      const imageUrl = await NeuralNetworks.generateImage(prompt);

      // Check if the response is an error message (returned as string) or a valid URL
      if (imageUrl.startsWith('http')) {
        await interaction.editReply({
          content: `🎨 Đây là bức tranh tôi vẽ theo ý tưởng của bạn: "${prompt}"`,
          files: [imageUrl]
        });
      } else {
        // If not a URL, it's probably an error message
        await interaction.editReply(`❌ ${imageUrl}`);
      }
    } catch (error) {
      logger.error('COMMAND', 'Lỗi khi tạo hình ảnh:', error);
      await interaction.editReply('Xin lỗi, tôi không thể hoàn thành bức tranh lúc này. Hãy thử lại sau nhé!');
    }
  },
};

