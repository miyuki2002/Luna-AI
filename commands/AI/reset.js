const { SlashCommandBuilder } = require('discord.js');
const storageDB = require('../../services/storagedb.js');
const NeuralNetworks = require('../../services/NeuralNetworks.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Đặt lại cuộc trò chuyện với bot'),

  async execute(interaction) {
    await storageDB.clearConversationHistory(interaction.user.id, NeuralNetworks.systemPrompt, NeuralNetworks.Model);
    await interaction.reply({ content: 'Cuộc trò chuyện đã được đặt lại!', ephemeral: true });
  },
};
