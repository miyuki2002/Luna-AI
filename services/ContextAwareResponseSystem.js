const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger.js');

class ContextAwareResponseSystem {
  constructor() {
    this.responseModes = {
      COMMAND_MODE: 'COMMAND_MODE',
      CHAT_MODE: 'CHAT_MODE',
      CONFIRMATION_MODE: 'CONFIRMATION_MODE',
      CLARIFICATION_MODE: 'CLARIFICATION_MODE'
    };

    // Conversation memory
    this.conversationMemory = new Map();
    this.maxMemorySize = 50; // Max conversations to keep in memory
    
    // Response templates
    this.responseTemplates = this.initializeResponseTemplates();
  }

  /**
   * Initialize response templates
   */
  initializeResponseTemplates() {
    return {
      COMMAND_MODE: {
        success: '✅ Đã thực hiện lệnh thành công!',
        error: '❌ Lỗi khi thực hiện lệnh: {error}',
        noPermission: '❌ Bạn không có quyền thực hiện lệnh này.',
        noTargets: '❌ Vui lòng mention user cần thực hiện hành động.',
        confirmation: '⚠️ Bạn có chắc chắn muốn thực hiện hành động này không?'
      },
      CHAT_MODE: {
        greeting: 'Xin chào! Tôi có thể giúp gì cho bạn?',
        casual: 'Tôi hiểu! Bạn cần hỗ trợ gì không?',
        question: 'Đó là một câu hỏi thú vị! Tôi có thể giúp gì thêm không?',
        compliment: 'Cảm ơn bạn! Tôi rất vui khi được giúp đỡ.',
        confusion: 'Tôi không hiểu rõ ý bạn. Bạn có thể giải thích thêm không?'
      },
      CONFIRMATION_MODE: {
        request: '⚠️ Xác nhận hành động',
        timeout: '⏰ Hết thời gian xác nhận. Hành động đã bị hủy.',
        cancelled: '❌ Hành động đã bị hủy.',
        confirmed: '✅ Đã xác nhận. Đang thực hiện...'
      },
      CLARIFICATION_MODE: {
        ambiguous: 'Tôi không chắc chắn bạn muốn làm gì. Bạn có thể làm rõ hơn không?',
        multipleOptions: 'Tôi thấy có nhiều cách hiểu. Bạn muốn:',
        needMoreInfo: 'Tôi cần thêm thông tin để hiểu rõ hơn.'
      }
    };
  }

  /**
   * Process message và determine response
   * @param {Object} message - Discord message object
   * @param {Object} context - Mention context
   * @param {Object} guildAgentResult - Guild agent processing result
   * @returns {Promise<Object>} - Response decision
   */
  async processMessage(message, context, guildAgentResult) {
    try {
      // Get conversation history
      const conversationHistory = this.getConversationHistory(message.author.id);
      
      // Determine response mode
      const responseMode = this.determineResponseMode(context, guildAgentResult, conversationHistory);
      
      // Generate appropriate response
      const response = await this.generateResponse(
        message, 
        context, 
        guildAgentResult, 
        responseMode, 
        conversationHistory
      );

      // Update conversation memory
      this.updateConversationMemory(message.author.id, {
        message: message.content,
        context: context,
        responseMode: responseMode,
        timestamp: Date.now()
      });

      return {
        mode: responseMode,
        shouldRespond: response.shouldRespond,
        response: response.content,
        embed: response.embed,
        components: response.components,
        ephemeral: response.ephemeral
      };

    } catch (error) {
      logger.error('CONTEXT_RESPONSE', 'Error processing message:', error);
      return {
        mode: this.responseModes.CHAT_MODE,
        shouldRespond: true,
        response: 'Xin lỗi, tôi gặp lỗi khi xử lý tin nhắn của bạn.',
        embed: null,
        components: null,
        ephemeral: false
      };
    }
  }

