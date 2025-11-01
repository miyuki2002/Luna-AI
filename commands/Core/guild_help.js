const { SlashCommandBuilder } = require('discord.js');
const slashCommandIntegration = require('../../services/SlashCommandIntegrationService');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guild_help')
    .setDescription('Hiển thị hướng dẫn sử dụng Luna Guild Management Agent'),

  async execute(interaction) {
    try {
      const helpResponse = await slashCommandIntegration.createHybridHelp(interaction);
      await interaction.reply(helpResponse);

    } catch (error) {
      logger.error('GUILD_HELP', 'Error in guild help command:', error);
      await interaction.reply({ 
        content: `❌ Lỗi khi hiển thị hướng dẫn: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
