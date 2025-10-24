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
      // Gọi trực tiếp AICore thay vì qua NeuralNetworks
      const result = await AICore.getThinkingResponse(prompt);
      let response = result.content;

      // Format response
      response = response.replace(/\[THINKING\]/gi, "🤔 **Quá trình suy nghĩ:**");
      response = response.replace(/\[ANSWER\]/gi, "💡 **Câu trả lời:**");

      // Thêm thông tin provider
      const providerStatus = AICore.getProviderStatus();
      const currentProvider = providerStatus.find(p => p.current);
      response += `\n\n🔧 ${currentProvider?.name || 'Unknown'} | 🎯 ${result.usage?.total_tokens || 0} tokens`;

      if (response.length <= 2000) {
        await interaction.editReply({
          content: response
        });
      } else {
        const chunks = splitMessageRespectWords(response);

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
      logger.error('COMMAND', 'Lỗi khi xử lý câu hỏi:', error);

      const providerStatus = AICore.getProviderStatus();
      const activeProviders = providerStatus.filter(p => p.active);

      let errorMsg = 'Không thể phân tích câu hỏi này lúc này.';
      if (activeProviders.length === 0) {
        errorMsg += '\nTất cả API providers đã hết quota.';
      }
      errorMsg += '\n💭 Hãy thử lại sau nhé!';

      await interaction.editReply(errorMsg);
    }
  }
};

