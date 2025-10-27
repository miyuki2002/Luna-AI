const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger.js');

class AutoModerationService {
  constructor() {
    this.rules = new Map();
    this.eventListeners = new Map();
    this.thresholds = this.initializeThresholds();
    this.patterns = this.initializePatterns();
    this.mlPipeline = null; // Placeholder for ML pipeline
  }

  /**
   * Initialize auto-moderation thresholds
   */
  initializeThresholds() {
    return {
      spam: {
        maxMessages: 5,
        timeWindow: 10000, // 10 seconds
        action: 'mute',
        duration: 300000 // 5 minutes
      },
      raid: {
        maxMentions: 5,
        timeWindow: 5000, // 5 seconds
        action: 'timeout',
        duration: 600000 // 10 minutes
      },
      scam: {
        confidence: 0.8,
        action: 'ban',
        duration: 'permanent'
      },
      toxicity: {
        confidence: 0.7,
        action: 'warn',
        duration: null
      }
    };
  }

  /**
   * Initialize detection patterns
   */
  initializePatterns() {
    return {
      spam: [
        /(.)\1{4,}/g, // Repeated characters
        /(.)\s*\1\s*\1\s*\1\s*\1/g, // Repeated words with spaces
        /(.){20,}/g // Very long messages
      ],
      raid: [
        /@everyone/g,
        /@here/g,
        /<@&(\d+)>/g // Role mentions
      ],
      scam: [
        /discord\.gg\/[a-zA-Z0-9]+/g, // Discord invite links
        /bit\.ly\/[a-zA-Z0-9]+/g, // Shortened URLs
        /tinyurl\.com\/[a-zA-Z0-9]+/g,
        /(free|gift|prize|win|click|here)/gi
      ],
      toxicity: [
        /(fuck|shit|damn|bitch|asshole)/gi,
        /(idiot|stupid|dumb|retard)/gi,
        /(kill|die|suicide)/gi
      ]
    };
  }

  /**
   * Initialize auto-moderation for a guild
   * @param {string} guildId - Guild ID
   * @param {Object} config - Configuration
   */
  initializeGuild(guildId, config = {}) {
    const defaultConfig = {
      enabled: true,
      rules: {
        spam: { enabled: true, ...this.thresholds.spam },
        raid: { enabled: true, ...this.thresholds.raid },
        scam: { enabled: true, ...this.thresholds.scam },
        toxicity: { enabled: true, ...this.thresholds.toxicity }
      },
      whitelist: [],
      blacklist: [],
      logChannel: null
    };

    this.rules.set(guildId, { ...defaultConfig, ...config });
    logger.info('AUTO_MOD', `Initialized auto-moderation for guild ${guildId}`);
  }

  /**
   * Process message for auto-moderation
   * @param {Object} message - Discord message
   * @returns {Promise<Object>} - Processing result
   */
  async processMessage(message) {
    if (message.author.bot || !message.guild) {
      return { action: null, reason: 'Not applicable' };
    }

    const guildConfig = this.rules.get(message.guild.id);
    if (!guildConfig || !guildConfig.enabled) {
      return { action: null, reason: 'Auto-moderation disabled' };
    }

    // Check whitelist
    if (guildConfig.whitelist.includes(message.author.id)) {
      return { action: null, reason: 'User whitelisted' };
    }

    // Check blacklist
    if (guildConfig.blacklist.includes(message.author.id)) {
      return { action: 'ban', reason: 'User blacklisted', confidence: 1.0 };
    }

    // Process each rule
    for (const [ruleName, ruleConfig] of Object.entries(guildConfig.rules)) {
      if (!ruleConfig.enabled) continue;

      const result = await this.checkRule(message, ruleName, ruleConfig);
      if (result.triggered) {
        return result;
      }
    }

    return { action: null, reason: 'No rules triggered' };
  }

  /**
   * Check specific rule
   * @param {Object} message - Discord message
   * @param {string} ruleName - Rule name
   * @param {Object} ruleConfig - Rule configuration
   * @returns {Promise<Object>} - Rule check result
   */
  async checkRule(message, ruleName, ruleConfig) {
    switch (ruleName) {
      case 'spam':
        return await this.checkSpamRule(message, ruleConfig);
      case 'raid':
        return await this.checkRaidRule(message, ruleConfig);
      case 'scam':
        return await this.checkScamRule(message, ruleConfig);
      case 'toxicity':
        return await this.checkToxicityRule(message, ruleConfig);
      default:
        return { triggered: false, reason: 'Unknown rule' };
    }
  }

