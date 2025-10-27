const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const AICore = require('./AICore');
const naturalLanguageProcessor = require('./NaturalLanguageProcessor');
const moderationUtils = require('./ModerationUtilsService');
const batchOperationService = require('./BatchOperationService');
const permissionSafetyService = require('./PermissionSafetyService');
const logger = require('../utils/logger.js');
const { sendEmbedWithFallback } = require('../utils/permissionUtils');

class GuildAgentService {
  constructor() {
    this.commandConfidenceThreshold = 0.8;
    this.maxBatchSize = 10;
    this.confirmationTimeout = 30000; // 30 seconds
    this.undoWindow = 5 * 60 * 1000; // 5 minutes
    
    // Action registry
    this.actions = {
      ban: this.banUser.bind(this),
      kick: this.kickUser.bind(this),
      mute: this.muteUser.bind(this),
      warn: this.warnUser.bind(this),
      deleteMessages: this.deleteMessages.bind(this),
      unban: this.unbanUser.bind(this),
      unmute: this.unmuteUser.bind(this)
    };

    // Conversation memory
    this.conversationMemory = new Map();
    
    // Pending confirmations
    this.pendingConfirmations = new Map();
    
    // Recent actions for undo
    this.recentActions = new Map();
    
    logger.info('GUILD_AGENT', 'GuildAgentService initialized');
  }

  /**
   * Parse natural language command từ tin nhắn
   * @param {Object} message - Discord message object
   * @returns {Promise<Object>} - Parsed command result
   */
  async parseNaturalCommand(message) {
    try {
      // Get conversation context
      const context = this.getConversationContext(message.author.id);
      
      // Use Natural Language Processor
      const parsedCommand = await naturalLanguageProcessor.analyzeCommand(
        message.content, 
        message, 
        context
      );
      
      // Validate confidence threshold
      if (parsedCommand.confidence < this.commandConfidenceThreshold) {
        return {
          mode: 'CHAT_MODE',
          confidence: parsedCommand.confidence,
          reason: 'Confidence too low for command execution'
        };
      }

      // Validate action exists
      if (parsedCommand.action && !this.actions[parsedCommand.action]) {
        return {
          mode: 'CHAT_MODE',
          confidence: parsedCommand.confidence,
          reason: 'Unknown action type'
        };
      }

      // Store in conversation memory
      this.updateConversationContext(message.author.id, parsedCommand);

      return parsedCommand;

    } catch (error) {
      logger.error('GUILD_AGENT', 'Error parsing natural command:', error);
      return {
        mode: 'CHAT_MODE',
        confidence: 0,
        reason: 'Error parsing command'
      };
    }
  }

  /**
   * Build AI prompt cho command parsing
   * @param {Object} message - Discord message object
   * @returns {string} - AI prompt
   */
  buildCommandPrompt(message) {
    const mentions = this.extractMentions(message);
    const content = message.content;
    
    return `Bạn là Luna AI - một Guild Management Agent thông minh. 

Nhiệm vụ: Phân tích tin nhắn để xác định xem có phải lệnh moderation không.

Các hành động được hỗ trợ:
- ban: cấm, ban, khóa tài khoản, đuổi vĩnh viễn
- kick: kick, đuổi, đá đít, loại bỏ tạm thời  
- mute: mute, câm, khóa mõm, im lặng, timeout
- warn: warn, cảnh cáo, nhắc nhở
- deleteMessages: xóa tin nhắn, clear messages
- unban: unban, bỏ cấm, mở khóa
- unmute: unmute, bỏ câm, mở mõm

Trả về JSON format:
{
  "mode": "COMMAND_MODE|CHAT_MODE|CONFIRMATION_MODE",
  "action": "ban|kick|mute|warn|deleteMessages|unban|unmute|null",
  "targets": ["@user1", "@user2"],
  "reason": "lý do nếu có",
  "duration": "5 phút|2 giờ|1 ngày|vĩnh viễn|null",
  "confidence": 0.0-1.0,
  "explanation": "giải thích tại sao phân tích như vậy",
  "requiresConfirmation": true|false
}

Tin nhắn cần phân tích: "${content}"
Mentions trong tin nhắn: ${mentions.map(m => `@${m.username}`).join(', ') || 'Không có'}

Phân tích:`;
  }

