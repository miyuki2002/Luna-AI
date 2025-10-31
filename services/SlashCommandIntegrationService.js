const { EmbedBuilder } = require('discord.js');
const guildAgentService = require('./GuildAgentService');
const moderationUtils = require('./ModerationUtilsService');
const logger = require('../utils/logger.js');

class SlashCommandIntegrationService {
  constructor() {
    this.commandAliases = this.initializeCommandAliases();
    this.commandHistory = new Map();
    this.analytics = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      commandUsage: new Map(),
      averageResponseTime: 0
    };
  }

  /**
   * Initialize command aliases
   */
  initializeCommandAliases() {
    return {
      ban: ['ban', 'cấm', 'khóa'],
      kick: ['kick', 'đuổi', 'đá'],
      mute: ['mute', 'câm', 'timeout'],
      warn: ['warn', 'cảnh cáo', 'warning'],
      unban: ['unban', 'bỏ cấm', 'unlock'],
      unmute: ['unmute', 'bỏ câm', 'unlock'],
      deleteMessages: ['delete', 'clear', 'xóa']
    };
  }

  /**
   * Handle slash command integration
   * @param {Object} interaction - Discord interaction
   * @param {string} commandName - Command name
   * @param {Object} options - Command options
   * @returns {Promise<Object>} - Integration result
   */
  async handleSlashCommand(interaction, commandName, options) {
    const startTime = Date.now();
    
    try {
      // Defer reply to give time for processing
      await interaction.deferReply({ ephemeral: false });

      // Convert slash command to natural language format
      const naturalCommand = this.convertSlashToNatural(interaction, commandName, options);
      
      // Process with Guild Agent Service
      const result = await guildAgentService.processMessage({
        ...interaction,
        content: naturalCommand.content,
        author: interaction.user,
        guild: interaction.guild,
        channel: interaction.channel,
        mentions: {
          users: naturalCommand.mentions.users,
          members: naturalCommand.mentions.members,
          roles: naturalCommand.mentions.roles,
          channels: naturalCommand.mentions.channels,
          everyone: false
        }
      });

      // Update analytics
      this.updateAnalytics(commandName, true, Date.now() - startTime);

      // Send response
      if (result.shouldRespond) {
        if (result.response && typeof result.response === 'string') {
          await interaction.editReply({ content: result.response });
        } else if (result.response && result.response.embeds) {
          await interaction.editReply({ embeds: result.response.embeds });
        } else if (result.embed) {
          await interaction.editReply({ embeds: [result.embed] });
        } else {
          await interaction.editReply({ content: 'Đã xử lý lệnh thành công!' });
        }
      } else {
        await interaction.editReply({ content: 'Lệnh đã được xử lý.' });
      }

      return {
        success: true,
        commandName: commandName,
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('SLASH_INTEGRATION', `Error handling slash command ${commandName}:`, error);
      
      // Update analytics
      this.updateAnalytics(commandName, false, Date.now() - startTime);

      // Send error response
      try {
        await interaction.editReply({ 
          content: `❌ Lỗi khi xử lý lệnh: ${error.message}` 
        });
      } catch (replyError) {
        logger.error('SLASH_INTEGRATION', 'Error sending error reply:', replyError);
      }

      return {
        success: false,
        commandName: commandName,
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Convert slash command to natural language format
   * @param {Object} interaction - Discord interaction
   * @param {string} commandName - Command name
   * @param {Object} options - Command options
   * @returns {Object} - Natural language command
   */
  convertSlashToNatural(interaction, commandName, options) {
    const mentions = {
      users: new Map(),
      members: new Map(),
      roles: new Map(),
      channels: new Map()
    };

    // Extract target user
    if (options.user) {
      const user = options.user;
      const member = interaction.guild.members.cache.get(user.id);
      
      mentions.users.set(user.id, user);
      if (member) {
        mentions.members.set(user.id, member);
      }
    }

    // Extract reason
    const reason = options.reason || 'Không có lý do được cung cấp';

    // Extract duration for mute/timeout
    let duration = null;
    if (commandName === 'mute' || commandName === 'timeout') {
      if (options.duration) {
        duration = options.duration;
      } else if (options.time) {
        duration = options.time;
      }
    }

    // Extract delete message days for ban
    let deleteMessageDays = null;
    if (commandName === 'ban' && options.days) {
      deleteMessageDays = options.days;
    }

    // Build natural language content
    let content = `${commandName} `;
    
    if (options.user) {
      content += `<@${options.user.id}> `;
    }
    
    if (duration) {
      content += `${duration} `;
    }
    
    if (reason && reason !== 'Không có lý do được cung cấp') {
      content += `vì ${reason}`;
    }

    return {
      content: content.trim(),
      mentions: mentions,
      reason: reason,
      duration: duration,
      deleteMessageDays: deleteMessageDays
    };
  }

  /**
   * Create hybrid command help
   * @param {Object} interaction - Discord interaction
   * @returns {Promise<Object>} - Help response
   */
  async createHybridHelp(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🤖 Luna Guild Management Agent - Help')
      .setDescription('Luna có thể hiểu cả lệnh slash và ngôn ngữ tự nhiên!')
      .setColor(0x5865F2)
      .addFields(
        {
          name: '📝 Slash Commands',
          value: '`/ban @user [reason]` - Cấm user\n`/kick @user [reason]` - Đuổi user\n`/mute @user [duration] [reason]` - Mute user\n`/warn @user [reason]` - Cảnh cáo user',
          inline: false
        },
        {
          name: '💬 Natural Language',
          value: '`@Luna ban @user lý do spam`\n`@Luna đuổi @user vì vi phạm`\n`@Luna câm @user 10 phút vì spam`\n`@Luna cảnh cáo @user vi phạm nội quy`',
          inline: false
        },
        {
          name: '⚡ Batch Operations',
          value: '`@Luna ban @user1 @user2 @user3 lý do spam`\n`@Luna kick @user1 @user2 vì vi phạm`',
          inline: false
        },
        {
          name: '🛡️ Safety Features',
          value: '• Tự động kiểm tra quyền\n• Bảo vệ user quan trọng\n• Rate limiting\n• Xác nhận cho hành động nguy hiểm',
          inline: false
        }
      )
      .setFooter({ text: 'Luna AI - Guild Management Agent' })
      .setTimestamp();

    return { embeds: [embed] };
  }

  /**
   * Get command usage statistics
   * @returns {Object} - Usage statistics
   */
  getCommandStats() {
    const totalCommands = this.analytics.totalCommands;
    const successRate = totalCommands > 0 ? 
      (this.analytics.successfulCommands / totalCommands * 100).toFixed(2) : 0;

    return {
      totalCommands: totalCommands,
      successfulCommands: this.analytics.successfulCommands,
      failedCommands: this.analytics.failedCommands,
      successRate: `${successRate}%`,
      averageResponseTime: `${this.analytics.averageResponseTime.toFixed(2)}ms`,
      commandUsage: Object.fromEntries(this.analytics.commandUsage)
    };
  }

  /**
   * Update analytics
   * @param {string} commandName - Command name
   * @param {boolean} success - Success status
   * @param {number} responseTime - Response time in ms
   */
  updateAnalytics(commandName, success, responseTime) {
    this.analytics.totalCommands++;
    
    if (success) {
      this.analytics.successfulCommands++;
    } else {
      this.analytics.failedCommands++;
    }

    // Update command usage
    const currentUsage = this.analytics.commandUsage.get(commandName) || 0;
    this.analytics.commandUsage.set(commandName, currentUsage + 1);

    // Update average response time
    const totalTime = this.analytics.averageResponseTime * (this.analytics.totalCommands - 1) + responseTime;
    this.analytics.averageResponseTime = totalTime / this.analytics.totalCommands;
  }

  /**
   * Get command history for user
   * @param {string} userId - User ID
   * @param {number} limit - Number of commands to return
   * @returns {Array} - Command history
   */
  getCommandHistory(userId, limit = 10) {
    const userHistory = this.commandHistory.get(userId) || [];
    return userHistory.slice(-limit);
  }

  /**
   * Add command to history
   * @param {string} userId - User ID
   * @param {Object} command - Command data
   */
  addCommandToHistory(userId, command) {
    if (!this.commandHistory.has(userId)) {
      this.commandHistory.set(userId, []);
    }

    const userHistory = this.commandHistory.get(userId);
    userHistory.push({
      ...command,
      timestamp: Date.now()
    });

    // Keep only last 50 commands per user
    if (userHistory.length > 50) {
      userHistory.shift();
    }

    this.commandHistory.set(userId, userHistory);
  }

  /**
   * Create command aliases
   * @param {string} commandName - Base command name
   * @returns {Array} - Array of aliases
   */
  getCommandAliases(commandName) {
    return this.commandAliases[commandName] || [commandName];
  }

  /**
   * Validate command parameters
   * @param {string} commandName - Command name
   * @param {Object} options - Command options
   * @returns {Object} - Validation result
   */
  validateCommandParameters(commandName, options) {
    const errors = [];

    // Check required parameters
    if (!options.user && ['ban', 'kick', 'mute', 'warn', 'unban', 'unmute'].includes(commandName)) {
      errors.push('User parameter is required');
    }

    // Validate duration for mute/timeout
    if ((commandName === 'mute' || commandName === 'timeout') && options.duration) {
      const durationValidation = moderationUtils.validateDuration(
        moderationUtils.parseDuration(options.duration), 
        commandName
      );
      if (!durationValidation.valid) {
        errors.push(durationValidation.reason);
      }
    }

    // Validate delete message days for ban
    if (commandName === 'ban' && options.days) {
      if (options.days < 0 || options.days > 7) {
        errors.push('Delete message days must be between 0 and 7');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Create command performance report
   * @returns {Object} - Performance report
   */
  createPerformanceReport() {
    const stats = this.getCommandStats();
    const guildStats = guildAgentService.getPermissionSafetyStats();
    const batchStats = guildAgentService.getBatchOperationStats();

    const embed = new EmbedBuilder()
      .setTitle('📊 Luna Performance Report')
      .setColor(0x00FF00)
      .addFields(
        { name: 'Total Commands', value: stats.totalCommands.toString(), inline: true },
        { name: 'Success Rate', value: stats.successRate, inline: true },
        { name: 'Avg Response Time', value: stats.averageResponseTime, inline: true },
        { name: 'Protected Users', value: guildStats.protectedUsers.toString(), inline: true },
        { name: 'Blacklisted Users', value: guildStats.blacklistedUsers.toString(), inline: true },
        { name: 'Batch Operations', value: batchStats.completed.toString(), inline: true }
      )
      .setTimestamp();

    return { embeds: [embed] };
  }

  /**
   * Clean up old data
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let cleanedCount = 0;

    // Clean up old command history
    for (const [userId, history] of this.commandHistory.entries()) {
      const recentHistory = history.filter(cmd => now - cmd.timestamp < maxAge);
      
      if (recentHistory.length === 0) {
        this.commandHistory.delete(userId);
        cleanedCount++;
      } else {
        this.commandHistory.set(userId, recentHistory);
      }
    }

    if (cleanedCount > 0) {
      logger.info('SLASH_INTEGRATION', `Cleaned up ${cleanedCount} old command histories`);
    }
  }
}

module.exports = new SlashCommandIntegrationService();
