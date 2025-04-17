const { SlashCommandBuilder } = require('discord.js');
const storageDB = require('../services/storagedb.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Đặt lại cuộc trò chuyện với bot'),
  
  async execute(interaction) {
    await storageDB.clearConversationHistory(message.author.id, this.systemPrompt, this.Model);
    interaction.reply({ content: 'Cuộc trò chuyện đã được đặt lại!', ephemeral: true });
  },
};