  /**
   * Parse AI response thành command object
   * @param {string} aiResponse - AI response
   * @returns {Object} - Parsed command
   */
  parseAIResponse(aiResponse) {
    try {
      // Extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const result = JSON.parse(jsonMatch[0]);
      
      // Validate and set defaults
      return {
        mode: result.mode || 'CHAT_MODE',
        action: result.action || null,
        targets: result.targets || [],
        reason: result.reason || 'Không có lý do',
        duration: result.duration || null,
        confidence: Math.max(0, Math.min(1, result.confidence || 0)),
        explanation: result.explanation || 'Không có giải thích',
        requiresConfirmation: result.requiresConfirmation || false
      };

    } catch (error) {
      logger.error('GUILD_AGENT', 'Error parsing AI response:', error);
      return {
        mode: 'CHAT_MODE',
        action: null,
        targets: [],
        reason: 'Không có lý do',
        duration: null,
        confidence: 0,
        explanation: 'Lỗi parse AI response',
        requiresConfirmation: false
      };
    }
  }

  /**
   * Extract mentions từ tin nhắn
   * @param {Object} message - Discord message object
   * @returns {Array} - Array of mentioned users
   */
  extractMentions(message) {
    const mentions = [];
    
    // User mentions
    message.mentions.users.forEach(user => {
      const member = message.guild?.members.cache.get(user.id);
      mentions.push({
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        user: user,
        member: member
      });
    });

    return mentions;
  }

  /**
   * Validate permissions cho user thực hiện action
   * @param {Object} user - User object
   * @param {string} action - Action type
   * @param {Object} message - Message object
   * @returns {Promise<Object>} - Permission validation result
   */
  async validatePermissions(user, action, message) {
    try {
      // Use PermissionSafetyService for comprehensive validation
      const userPermissionCheck = await permissionSafetyService.validateUserPermissions(user, action, message);
      if (!userPermissionCheck.allowed) {
        return userPermissionCheck;
      }

      // Check bot permissions
      const botMember = message.guild.members.me;
      if (!botMember) {
        return { allowed: false, reason: 'Bot not found in guild' };
      }

      const requiredPermissions = {
        ban: [PermissionFlagsBits.BanMembers],
        kick: [PermissionFlagsBits.KickMembers],
        mute: [PermissionFlagsBits.ModerateMembers],
        warn: [PermissionFlagsBits.ModerateMembers],
        deleteMessages: [PermissionFlagsBits.ManageMessages],
        unban: [PermissionFlagsBits.BanMembers],
        unmute: [PermissionFlagsBits.ModerateMembers]
      };

      const permissions = requiredPermissions[action] || [];
      for (const permission of permissions) {
        if (!botMember.permissions.has(permission)) {
          return { 
            allowed: false, 
            reason: `Bot missing permission: ${permission}` 
          };
        }
      }

      return { allowed: true, reason: 'All permissions valid' };

    } catch (error) {
      logger.error('GUILD_AGENT', 'Error validating permissions:', error);
      return { allowed: false, reason: 'Error checking permissions' };
    }
  }

