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
    
    // Đăng ký các hành động
    this.actions = {
      ban: this.banUser.bind(this),
      kick: this.kickUser.bind(this),
      mute: this.muteUser.bind(this),
      warn: this.warnUser.bind(this),
      deleteMessages: this.deleteMessages.bind(this),
      unban: this.unbanUser.bind(this),
      unmute: this.unmuteUser.bind(this)
    };

    // Bộ nhớ cuộc trò chuyện
    this.conversationMemory = new Map();
    
    // Các xác nhận đang chờ
    this.pendingConfirmations = new Map();
    
    // Các hành động gần đây để hoàn tác
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
      // Lấy context cuộc trò chuyện
      const context = this.getConversationContext(message.author.id);
      
      // Sử dụng Natural Language Processor
      const parsedCommand = await naturalLanguageProcessor.analyzeCommand(
        message.content, 
        message, 
        context
      );
      
      // Kiểm tra ngưỡng tin cậy
      if (parsedCommand.confidence < this.commandConfidenceThreshold) {
        return {
          mode: 'CHAT_MODE',
          confidence: parsedCommand.confidence,
          reason: 'Độ tin cậy quá thấp để thực thi lệnh'
        };
      }

      // Kiểm tra hành động có tồn tại
      if (parsedCommand.action && !this.actions[parsedCommand.action]) {
        return {
          mode: 'CHAT_MODE',
          confidence: parsedCommand.confidence,
          reason: 'Loại hành động không xác định'
        };
      }

      // Lưu vào bộ nhớ cuộc trò chuyện
      this.updateConversationContext(message.author.id, parsedCommand);

      return parsedCommand;

    } catch (error) {
      logger.error('GUILD_AGENT', 'Lỗi khi phân tích lệnh tự nhiên:', error);
      return {
        mode: 'CHAT_MODE',
        confidence: 0,
        reason: 'Lỗi phân tích lệnh'
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
   * Trích xuất mentions từ tin nhắn
   * @param {Object} message - Đối tượng tin nhắn Discord
   * @returns {Array} - Mảng các user được mention
   */
  extractMentions(message) {
    const mentions = [];
    
    // Mentions người dùng
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
   * Kiểm tra quyền cho user thực hiện hành động
   * @param {Object} user - Đối tượng user
   * @param {string} action - Loại hành động
   * @param {Object} message - Đối tượng tin nhắn
   * @returns {Promise<Object>} - Kết quả kiểm tra quyền
   */
  async validatePermissions(user, action, message) {
    try {
      // Sử dụng PermissionSafetyService để kiểm tra toàn diện
      const userPermissionCheck = await permissionSafetyService.validateUserPermissions(user, action, message);
      if (!userPermissionCheck.allowed) {
        return userPermissionCheck;
      }

      // Kiểm tra quyền bot
      const botMember = message.guild.members.me;
      if (!botMember) {
        return { allowed: false, reason: 'Không tìm thấy bot trong guild' };
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
            reason: `Bot thiếu quyền: ${permission}` 
          };
        }
      }

      return { allowed: true, reason: 'Tất cả quyền đều hợp lệ' };

    } catch (error) {
      logger.error('GUILD_AGENT', 'Lỗi khi kiểm tra quyền:', error);
      return { allowed: false, reason: 'Lỗi kiểm tra quyền' };
    }
  }

  /**
   * Thực thi hành động moderation
   * @param {string} action - Loại hành động
   * @param {Array} targets - Các user mục tiêu
   * @param {Object} params - Tham số hành động
   * @param {Object} message - Tin nhắn gốc
   * @returns {Promise<Object>} - Kết quả thực thi
   */
  async executeAction(action, targets, params, message) {
    try {
      const actionFunction = this.actions[action];
      if (!actionFunction) {
        throw new Error(`Unknown action: ${action}`);
      }

      const results = [];
      const startTime = Date.now();

      // Thực thi hành động cho từng mục tiêu
      for (const target of targets) {
        try {
          // Kiểm tra an toàn mục tiêu
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

          // Ghi log hành động thành công
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

          // Ghi log hành động thất bại
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

      // Lưu trữ để hoàn tác
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
      logger.error('GUILD_AGENT', `Lỗi khi thực thi hành động ${action}:`, error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Ban user
   * @param {Object} target - User mục tiêu
   * @param {Object} params - Tham số hành động
   * @param {Object} message - Tin nhắn gốc
   * @returns {Promise<Object>} - Kết quả ban
   */
  async banUser(target, params, message) {
    const member = message.guild.members.cache.get(target.id);
    if (!member) {
      throw new Error(`Không tìm thấy user ${target.displayName} trong guild`);
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
   * @param {Object} target - User mục tiêu
   * @param {Object} params - Tham số hành động
   * @param {Object} message - Tin nhắn gốc
   * @returns {Promise<Object>} - Kết quả kick
   */
  async kickUser(target, params, message) {
    const member = message.guild.members.cache.get(target.id);
    if (!member) {
      throw new Error(`Không tìm thấy user ${target.displayName} trong guild`);
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
   * @param {Object} target - User mục tiêu
   * @param {Object} params - Tham số hành động
   * @param {Object} message - Tin nhắn gốc
   * @returns {Promise<Object>} - Kết quả mute
   */
  async muteUser(target, params, message) {
    const member = message.guild.members.cache.get(target.id);
    if (!member) {
      throw new Error(`Không tìm thấy user ${target.displayName} trong guild`);
    }

    const duration = this.parseDuration(params.duration);
    const reason = `${params.reason} - Muted by ${message.author.tag}`;

    if (duration === 'permanent') {
      throw new Error('Không hỗ trợ mute vĩnh viễn, hãy sử dụng ban thay thế');
    }

    const timeoutMs = duration * 60 * 1000; // Chuyển đổi phút thành milliseconds
    await member.timeout(timeoutMs, reason);

    return {
      action: 'mute',
      target: target.displayName,
      reason: params.reason,
      duration: `${duration} phút`
    };
  }

  /**
   * Cảnh báo user
   * @param {Object} target - User mục tiêu
   * @param {Object} params - Tham số hành động
   * @param {Object} message - Tin nhắn gốc
   * @returns {Promise<Object>} - Kết quả cảnh báo
   */
  async warnUser(target, params, message) {
    const member = message.guild.members.cache.get(target.id);
    if (!member) {
      throw new Error(`Không tìm thấy user ${target.displayName} trong guild`);
    }

    // Gửi cảnh báo qua DM
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
   * Xóa tin nhắn
   * @param {Object} target - User mục tiêu
   * @param {Object} params - Tham số hành động
   * @param {Object} message - Tin nhắn gốc
   * @returns {Promise<Object>} - Kết quả xóa
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
          logger.warn('GUILD_AGENT', `Không thể xóa tin nhắn ${msg.id}:`, error.message);
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
   * Bỏ cấm user
   * @param {Object} target - User mục tiêu
   * @param {Object} params - Tham số hành động
   * @param {Object} message - Tin nhắn gốc
   * @returns {Promise<Object>} - Kết quả bỏ cấm
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
   * Bỏ mute user
   * @param {Object} target - User mục tiêu
   * @param {Object} params - Tham số hành động
   * @param {Object} message - Tin nhắn gốc
   * @returns {Promise<Object>} - Kết quả bỏ mute
   */
  async unmuteUser(target, params, message) {
    const member = message.guild.members.cache.get(target.id);
    if (!member) {
      throw new Error(`Không tìm thấy user ${target.displayName} trong guild`);
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
   * Chuyển đổi chuỗi thời gian thành phút
   * @param {string} duration - Chuỗi thời gian
   * @returns {number|string} - Thời gian tính bằng phút hoặc 'permanent'
   */
  parseDuration(duration) {
    const parsed = moderationUtils.parseDuration(duration);
    return parsed.minutes;
  }

  /**
   * Ghi log hành động để kiểm tra
   * @param {Object} logData - Dữ liệu log
   */
  async logAction(logData) {
    try {
      logger.info('GUILD_AGENT_AUDIT', 'Hành động đã thực thi', logData);
      
      // TODO: Lưu vào database để kiểm tra lâu dài
      // await this.auditService.logAction(logData);
      
    } catch (error) {
      logger.error('GUILD_AGENT', 'Lỗi khi ghi log hành động:', error);
    }
  }

  /**
   * Lưu trữ hành động gần đây để hoàn tác
   * @param {string} userId - ID người dùng
   * @param {Object} actionData - Dữ liệu hành động
   */
  storeRecentAction(userId, actionData) {
    const userActions = this.recentActions.get(userId) || [];
    userActions.push(actionData);
    
    // Chỉ giữ lại 10 hành động gần nhất cho mỗi user
    if (userActions.length > 10) {
      userActions.shift();
    }
    
    this.recentActions.set(userId, userActions);
  }

  /**
   * Lấy các hành động gần đây để hoàn tác
   * @param {string} userId - ID người dùng
   * @returns {Array} - Các hành động gần đây
   */
  getRecentActions(userId) {
    const userActions = this.recentActions.get(userId) || [];
    const now = Date.now();
    
    // Lọc các hành động trong cửa sổ hoàn tác
    return userActions.filter(action => 
      now - action.timestamp <= this.undoWindow
    );
  }

  /**
   * Lấy context cuộc trò chuyện cho user
   * @param {string} userId - ID người dùng
   * @returns {Object} - Context cuộc trò chuyện
   */
  getConversationContext(userId) {
    return this.conversationMemory.get(userId) || {
      recentCommands: [],
      lastInteraction: null,
      preferences: {}
    };
  }

  /**
   * Cập nhật context cuộc trò chuyện
   * @param {string} userId - ID người dùng
   * @param {Object} command - Lệnh đã phân tích
   */
  updateConversationContext(userId, command) {
    const context = this.getConversationContext(userId);
    
    // Thêm vào các lệnh gần đây
    context.recentCommands.push({
      command: command,
      timestamp: Date.now()
    });
    
    // Chỉ giữ lại 10 lệnh gần nhất
    if (context.recentCommands.length > 10) {
      context.recentCommands.shift();
    }
    
    context.lastInteraction = Date.now();
    this.conversationMemory.set(userId, context);
  }

  /**
   * Xử lý tin nhắn và xác định chế độ phản hồi
   * @param {Object} message - Đối tượng tin nhắn Discord
   * @returns {Promise<Object>} - Kết quả xử lý
   */
  async processMessage(message) {
    try {
      // Phân tích lệnh tự nhiên
      const parsedCommand = await this.parseNaturalCommand(message);
      
      // Xử lý các chế độ khác nhau
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
            response: null // Để chat handler xử lý
          };
      }

    } catch (error) {
      logger.error('GUILD_AGENT', 'Lỗi khi xử lý tin nhắn:', error);
      return {
        mode: 'CHAT_MODE',
        shouldRespond: true,
        response: null
      };
    }
  }

  /**
   * Xử lý chế độ lệnh
   * @param {Object} message - Đối tượng tin nhắn Discord
   * @param {Object} command - Lệnh đã phân tích
   * @returns {Promise<Object>} - Kết quả lệnh
   */
  async handleCommandMode(message, command) {
    try {
      // Trích xuất mục tiêu từ mentions
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

      // Kiểm tra quyền
      const permissionCheck = this.validatePermissions(message.author, command.action, message);
      if (!permissionCheck.allowed) {
        return {
          mode: 'CHAT_MODE',
          shouldRespond: true,
          response: `❌ Không có quyền: ${permissionCheck.reason}`
        };
      }

      // Kiểm tra xem có cần xác nhận không
      const needsConfirmation = permissionSafetyService.requiresConfirmation(command.action, targets.length);
      if (needsConfirmation || command.requiresConfirmation) {
        return await this.requestConfirmation(message, command, targets);
      }

      // Kiểm tra xem có phải batch operation không
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

      // Thực thi hành động đơn lẻ
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
      logger.error('GUILD_AGENT', 'Lỗi trong chế độ lệnh:', error);
      return {
        mode: 'CHAT_MODE',
        shouldRespond: true,
        response: `❌ Lỗi khi thực hiện lệnh: ${error.message}`
      };
    }
  }

  /**
   * Xử lý chế độ xác nhận
   * @param {Object} message - Đối tượng tin nhắn Discord
   * @param {Object} command - Lệnh đã phân tích
   * @returns {Promise<Object>} - Kết quả xác nhận
   */
  async handleConfirmationMode(message, command) {
    // Đây sẽ implement logic xác nhận
    // Hiện tại chỉ thực thi lệnh
    return await this.handleCommandMode(message, command);
  }

  /**
   * Yêu cầu xác nhận cho hành động
   * @param {Object} message - Đối tượng tin nhắn Discord
   * @param {Object} command - Lệnh đã phân tích
   * @param {Array} targets - Các user mục tiêu
   * @returns {Promise<Object>} - Yêu cầu xác nhận
   */
  async requestConfirmation(message, command, targets) {
    const confirmationId = `${message.author.id}_${Date.now()}`;
    
    // Lưu trữ xác nhận đang chờ
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
   * Định dạng kết quả thực thi
   * @param {Object} result - Kết quả thực thi
   * @param {Object} command - Lệnh gốc
   * @returns {Object} - Phản hồi đã định dạng
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
   * Xử lý batch operations
   * @param {Object} message - Đối tượng tin nhắn Discord
   * @param {Object} command - Lệnh đã phân tích
   * @returns {Promise<Object>} - Kết quả batch operation
   */
  async handleBatchOperation(message, command) {
    try {
      // Kiểm tra xem có phải batch operation không
      if (command.targets.length <= 1) {
        return await this.executeAction(command.action, command.targets, {
          reason: command.reason,
          duration: command.duration
        }, message);
      }

      // Kiểm tra batch operation
      if (command.targets.length > this.maxBatchSize) {
        return {
          success: false,
          error: `Quá nhiều targets. Tối đa ${this.maxBatchSize} targets mỗi lần.`
        };
      }

      // Tạo batch operation
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

      // Thêm vào hàng đợi
      const queueResult = await batchOperationService.queueOperation(operationId, operation);
      
      if (queueResult.success) {
        // Bắt đầu xử lý ngay lập tức
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
      logger.error('GUILD_AGENT', 'Lỗi khi xử lý batch operation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Khởi động bộ xử lý batch operation
   */
  startBatchProcessor() {
    batchOperationService.startQueueProcessor(this);
  }

  /**
   * Lấy trạng thái batch operation
   * @param {string} operationId - ID operation
   * @returns {Object} - Trạng thái operation
   */
  getBatchOperationStatus(operationId) {
    return batchOperationService.getOperationStatus(operationId);
  }

  /**
   * Hủy batch operation
   * @param {string} operationId - ID operation
   * @returns {boolean} - Trạng thái thành công
   */
  cancelBatchOperation(operationId) {
    return batchOperationService.cancelOperation(operationId);
  }

  /**
   * Lấy thống kê batch operation
   * @returns {Object} - Thống kê
   */
  getBatchOperationStats() {
    return batchOperationService.getQueueStats();
  }

  /**
   * Lấy thống kê an toàn quyền
   * @returns {Object} - Thống kê an toàn
   */
  getPermissionSafetyStats() {
    return permissionSafetyService.getSafetyStats();
  }

  /**
   * Thêm user được bảo vệ
   * @param {string} userId - ID người dùng
   */
  addProtectedUser(userId) {
    permissionSafetyService.addProtectedUser(userId);
  }

  /**
   * Xóa user được bảo vệ
   * @param {string} userId - ID người dùng
   */
  removeProtectedUser(userId) {
    permissionSafetyService.removeProtectedUser(userId);
  }

  /**
   * Thêm user vào blacklist
   * @param {string} userId - ID người dùng
   */
  addBlacklistedUser(userId) {
    permissionSafetyService.addBlacklistedUser(userId);
  }

  /**
   * Xóa user khỏi blacklist
   * @param {string} userId - ID người dùng
   */
  removeBlacklistedUser(userId) {
    permissionSafetyService.removeBlacklistedUser(userId);
  }

  /**
   * Lấy tóm tắt quyền user
   * @param {string} userId - ID người dùng
   * @param {Object} message - Đối tượng tin nhắn
   * @returns {Promise<Object>} - Tóm tắt quyền
   */
  async getUserPermissionSummary(userId, message) {
    return await permissionSafetyService.getUserPermissionSummary(userId, message);
  }

  /**
   * Reset giới hạn tốc độ user
   * @param {string} userId - ID người dùng
   */
  resetUserRateLimits(userId) {
    permissionSafetyService.resetUserRateLimits(userId);
  }

  /**
   * Dọn dẹp dữ liệu hết hạn
   */
  cleanup() {
    const now = Date.now();
    
    // Dọn dẹp các xác nhận hết hạn
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