  /**
   * Check spam rule
   * @param {Object} message - Discord message
   * @param {Object} ruleConfig - Rule configuration
   * @returns {Promise<Object>} - Spam check result
   */
  async checkSpamRule(message, ruleConfig) {
    const userId = message.author.id;
    const now = Date.now();
    
    // Get user message history
    if (!this.eventListeners.has(userId)) {
      this.eventListeners.set(userId, []);
    }
    
    const userMessages = this.eventListeners.get(userId);
    
    // Add current message
    userMessages.push({
      content: message.content,
      timestamp: now,
      channelId: message.channel.id
    });
    
    // Clean old messages
    const cutoff = now - ruleConfig.timeWindow;
    const recentMessages = userMessages.filter(msg => msg.timestamp > cutoff);
    this.eventListeners.set(userId, recentMessages);
    
    // Check if exceeds threshold
    if (recentMessages.length >= ruleConfig.maxMessages) {
      return {
        triggered: true,
        action: ruleConfig.action,
        duration: ruleConfig.duration,
        reason: `Spam detected: ${recentMessages.length} messages in ${ruleConfig.timeWindow / 1000}s`,
        confidence: 0.9
      };
    }
    
    return { triggered: false, reason: 'Spam threshold not exceeded' };
  }

  /**
   * Check raid rule
   * @param {Object} message - Discord message
   * @param {Object} ruleConfig - Rule configuration
   * @returns {Promise<Object>} - Raid check result
   */
  async checkRaidRule(message, ruleConfig) {
    const mentionCount = (message.content.match(/@everyone|@here|<@!?\d+>/g) || []).length;
    
    if (mentionCount >= ruleConfig.maxMentions) {
      return {
        triggered: true,
        action: ruleConfig.action,
        duration: ruleConfig.duration,
        reason: `Raid detected: ${mentionCount} mentions`,
        confidence: 0.95
      };
    }
    
    return { triggered: false, reason: 'Raid threshold not exceeded' };
  }

  /**
   * Check scam rule
   * @param {Object} message - Discord message
   * @param {Object} ruleConfig - Rule configuration
   * @returns {Promise<Object>} - Scam check result
   */
  async checkScamRule(message, ruleConfig) {
    let confidence = 0;
    let detectedPatterns = [];
    
    for (const pattern of this.patterns.scam) {
      const matches = message.content.match(pattern);
      if (matches) {
        confidence += 0.3;
        detectedPatterns.push(pattern.source);
      }
    }
    
    // Check for suspicious URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = message.content.match(urlRegex) || [];
    if (urls.length > 0) {
      confidence += 0.2;
      detectedPatterns.push('suspicious_urls');
    }
    
    if (confidence >= ruleConfig.confidence) {
      return {
        triggered: true,
        action: ruleConfig.action,
        duration: ruleConfig.duration,
        reason: `Scam detected: ${detectedPatterns.join(', ')}`,
        confidence: confidence
      };
    }
    
    return { triggered: false, reason: 'Scam confidence too low' };
  }

  /**
   * Check toxicity rule
   * @param {Object} message - Discord message
   * @param {Object} ruleConfig - Rule configuration
   * @returns {Promise<Object>} - Toxicity check result
   */
  async checkToxicityRule(message, ruleConfig) {
    let confidence = 0;
    let detectedPatterns = [];
    
    for (const pattern of this.patterns.toxicity) {
      const matches = message.content.match(pattern);
      if (matches) {
        confidence += 0.2;
        detectedPatterns.push(pattern.source);
      }
    }
    
    if (confidence >= ruleConfig.confidence) {
      return {
        triggered: true,
        action: ruleConfig.action,
        duration: ruleConfig.duration,
        reason: `Toxicity detected: ${detectedPatterns.join(', ')}`,
        confidence: confidence
      };
    }
    
    return { triggered: false, reason: 'Toxicity confidence too low' };
  }

