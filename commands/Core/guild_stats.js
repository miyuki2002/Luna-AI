const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const slashCommandIntegration = require('../../services/SlashCommandIntegrationService');
const guildAgentService = require('../../services/GuildAgentService');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guild_stats')
    .setDescription('Xem thống kê Luna Guild Management Agent')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      // Get statistics from various services
      const commandStats = slashCommandIntegration.getCommandStats();
      const safetyStats = guildAgentService.getPermissionSafetyStats();
      const batchStats = guildAgentService.getBatchOperationStats();

      const statsEmbed = slashCommandIntegration.createPerformanceReport();
      
      // Add additional statistics
      statsEmbed.embeds[0].addFields(
        { name: 'Command Usage', value: `Total: ${commandStats.totalCommands}\nSuccess: ${commandStats.successfulCommands}\nFailed: ${commandStats.failedCommands}`, inline: true },
        { name: 'Safety Stats', value: `Protected: ${safetyStats.protectedUsers}\nBlacklisted: ${safetyStats.blacklistedUsers}\nCached: ${safetyStats.cachedPermissions}`, inline: true },
        { name: 'Batch Operations', value: `Queued: ${batchStats.queued}\nActive: ${batchStats.active}\nCompleted: ${batchStats.completed}`, inline: true }
      );

      await interaction.reply(statsEmbed);

    } catch (error) {
      logger.error('GUILD_STATS', 'Error in guild stats command:', error);
      await interaction.reply({ 
        content: `❌ Lỗi khi hiển thị thống kê: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
