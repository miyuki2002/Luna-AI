const logger = require('../utils/logger.js');

class EnhancedMentionHandler {
  constructor() {
    this.mentionPatterns = {
      user: /<@!?(\d+)>/g,
      role: /<@&(\d+)>/g,
      channel: /<#(\d+)>/g,
      everyone: /@everyone/g,
      here: /@here/g
    };
    
    this.responseModes = {
      COMMAND_MODE: 'COMMAND_MODE',
      CHAT_MODE: 'CHAT_MODE',
      CONFIRMATION_MODE: 'CONFIRMATION_MODE',
      CLARIFICATION_MODE: 'CLARIFICATION_MODE'
    };
  }

  /**
   * Phát hiện multiple mentions trong tin nhắn
   * @param {Object} message - Đối tượng tin nhắn Discord
   * @returns {Object} - Kết quả phân tích mention
   */
  detectMentions(message) {
    const content = message.content;
    const mentions = {
      users: [],
      roles: [],
      channels: [],
      everyone: false,
      here: false,
      botMentioned: false,
      totalMentions: 0
    };

    // Mentions người dùng
    const userMatches = content.matchAll(this.mentionPatterns.user);
    for (const match of userMatches) {
      const userId = match[1];
      const user = message.guild?.members.cache.get(userId)?.user || 
                  message.client.users.cache.get(userId);
      
      if (user) {
        mentions.users.push({
          id: user.id,
          username: user.username,
          displayName: user.displayName || user.username,
          user: user,
          member: message.guild?.members.cache.get(userId),
          isBot: user.bot
        });
        
        if (user.id === message.client.user.id) {
          mentions.botMentioned = true;
        }
      }
    }

    // Mentions role
    const roleMatches = content.matchAll(this.mentionPatterns.role);
    for (const match of roleMatches) {
      const roleId = match[1];
      const role = message.guild?.roles.cache.get(roleId);
      
      if (role) {
        mentions.roles.push({
          id: role.id,
          name: role.name,
          role: role
        });
      }
    }

    // Mentions channel
    const channelMatches = content.matchAll(this.mentionPatterns.channel);
    for (const match of channelMatches) {
      const channelId = match[1];
      const channel = message.guild?.channels.cache.get(channelId);
      
      if (channel) {
        mentions.channels.push({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          channel: channel
        });
      }
    }

    // Mentions đặc biệt
    mentions.everyone = this.mentionPatterns.everyone.test(content);
    mentions.here = this.mentionPatterns.here.test(content);
    mentions.totalMentions = mentions.users.length + mentions.roles.length + mentions.channels.length;

    return mentions;
  }

  /**
   * Phân tích mention patterns và context
   * @param {Object} message - Đối tượng tin nhắn Discord
   * @returns {Object} - Context mention đã phân tích
   */
  parseMentionContext(message) {
    const mentions = this.detectMentions(message);
    const content = message.content;
    
    const context = {
      mentions: mentions,
      hasBotMention: mentions.botMentioned,
      hasUserMentions: mentions.users.length > 0,
      hasRoleMentions: mentions.roles.length > 0,
      hasChannelMentions: mentions.channels.length > 0,
      hasSpecialMentions: mentions.everyone || mentions.here,
      isDirectCommand: this.isDirectCommand(content, mentions),
      isCasualMention: this.isCasualMention(content, mentions),
      isBatchOperation: mentions.users.length > 1,
      userRelationships: this.analyzeUserRelationships(mentions.users, message),
      contextClues: this.extractContextClues(content)
    };

    return context;
  }

  /**
   * Kiểm tra xem có phải direct command không
   * @param {string} content - Nội dung tin nhắn
   * @param {Object} mentions - Dữ liệu mention
   * @returns {boolean} - Có phải direct command không
   */
  isDirectCommand(content, mentions) {
    const commandIndicators = [
      /ban\s+@?\w+/i,
      /kick\s+@?\w+/i,
      /mute\s+@?\w+/i,
      /warn\s+@?\w+/i,
      /cấm\s+@?\w+/i,
      /đuổi\s+@?\w+/i,
      /câm\s+@?\w+/i,
      /cảnh\s+cáo\s+@?\w+/i,
      /xóa\s+tin\s+nhắn/i,
      /clear\s+messages/i
    ];

    return commandIndicators.some(pattern => pattern.test(content)) && 
           mentions.users.length > 0;
  }

  /**
   * Kiểm tra xem có phải casual mention không
   * @param {string} content - Nội dung tin nhắn
   * @param {Object} mentions - Dữ liệu mention
   * @returns {boolean} - Có phải casual mention không
   */
  isCasualMention(content, mentions) {
    const casualIndicators = [
      /cute/i,
      /đẹp/i,
      /xinh/i,
      /thế nào/i,
      /hôm nay/i,
      /chào/i,
      /hello/i,
      /hi/i,
      /phải không/i,
      /\?/,
      /!/
    ];

    return casualIndicators.some(pattern => pattern.test(content)) && 
           mentions.botMentioned;
  }