  /**
   * Execute auto-moderation action
   * @param {Object} message - Discord message
   * @param {Object} result - Auto-moderation result
   * @returns {Promise<Object>} - Execution result
   */
  async executeAction(message, result) {
    try {
      const guildConfig = this.rules.get(message.guild.id);
      if (!guildConfig) {
        throw new Error('Guild configuration not found');
      }

      // Create moderation message
      const moderationMessage = {
        ...message,
        content: `${result.action} @${message.author.username} ${result.reason}`,
        author: message.client.user,
        mentions: {
          users: new Map([[message.author.id, message.author]]),
          members: new Map([[message.author.id, message.member]]),
          roles: new Map(),
          channels: new Map(),
          everyone: false
        }
      };

      // Use Guild Agent Service to execute action
      const guildAgentService = require('./GuildAgentService');
      const executionResult = await guildAgentService.processMessage(moderationMessage);

      // Log auto-moderation action
      await this.logAutoModAction(message, result, executionResult);

      return executionResult;

    } catch (error) {
      logger.error('AUTO_MOD', 'Error executing auto-moderation action:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Log auto-moderation action
   * @param {Object} message - Original message
   * @param {Object} result - Auto-moderation result
   * @param {Object} executionResult - Execution result
   */
  async logAutoModAction(message, result, executionResult) {
    try {
      const guildConfig = this.rules.get(message.guild.id);
      if (!guildConfig.logChannel) return;

      const logChannel = message.guild.channels.cache.get(guildConfig.logChannel);
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('🤖 Auto-Moderation Action')
        .setDescription(`Tự động thực hiện hành động: **${result.action}**`)
        .addFields(
          { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Reason', value: result.reason, inline: false },
          { name: 'Confidence', value: `${(result.confidence * 100).toFixed(1)}%`, inline: true },
          { name: 'Success', value: executionResult.success ? '✅' : '❌', inline: true }
        )
        .setColor(executionResult.success ? 0x00FF00 : 0xFF0000)
        .setTimestamp();

      if (executionResult.error) {
        embed.addFields({ name: 'Error', value: executionResult.error, inline: false });
      }

      await logChannel.send({ embeds: [embed] });

    } catch (error) {
      logger.error('AUTO_MOD', 'Error logging auto-moderation action:', error);
    }
  }

  /**
   * Update guild configuration
   * @param {string} guildId - Guild ID
   * @param {Object} config - New configuration
   */
  updateGuildConfig(guildId, config) {
    const currentConfig = this.rules.get(guildId) || {};
    const newConfig = { ...currentConfig, ...config };
    this.rules.set(guildId, newConfig);
    logger.info('AUTO_MOD', `Updated configuration for guild ${guildId}`);
  }

  /**
   * Get guild configuration
   * @param {string} guildId - Guild ID
   * @returns {Object} - Guild configuration
   */
  getGuildConfig(guildId) {
    return this.rules.get(guildId) || null;
  }

  /**
   * Add user to whitelist
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   */
  addToWhitelist(guildId, userId) {
    const config = this.rules.get(guildId);
    if (config && !config.whitelist.includes(userId)) {
      config.whitelist.push(userId);
      this.rules.set(guildId, config);
    }
  }

  /**
   * Remove user from whitelist
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   */
  removeFromWhitelist(guildId, userId) {
    const config = this.rules.get(guildId);
    if (config) {
      config.whitelist = config.whitelist.filter(id => id !== userId);
      this.rules.set(guildId, config);
    }
  }

  /**
   * Add user to blacklist
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   */
  addToBlacklist(guildId, userId) {
    const config = this.rules.get(guildId);
    if (config && !config.blacklist.includes(userId)) {
      config.blacklist.push(userId);
      this.rules.set(guildId, config);
    }
  }

  /**
   * Remove user from blacklist
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   */
  removeFromBlacklist(guildId, userId) {
    const config = this.rules.get(guildId);
    if (config) {
      config.blacklist = config.blacklist.filter(id => id !== userId);
      this.rules.set(guildId, config);
    }
  }

  /**
   * Get auto-moderation statistics
   * @param {string} guildId - Guild ID
   * @returns {Object} - Statistics
   */
  getStats(guildId) {
    const config = this.rules.get(guildId);
    if (!config) return null;

    return {
      enabled: config.enabled,
      rules: Object.keys(config.rules).length,
      whitelistSize: config.whitelist.length,
      blacklistSize: config.blacklist.length,
      hasLogChannel: !!config.logChannel
    };
  }

  /**
   * Clean up old data
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    let cleanedCount = 0;

    for (const [userId, messages] of this.eventListeners.entries()) {
      const recentMessages = messages.filter(msg => now - msg.timestamp < maxAge);
      
      if (recentMessages.length === 0) {
        this.eventListeners.delete(userId);
        cleanedCount++;
      } else {
        this.eventListeners.set(userId, recentMessages);
      }
    }

    if (cleanedCount > 0) {
      logger.info('AUTO_MOD', `Cleaned up ${cleanedCount} old message histories`);
    }
  }
}

module.exports = new AutoModerationService();
