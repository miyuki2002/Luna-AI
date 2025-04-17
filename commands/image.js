const { SlashCommandBuilder } = require('discord.js');
const NeuralNetworks = require('../services/NeuralNetworks');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Tạo một hình ảnh dựa trên mô tả của bạn')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Mô tả hình ảnh bạn muốn tạo')
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
          content: `🖼️ Đã tạo hình ảnh cho prompt: "${prompt}"`,
          files: [imageUrl]
        });
      } else {
        // If not a URL, it's probably an error message
        await interaction.editReply(`❌ ${imageUrl}`);
      }
    } catch (error) {
      console.error('Lỗi khi tạo hình ảnh:', error);
      await interaction.editReply('Xin lỗi, đã xảy ra lỗi khi tạo hình ảnh của bạn.');
    }
  },
};
