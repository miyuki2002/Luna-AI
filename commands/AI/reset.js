const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const storageDB = require('../../services/storagedb.js');
const NeuralNetworks = require('../../services/NeuralNetworks.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Xóa lịch sử trò chuyện của chúng ta'),

  async execute(interaction) {
    await storageDB.clearConversationHistory(interaction.user.id, NeuralNetworks.systemPrompt, NeuralNetworks.Model);
    await interaction.reply({ content: 'Tôi đã quên hết những cuộc trò chuyện trước đây của chúng ta rồi. Chúng ta có thể bắt đầu lại từ đầu!', flags: MessageFlags.Ephemeral });
  },
};