  /**
   * Determine response mode based on context
   * @param {Object} context - Mention context
   * @param {Object} guildAgentResult - Guild agent result
   * @param {Array} conversationHistory - Conversation history
   * @returns {string} - Response mode
   */
  determineResponseMode(context, guildAgentResult, conversationHistory) {
    // If guild agent detected a command, use command mode
    if (guildAgentResult && guildAgentResult.mode === 'COMMAND_MODE') {
      return this.responseModes.COMMAND_MODE;
    }

    // If guild agent detected confirmation needed
    if (guildAgentResult && guildAgentResult.mode === 'CONFIRMATION_MODE') {
      return this.responseModes.CONFIRMATION_MODE;
    }

    // If direct command detected
    if (context.isDirectCommand) {
      return this.responseModes.COMMAND_MODE;
    }

    // If casual mention
    if (context.isCasualMention) {
      return this.responseModes.CHAT_MODE;
    }

    // If ambiguous but has mentions
    if (context.mentions.users.length > 0 && !context.isDirectCommand) {
      return this.responseModes.CLARIFICATION_MODE;
    }

    // Check conversation history for context
    if (conversationHistory.length > 0) {
      const lastInteraction = conversationHistory[conversationHistory.length - 1];
      const timeSinceLastInteraction = Date.now() - lastInteraction.timestamp;
      
      // If recent interaction was command mode, continue in command mode
      if (lastInteraction.responseMode === this.responseModes.COMMAND_MODE && 
          timeSinceLastInteraction < 5 * 60 * 1000) { // 5 minutes
        return this.responseModes.COMMAND_MODE;
      }
    }

    // Default to chat mode
    return this.responseModes.CHAT_MODE;
  }

  /**
   * Generate appropriate response
   * @param {Object} message - Discord message object
   * @param {Object} context - Mention context
   * @param {Object} guildAgentResult - Guild agent result
   * @param {string} responseMode - Response mode
   * @param {Array} conversationHistory - Conversation history
   * @returns {Promise<Object>} - Generated response
   */
  async generateResponse(message, context, guildAgentResult, responseMode, conversationHistory) {
    switch (responseMode) {
      case this.responseModes.COMMAND_MODE:
        return this.generateCommandResponse(message, context, guildAgentResult);
        
      case this.responseModes.CHAT_MODE:
        return this.generateChatResponse(message, context, conversationHistory);
        
      case this.responseModes.CONFIRMATION_MODE:
        return this.generateConfirmationResponse(message, context, guildAgentResult);
        
      case this.responseModes.CLARIFICATION_MODE:
        return this.generateClarificationResponse(message, context, conversationHistory);
        
      default:
        return this.generateChatResponse(message, context, conversationHistory);
    }
  }

  /**
   * Generate command mode response
   * @param {Object} message - Discord message object
   * @param {Object} context - Mention context
   * @param {Object} guildAgentResult - Guild agent result
   * @returns {Object} - Command response
   */
  generateCommandResponse(message, context, guildAgentResult) {
    if (guildAgentResult && guildAgentResult.response) {
      return {
        shouldRespond: true,
        content: null,
        embed: guildAgentResult.response.embeds?.[0] || null,
        components: guildAgentResult.response.components || null,
        ephemeral: false
      };
    }

    // Fallback command response
    const embed = new EmbedBuilder()
      .setTitle('🔨 Lệnh Moderation')
      .setDescription('Đang xử lý lệnh của bạn...')
      .setColor(0x5865F2)
      .setTimestamp();

    return {
      shouldRespond: true,
      content: null,
      embed: embed,
      components: null,
      ephemeral: false
    };
  }

  /**
   * Generate chat mode response
   * @param {Object} message - Discord message object
   * @param {Object} context - Mention context
   * @param {Array} conversationHistory - Conversation history
   * @returns {Object} - Chat response
   */
  generateChatResponse(message, context, conversationHistory) {
    const content = message.content.toLowerCase();
    
    // Analyze content for appropriate response
    let responseType = 'casual';
    
    if (content.includes('chào') || content.includes('hello') || content.includes('hi')) {
      responseType = 'greeting';
    } else if (content.includes('?')) {
      responseType = 'question';
    } else if (content.includes('cute') || content.includes('đẹp') || content.includes('xinh')) {
      responseType = 'compliment';
    } else if (content.includes('cảm ơn') || content.includes('thank')) {
      responseType = 'compliment';
    }

    // Check conversation history for context
    if (conversationHistory.length > 0) {
      const lastInteraction = conversationHistory[conversationHistory.length - 1];
      if (lastInteraction.responseMode === this.responseModes.CLARIFICATION_MODE) {
        responseType = 'clarification_followup';
      }
    }

    const response = this.getChatResponse(responseType, context);
    
    return {
      shouldRespond: true,
      content: response,
      embed: null,
      components: null,
      ephemeral: false
    };
  }

  /**
   * Generate confirmation mode response
   * @param {Object} message - Discord message object
   * @param {Object} context - Mention context
   * @param {Object} guildAgentResult - Guild agent result
   * @returns {Object} - Confirmation response
   */
  generateConfirmationResponse(message, context, guildAgentResult) {
    if (guildAgentResult && guildAgentResult.response) {
      return {
        shouldRespond: true,
        content: null,
        embed: guildAgentResult.response.embeds?.[0] || null,
        components: guildAgentResult.response.components || null,
        ephemeral: false
      };
    }

    // Fallback confirmation response
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Xác nhận hành động')
      .setDescription('Bạn có chắc chắn muốn thực hiện hành động này không?')
      .setColor(0xFFA500)
      .setTimestamp();

    return {
      shouldRespond: true,
      content: null,
      embed: embed,
      components: null,
      ephemeral: false
    };
  }