  /**
   * Execute moderation action
   * @param {string} action - Action type
   * @param {Array} targets - Target users
   * @param {Object} params - Action parameters
   * @param {Object} message - Original message
   * @returns {Promise<Object>} - Execution result
   */
  async executeAction(action, targets, params, message) {
    try {
      const actionFunction = this.actions[action];
      if (!actionFunction) {
        throw new Error(`Unknown action: ${action}`);
      }

      const results = [];
      const startTime = Date.now();

      // Execute action for each target
      for (const target of targets) {
        try {
          // Validate target safety
          const safetyCheck = permissionSafetyService.validateTargetSafety(target, message, action);
          if (!safetyCheck.allowed) {
            results.push({
              target: target,
              success: false,
              error: safetyCheck.reason,
              timestamp: Date.now()
            });
            continue;
          }

          const result = await actionFunction(target, params, message);
          results.push({
            target: target,
            success: true,
            result: result,
            timestamp: Date.now()
          });

          // Log successful action
          await this.logAction({
            guildId: message.guild.id,
            moderatorId: message.author.id,
            action: action,
            targetId: target.id,
            reason: params.reason,
            success: true,
            duration: Date.now() - startTime
          });

        } catch (error) {
          results.push({
            target: target,
            success: false,
            error: error.message,
            timestamp: Date.now()
          });

          // Log failed action
          await this.logAction({
            guildId: message.guild.id,
            moderatorId: message.author.id,
            action: action,
            targetId: target.id,
            reason: params.reason,
            success: false,
            error: error.message,
            duration: Date.now() - startTime
          });
        }
      }

      // Store for undo functionality
      this.storeRecentAction(message.author.id, {
        action: action,
        targets: targets,
        params: params,
        results: results,
        timestamp: Date.now()
      });

      return {
        success: true,
        results: results,
        duration: Date.now() - startTime
      };

    } catch (error) {
      logger.error('GUILD_AGENT', `Error executing action ${action}:`, error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Ban user
   * @param {Object} target - Target user
   * @param {Object} params - Action parameters
   * @param {Object} message - Original message
   * @returns {Promise<Object>} - Ban result
   */
  async banUser(target, params, message) {
    const member = message.guild.members.cache.get(target.id);
    if (!member) {
      throw new Error(`User ${target.displayName} not found in guild`);
    }

    const duration = this.parseDuration(params.duration);
    const reason = `${params.reason} - Banned by ${message.author.tag}`;

    await member.ban({ 
      reason: reason,
      deleteMessageDays: duration === 'permanent' ? 7 : 0
    });

    return {
      action: 'ban',
      target: target.displayName,
      reason: params.reason,
      duration: duration
    };
  }

  /**
   * Kick user
   * @param {Object} target - Target user
   * @param {Object} params - Action parameters
   * @param {Object} message - Original message
   * @returns {Promise<Object>} - Kick result
   */
  async kickUser(target, params, message) {
    const member = message.guild.members.cache.get(target.id);
    if (!member) {
      throw new Error(`User ${target.displayName} not found in guild`);
    }

    const reason = `${params.reason} - Kicked by ${message.author.tag}`;
    await member.kick(reason);

    return {
      action: 'kick',
      target: target.displayName,
      reason: params.reason
    };
  }

  /**
   * Mute user
   * @param {Object} target - Target user
   * @param {Object} params - Action parameters
   * @param {Object} message - Original message
   * @returns {Promise<Object>} - Mute result
   */
  async muteUser(target, params, message) {
    const member = message.guild.members.cache.get(target.id);
    if (!member) {
      throw new Error(`User ${target.displayName} not found in guild`);
    }

    const duration = this.parseDuration(params.duration);
    const reason = `${params.reason} - Muted by ${message.author.tag}`;

    if (duration === 'permanent') {
      throw new Error('Permanent mute not supported, use ban instead');
    }

    const timeoutMs = duration * 60 * 1000; // Convert minutes to milliseconds
    await member.timeout(timeoutMs, reason);

    return {
      action: 'mute',
      target: target.displayName,
      reason: params.reason,
      duration: `${duration} phút`
    };
  }

  /**
   * Warn user
   * @param {Object} target - Target user
   * @param {Object} params - Action parameters
   * @param {Object} message - Original message
   * @returns {Promise<Object>} - Warn result
   */
  async warnUser(target, params, message) {
    const member = message.guild.members.cache.get(target.id);
    if (!member) {
      throw new Error(`User ${target.displayName} not found in guild`);
    }

    // Send DM warning
    try {
      const warnEmbed = new EmbedBuilder()
        .setTitle('⚠️ Cảnh báo từ Moderation')
        .setDescription(`Bạn đã nhận được cảnh báo từ **${message.guild.name}**`)
        .addFields(
          { name: 'Lý do', value: params.reason, inline: false },
          { name: 'Người cảnh báo', value: message.author.tag, inline: true },
          { name: 'Thời gian', value: new Date().toLocaleString('vi-VN'), inline: true }
        )
        .setColor(0xFFA500)
        .setTimestamp();

      await member.send({ embeds: [warnEmbed] });
    } catch (dmError) {
      logger.warn('GUILD_AGENT', `Could not send DM to ${target.displayName}:`, dmError.message);
    }

    return {
      action: 'warn',
      target: target.displayName,
      reason: params.reason
    };
  }

  /**
   * Delete messages
   * @param {Object} target - Target user
   * @param {Object} params - Action parameters
   * @param {Object} message - Original message
   * @returns {Promise<Object>} - Delete result
   */
  async deleteMessages(target, params, message) {
    const count = params.count || 10;
    const channel = message.channel;
    
    let deletedCount = 0;
    const messages = await channel.messages.fetch({ limit: 100 });
    
    for (const msg of messages.values()) {
      if (msg.author.id === target.id && !msg.deleted) {
        try {
          await msg.delete();
          deletedCount++;
          if (deletedCount >= count) break;
        } catch (error) {
          logger.warn('GUILD_AGENT', `Could not delete message ${msg.id}:`, error.message);
        }
      }
    }

    return {
      action: 'deleteMessages',
      target: target.displayName,
      count: deletedCount
    };
  }

  /**
   * Unban user
   * @param {Object} target - Target user
   * @param {Object} params - Action parameters
   * @param {Object} message - Original message
   * @returns {Promise<Object>} - Unban result
   */
  async unbanUser(target, params, message) {
    const reason = `${params.reason} - Unbanned by ${message.author.tag}`;
    await message.guild.members.unban(target.id, reason);

    return {
      action: 'unban',
      target: target.displayName,
      reason: params.reason
    };
  }

  /**
   * Unmute user
   * @param {Object} target - Target user
   * @param {Object} params - Action parameters
   * @param {Object} message - Original message
   * @returns {Promise<Object>} - Unmute result
   */
  async unmuteUser(target, params, message) {
    const member = message.guild.members.cache.get(target.id);
    if (!member) {
      throw new Error(`User ${target.displayName} not found in guild`);
    }

    const reason = `${params.reason} - Unmuted by ${message.author.tag}`;
    await member.timeout(null, reason);

    return {
      action: 'unmute',
      target: target.displayName,
      reason: params.reason
    };
  }

  /**
   * Parse duration string to minutes
   * @param {string} duration - Duration string
   * @returns {number|string} - Duration in minutes or 'permanent'
   */
  parseDuration(duration) {
    const parsed = moderationUtils.parseDuration(duration);
    return parsed.minutes;
  }

  /**
   * Log action for audit trail
   * @param {Object} logData - Log data
   */
  async logAction(logData) {
    try {
      logger.info('GUILD_AGENT_AUDIT', 'Action executed', logData);
      
      // TODO: Store in database for persistent audit trail
      // await this.auditService.logAction(logData);
      
    } catch (error) {
      logger.error('GUILD_AGENT', 'Error logging action:', error);
    }
  }

  /**
   * Store recent action for undo functionality
   * @param {string} userId - User ID
   * @param {Object} actionData - Action data
   */
  storeRecentAction(userId, actionData) {
    const userActions = this.recentActions.get(userId) || [];
    userActions.push(actionData);
    
    // Keep only last 10 actions per user
    if (userActions.length > 10) {
      userActions.shift();
    }
    
    this.recentActions.set(userId, userActions);
  }

  /**
   * Get recent actions for undo
   * @param {string} userId - User ID
   * @returns {Array} - Recent actions
   */
  getRecentActions(userId) {
    const userActions = this.recentActions.get(userId) || [];
    const now = Date.now();
    
    // Filter actions within undo window
    return userActions.filter(action => 
      now - action.timestamp <= this.undoWindow
    );
  }

  /**
   * Get conversation context for user
   * @param {string} userId - User ID
   * @returns {Object} - Conversation context
   */
  getConversationContext(userId) {
    return this.conversationMemory.get(userId) || {
      recentCommands: [],
      lastInteraction: null,
      preferences: {}
    };
  }

  /**
   * Update conversation context
   * @param {string} userId - User ID
   * @param {Object} command - Parsed command
   */
  updateConversationContext(userId, command) {
    const context = this.getConversationContext(userId);
    
    // Add to recent commands
    context.recentCommands.push({
      command: command,
      timestamp: Date.now()
    });
    
    // Keep only last 10 commands
    if (context.recentCommands.length > 10) {
      context.recentCommands.shift();
    }
    
    context.lastInteraction = Date.now();
    this.conversationMemory.set(userId, context);
  }

  /**
   * Process message and determine response mode
   * @param {Object} message - Discord message object
   * @returns {Promise<Object>} - Processing result
   */
  async processMessage(message) {
    try {
      // Parse natural command
      const parsedCommand = await this.parseNaturalCommand(message);
      
      // Handle different modes
      switch (parsedCommand.mode) {
        case 'COMMAND_MODE':
          return await this.handleCommandMode(message, parsedCommand);
          
        case 'CONFIRMATION_MODE':
          return await this.handleConfirmationMode(message, parsedCommand);
          
        case 'CHAT_MODE':
        default:
          return {
            mode: 'CHAT_MODE',
            shouldRespond: true,
            response: null // Let chat handler handle this
          };
      }

    } catch (error) {
      logger.error('GUILD_AGENT', 'Error processing message:', error);
      return {
        mode: 'CHAT_MODE',
        shouldRespond: true,
        response: null
      };
    }
  }

  /**
   * Handle command mode
   * @param {Object} message - Discord message object
   * @param {Object} command - Parsed command
   * @returns {Promise<Object>} - Command result
   */
  async handleCommandMode(message, command) {
    try {
      // Extract targets from mentions
      const targets = this.extractMentions(message).filter(mention => 
        command.targets.includes(`@${mention.username}`)
      );

      if (targets.length === 0) {
        return {
          mode: 'CHAT_MODE',
          shouldRespond: true,
          response: 'Vui lòng mention user cần thực hiện hành động.'
        };
      }

      // Validate permissions
      const permissionCheck = this.validatePermissions(message.author, command.action, message);
      if (!permissionCheck.allowed) {
        return {
          mode: 'CHAT_MODE',
          shouldRespond: true,
          response: `❌ Không có quyền: ${permissionCheck.reason}`
        };
      }

      // Check if confirmation is required
      const needsConfirmation = permissionSafetyService.requiresConfirmation(command.action, targets.length);
      if (needsConfirmation || command.requiresConfirmation) {
        return await this.requestConfirmation(message, command, targets);
      }

      // Check if this is a batch operation
      if (command.batchOperation && targets.length > 1) {
        const batchResult = await this.handleBatchOperation(message, {
          ...command,
          targets: targets
        });

        return {
          mode: 'COMMAND_MODE',
          shouldRespond: true,
          response: batchResult.success ? 
            `🔄 ${batchResult.message}` : 
            `❌ Lỗi batch operation: ${batchResult.error}`
        };
      }

      // Execute single action
      const result = await this.executeAction(command.action, targets, {
        reason: command.reason,
        duration: command.duration
      }, message);

      return {
        mode: 'COMMAND_MODE',
        shouldRespond: true,
        response: this.formatExecutionResult(result, command)
      };

    } catch (error) {
      logger.error('GUILD_AGENT', 'Error in command mode:', error);
      return {
        mode: 'CHAT_MODE',
        shouldRespond: true,
        response: `❌ Lỗi khi thực hiện lệnh: ${error.message}`
      };
    }
  }

  /**
   * Handle confirmation mode
   * @param {Object} message - Discord message object
   * @param {Object} command - Parsed command
   * @returns {Promise<Object>} - Confirmation result
   */
  async handleConfirmationMode(message, command) {
    // This would implement confirmation logic
    // For now, just execute the command
    return await this.handleCommandMode(message, command);
  }

  /**
   * Request confirmation for action
   * @param {Object} message - Discord message object
   * @param {Object} command - Parsed command
   * @param {Array} targets - Target users
   * @returns {Promise<Object>} - Confirmation request
   */
  async requestConfirmation(message, command, targets) {
    const confirmationId = `${message.author.id}_${Date.now()}`;
    
    // Store pending confirmation
    this.pendingConfirmations.set(confirmationId, {
      command: command,
      targets: targets,
      message: message,
      timestamp: Date.now()
    });

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Xác nhận hành động')
      .setDescription(`Bạn có chắc chắn muốn thực hiện hành động này không?`)
      .addFields(
        { name: 'Hành động', value: command.action, inline: true },
        { name: 'Targets', value: targets.map(t => t.displayName).join(', '), inline: true },
        { name: 'Lý do', value: command.reason, inline: false }
      )
      .setColor(0xFFA500)
      .setTimestamp();

    return {
      mode: 'CONFIRMATION_MODE',
      shouldRespond: true,
      response: { embeds: [embed] },
      confirmationId: confirmationId
    };
  }

  /**
   * Format execution result
   * @param {Object} result - Execution result
   * @param {Object} command - Original command
   * @returns {Object} - Formatted response
   */
  formatExecutionResult(result, command) {
    const embed = new EmbedBuilder()
      .setTitle(`🔨 ${command.action.toUpperCase()} - Kết quả`)
      .setColor(result.success ? 0x00FF00 : 0xFF0000)
      .setTimestamp();

    if (result.success) {
      const successCount = result.results.filter(r => r.success).length;
      const failCount = result.results.filter(r => !r.success).length;
      
      embed.setDescription(`✅ Thành công: ${successCount} | ❌ Thất bại: ${failCount}`);
      
      // Add individual results
      const resultText = result.results.map(r => 
        r.success ? 
          `✅ ${r.target.displayName}: ${r.result?.action || 'Thành công'}` :
          `❌ ${r.target.displayName}: ${r.error}`
      ).join('\n');
      
      embed.addFields({ name: 'Chi tiết', value: resultText, inline: false });
    } else {
      embed.setDescription(`❌ Lỗi: ${result.error}`);
    }

    return { embeds: [embed] };
  }

  /**
   * Handle batch operations
   * @param {Object} message - Discord message object
   * @param {Object} command - Parsed command
   * @returns {Promise<Object>} - Batch operation result
   */
  async handleBatchOperation(message, command) {
    try {
      // Check if this is a batch operation
      if (command.targets.length <= 1) {
        return await this.executeAction(command.action, command.targets, {
          reason: command.reason,
          duration: command.duration
        }, message);
      }

      // Validate batch operation
      if (command.targets.length > this.maxBatchSize) {
        return {
          success: false,
          error: `Quá nhiều targets. Tối đa ${this.maxBatchSize} targets mỗi lần.`
        };
      }

      // Create batch operation
      const operationId = `${message.author.id}_${Date.now()}`;
      const operation = {
        action: command.action,
        targets: command.targets,
        params: {
          reason: command.reason,
          duration: command.duration
        },
        message: message,
        moderator: message.author
      };

      // Queue the operation
      const queueResult = await batchOperationService.queueOperation(operationId, operation);
      
      if (queueResult.success) {
        // Start processing immediately
        batchOperationService.executeOperation(operationId, this);
        
        return {
          success: true,
          operationId: operationId,
          status: 'queued',
          message: `Đã queue batch operation với ${command.targets.length} targets. Đang xử lý...`
        };
      } else {
        return {
          success: false,
          error: queueResult.error
        };
      }

    } catch (error) {
      logger.error('GUILD_AGENT', 'Error handling batch operation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start batch operation processor
   */
  startBatchProcessor() {
    batchOperationService.startQueueProcessor(this);
  }

  /**
   * Get batch operation status
   * @param {string} operationId - Operation ID
   * @returns {Object} - Operation status
   */
  getBatchOperationStatus(operationId) {
    return batchOperationService.getOperationStatus(operationId);
  }

  /**
   * Cancel batch operation
   * @param {string} operationId - Operation ID
   * @returns {boolean} - Success status
   */
  cancelBatchOperation(operationId) {
    return batchOperationService.cancelOperation(operationId);
  }

  /**
   * Get batch operation statistics
   * @returns {Object} - Statistics
   */
  getBatchOperationStats() {
    return batchOperationService.getQueueStats();
  }

  /**
   * Get permission safety statistics
   * @returns {Object} - Safety statistics
   */
  getPermissionSafetyStats() {
    return permissionSafetyService.getSafetyStats();
  }

  /**
   * Add protected user
   * @param {string} userId - User ID
   */
  addProtectedUser(userId) {
    permissionSafetyService.addProtectedUser(userId);
  }

  /**
   * Remove protected user
   * @param {string} userId - User ID
   */
  removeProtectedUser(userId) {
    permissionSafetyService.removeProtectedUser(userId);
  }

  /**
   * Add blacklisted user
   * @param {string} userId - User ID
   */
  addBlacklistedUser(userId) {
    permissionSafetyService.addBlacklistedUser(userId);
  }

  /**
   * Remove blacklisted user
   * @param {string} userId - User ID
   */
  removeBlacklistedUser(userId) {
    permissionSafetyService.removeBlacklistedUser(userId);
  }

  /**
   * Get user permission summary
   * @param {string} userId - User ID
   * @param {Object} message - Message object
   * @returns {Promise<Object>} - Permission summary
   */
  async getUserPermissionSummary(userId, message) {
    return await permissionSafetyService.getUserPermissionSummary(userId, message);
  }

  /**
   * Reset user rate limits
   * @param {string} userId - User ID
   */
  resetUserRateLimits(userId) {
    permissionSafetyService.resetUserRateLimits(userId);
  }

  /**
   * Clean up expired data
   */
  cleanup() {
    const now = Date.now();
    
    // Clean up expired confirmations
    for (const [key, confirmation] of this.pendingConfirmations.entries()) {
      if (now - confirmation.timestamp > this.confirmationTimeout) {
        this.pendingConfirmations.delete(key);
      }
    }
    
    // Clean up expired recent actions
    for (const [userId, actions] of this.recentActions.entries()) {
      const validActions = actions.filter(action => 
        now - action.timestamp <= this.undoWindow
      );
      
      if (validActions.length === 0) {
        this.recentActions.delete(userId);
      } else {
        this.recentActions.set(userId, validActions);
      }
    }

    // Clean up old conversation memory (older than 1 hour)
    for (const [userId, context] of this.conversationMemory.entries()) {
      if (now - context.lastInteraction > 60 * 60 * 1000) {
        this.conversationMemory.delete(userId);
      }
    }

    // Clean up batch operations
    batchOperationService.cleanupOldOperations();
    
    // Clean up permission safety cache
    permissionSafetyService.cleanupCache();
  }
}

module.exports = new GuildAgentService();
