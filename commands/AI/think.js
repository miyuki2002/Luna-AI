const { SlashCommandBuilder } = require('discord.js');
const NeuralNetworks = require('../../services/NeuralNetworks');
const logger = require('../../utils/logger.js');

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
      // Call the getThinkingResponse function from NeuralNetworks
      const response = await NeuralNetworks.getThinkingResponse(prompt, interaction);

      // Send the response as text, it contains thinking steps and final answer
      await interaction.editReply({
        content: response
      });
    } catch (error) {
      logger.error('COMMAND', 'Lỗi khi xử lý câu hỏi:', error);
      await interaction.editReply('Xin lỗi, tôi không thể phân tích câu hỏi này lúc này. Hãy thử lại sau nhé!');
    }
  },
};