  /**
   * Generate clarification mode response
   * @param {Object} message - Discord message object
   * @param {Object} context - Mention context
   * @param {Array} conversationHistory - Conversation history
   * @returns {Object} - Clarification response
   */
  generateClarificationResponse(message, context, conversationHistory) {
    const embed = new EmbedBuilder()
      .setTitle('❓ Cần làm rõ')
      .setDescription('Tôi không chắc chắn bạn muốn làm gì với những user được mention.')
      .addFields(
        { name: 'Các user được mention', value: context.mentions.users.map(u => u.displayName).join(', '), inline: false },
        { name: 'Gợi ý', value: 'Bạn có thể sử dụng các lệnh như: ban, kick, mute, warn, cảnh báo...', inline: false }
      )
      .setColor(0xFFA500)
      .setTimestamp();

    return {
      shouldRespond: true,
      content: null,
      embed: embed,
      components: null,
      ephemeral: false
    };
  }

  /**
   * Get chat response based on type
   * @param {string} responseType - Response type
   * @param {Object} context - Mention context
   * @returns {string} - Chat response
   */
  getChatResponse(responseType, context) {
    const templates = this.responseTemplates.CHAT_MODE;
    
    switch (responseType) {
      case 'greeting':
        return templates.greeting;
      case 'question':
        return templates.question;
      case 'compliment':
        return templates.compliment;
      case 'clarification_followup':
        return 'Tôi hiểu rồi! Bạn có thể tiếp tục.';
      default:
        return templates.casual;
    }
  }

  /**
   * Get conversation history for user
   * @param {string} userId - User ID
   * @returns {Array} - Conversation history
   */
  getConversationHistory(userId) {
    return this.conversationMemory.get(userId) || [];
  }

  /**
   * Update conversation memory
   * @param {string} userId - User ID
   * @param {Object} interaction - Interaction data
   */
  updateConversationMemory(userId, interaction) {
    const history = this.getConversationHistory(userId);
    history.push(interaction);
    
    // Keep only recent interactions
    if (history.length > 10) {
      history.shift();
    }
    
    this.conversationMemory.set(userId, history);
    
    // Clean up old memories
    this.cleanupOldMemories();
  }

  /**
   * Clean up old conversation memories
   */
  cleanupOldMemories() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    
    for (const [userId, history] of this.conversationMemory.entries()) {
      const recentHistory = history.filter(interaction => 
        now - interaction.timestamp < maxAge
      );
      
      if (recentHistory.length === 0) {
        this.conversationMemory.delete(userId);
      } else {
        this.conversationMemory.set(userId, recentHistory);
      }
    }
    
    // Limit total memory size
    if (this.conversationMemory.size > this.maxMemorySize) {
      const entries = Array.from(this.conversationMemory.entries());
      entries.sort((a, b) => b[1][b[1].length - 1].timestamp - a[1][a[1].length - 1].timestamp);
      
      this.conversationMemory.clear();
      entries.slice(0, this.maxMemorySize).forEach(([userId, history]) => {
        this.conversationMemory.set(userId, history);
      });
    }
  }

  /**
   * Get conversation statistics
   * @returns {Object} - Conversation statistics
   */
  getConversationStats() {
    const stats = {
      totalConversations: this.conversationMemory.size,
      modeDistribution: {},
      averageConversationLength: 0,
      mostActiveUsers: []
    };

    let totalInteractions = 0;
    const userActivity = new Map();

    for (const [userId, history] of this.conversationMemory.entries()) {
      totalInteractions += history.length;
      
      // Count modes
      for (const interaction of history) {
        const mode = interaction.responseMode;
        stats.modeDistribution[mode] = (stats.modeDistribution[mode] || 0) + 1;
      }
      
      // Count user activity
      userActivity.set(userId, history.length);
    }

    stats.averageConversationLength = this.conversationMemory.size > 0 ? 
      totalInteractions / this.conversationMemory.size : 0;

    // Get most active users
    const sortedUsers = Array.from(userActivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    stats.mostActiveUsers = sortedUsers.map(([userId, count]) => ({
      userId,
      interactionCount: count
    }));

    return stats;
  }
}

module.exports = new ContextAwareResponseSystem();