  /**
   * Phân tích mối quan hệ giữa users
   * @param {Array} users - Mảng users được mention
   * @param {Object} message - Tin nhắn gốc
   * @returns {Object} - Mối quan hệ users
   */
  analyzeUserRelationships(users, message) {
    const relationships = {
      hasModerators: false,
      hasRegularUsers: false,
      hasBots: false,
      hierarchyLevels: [],
      canModerate: []
    };

    for (const user of users) {
      if (user.member) {
        const member = user.member;
        
        // Kiểm tra xem user có phải moderator không
        if (member.permissions.has('ModerateMembers') || 
            member.permissions.has('BanMembers') || 
            member.permissions.has('KickMembers')) {
          relationships.hasModerators = true;
          relationships.canModerate.push(user);
        } else {
          relationships.hasRegularUsers = true;
        }

        // Kiểm tra thứ bậc
        relationships.hierarchyLevels.push({
          user: user,
          position: member.roles.highest.position,
          isHigherThanAuthor: member.roles.highest.position > message.member.roles.highest.position
        });
      }

      if (user.isBot) {
        relationships.hasBots = true;
      }
    }

    return relationships;
  }

  /**
   * Trích xuất context clues từ tin nhắn
   * @param {string} content - Nội dung tin nhắn
   * @returns {Object} - Context clues
   */
  extractContextClues(content) {
    const clues = {
      urgency: 'normal',
      emotion: 'neutral',
      formality: 'casual',
      language: 'vietnamese',
      hasTimeReference: false,
      hasReason: false,
      hasQuestion: false,
      hasExclamation: false
    };

    // Phát hiện mức độ khẩn cấp
    if (/khẩn cấp|urgent|gấp|ngay|immediately/i.test(content)) {
      clues.urgency = 'high';
    } else if (/vui lòng|please|giúp|help/i.test(content)) {
      clues.urgency = 'medium';
    }

    // Phát hiện cảm xúc
    if (/tức giận|angry|frustrated|bực/i.test(content)) {
      clues.emotion = 'angry';
    } else if (/vui|happy|excited|hào hứng/i.test(content)) {
      clues.emotion = 'happy';
    } else if (/buồn|sad|disappointed|thất vọng/i.test(content)) {
      clues.emotion = 'sad';
    }

    // Phát hiện mức độ trang trọng
    if (/vui lòng|please|có thể|would you/i.test(content)) {
      clues.formality = 'formal';
    } else if (/đi|thôi|nào|come on/i.test(content)) {
      clues.formality = 'casual';
    }

    // Phát hiện ngôn ngữ
    if (/the|and|or|but|is|are|was|were/i.test(content)) {
      clues.language = 'english';
    }

    // Tham chiếu thời gian
    if (/\d+\s*(phút|giờ|ngày|minute|hour|day)/i.test(content)) {
      clues.hasTimeReference = true;
    }

    // Phát hiện lý do
    if (/vì|lý do|reason|because|do|tại/i.test(content)) {
      clues.hasReason = true;
    }

    // Phát hiện câu hỏi
    if (/\?/.test(content)) {
      clues.hasQuestion = true;
    }

    // Exclamation detection
    if (/!/.test(content)) {
      clues.hasExclamation = true;
    }

    return clues;
  }

  /**
   * Xác định response mode dựa trên context
   * @param {Object} context - Context mention
   * @returns {string} - Chế độ phản hồi
   */
  determineResponseMode(context) {
    // Direct command mode
    if (context.isDirectCommand) {
      return this.responseModes.COMMAND_MODE;
    }

    // Confirmation mode for batch operations
    if (context.isBatchOperation && context.mentions.users.length > 2) {
      return this.responseModes.CONFIRMATION_MODE;
    }

    // Clarification mode for ambiguous commands
    if (context.mentions.users.length > 0 && 
        !context.isDirectCommand && 
        !context.isCasualMention) {
      return this.responseModes.CLARIFICATION_MODE;
    }

    // Casual chat mode
    if (context.isCasualMention) {
      return this.responseModes.CHAT_MODE;
    }

    // Default to chat mode
    return this.responseModes.CHAT_MODE;
  }

  /**
   * Store mention context và user relationships
   * @param {string} userId - User ID
   * @param {Object} context - Mention context
   */
  storeMentionContext(userId, context) {
    // This would store in database or cache
    // For now, just log
    logger.info('MENTION_HANDLER', `Stored context for user ${userId}:`, {
      mentions: context.mentions.totalMentions,
      mode: context.responseMode,
      relationships: context.userRelationships
    });
  }

  /**
   * Get mention statistics
   * @param {string} guildId - Guild ID
   * @returns {Object} - Mention statistics
   */
  getMentionStats(guildId) {
    // This would query database for statistics
    // For now, return mock data
    return {
      totalMentions: 0,
      commandMentions: 0,
      casualMentions: 0,
      batchOperations: 0,
      mostMentionedUsers: [],
      mostActiveChannels: []
    };
  }

  /**
   * Clean up old mention data
   * @param {number} maxAge - Maximum age in milliseconds
   */
  cleanupOldData(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    const now = Date.now();
    
    // This would clean up old mention data from database
    logger.info('MENTION_HANDLER', `Cleaning up data older than ${maxAge}ms`);
  }
}

module.exports = new EnhancedMentionHandler();
