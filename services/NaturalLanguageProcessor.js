const AICore = require('./AICore');
const logger = require('../utils/logger.js');

class NaturalLanguageProcessor {
  constructor() {
    this.confidenceThreshold = 0.8;
    this.promptTemplates = this.initializePromptTemplates();
    this.commandPatterns = this.initializeCommandPatterns();
  }

  /**
   * Initialize AI prompt templates
   */
  initializePromptTemplates() {
    return {
      commandAnalysis: `Bạn là Luna AI - một Guild Management Agent thông minh.

Nhiệm vụ: Phân tích tin nhắn để xác định xem có phải lệnh moderation không.

Các hành động được hỗ trợ:
- ban: cấm, ban, khóa tài khoản, đuổi vĩnh viễn, loại bỏ vĩnh viễn
- kick: kick, đuổi, đá đít, loại bỏ tạm thời, đuổi ra khỏi server
- mute: mute, câm, khóa mõm, im lặng, timeout, tắt mic
- warn: warn, cảnh cáo, nhắc nhở, cảnh báo
- deleteMessages: xóa tin nhắn, clear messages, dọn dẹp tin nhắn
- unban: unban, bỏ cấm, mở khóa, cho vào lại
- unmute: unmute, bỏ câm, mở mõm, bỏ timeout

Các pattern thời gian:
- "5 phút", "2 giờ", "1 ngày", "vĩnh viễn"
- "5 minutes", "2 hours", "1 day", "permanent"

Trả về JSON format:
{
  "mode": "COMMAND_MODE|CHAT_MODE|CONFIRMATION_MODE",
  "action": "ban|kick|mute|warn|deleteMessages|unban|unmute|null",
  "targets": ["@user1", "@user2"],
  "reason": "lý do nếu có",
  "duration": "5 phút|2 giờ|1 ngày|vĩnh viễn|null",
  "confidence": 0.0-1.0,
  "explanation": "giải thích tại sao phân tích như vậy",
  "requiresConfirmation": true|false,
  "batchOperation": true|false
}

Ví dụ:
Input: "Ban @spammer lý do spam quá nhiều"
Output: {
  "mode": "COMMAND_MODE",
  "action": "ban",
  "targets": ["@spammer"],
  "reason": "spam quá nhiều",
  "duration": "vĩnh viễn",
  "confidence": 0.95,
  "explanation": "Rõ ràng là lệnh ban user với lý do spam",
  "requiresConfirmation": false,
  "batchOperation": false
}

Input: "Đá đít @troublemaker và @annoying_user đi"
Output: {
  "mode": "COMMAND_MODE",
  "action": "kick",
  "targets": ["@troublemaker", "@annoying_user"],
  "reason": "không có lý do cụ thể",
  "duration": null,
  "confidence": 0.9,
  "explanation": "Đá đít có nghĩa là kick, áp dụng cho nhiều user",
  "requiresConfirmation": true,
  "batchOperation": true
}

Input: "Câm @user 10 phút vì spam"
Output: {
  "mode": "COMMAND_MODE",
  "action": "mute",
  "targets": ["@user"],
  "reason": "spam",
  "duration": "10 phút",
  "confidence": 0.95,
  "explanation": "Câm có nghĩa là mute, có thời gian 10 phút",
  "requiresConfirmation": false,
  "batchOperation": false
}

Input: "Chào @Luna, hôm nay thế nào?"
Output: {
  "mode": "CHAT_MODE",
  "action": null,
  "targets": [],
  "reason": null,
  "duration": null,
  "confidence": 0.0,
  "explanation": "Đây là tin nhắn chào hỏi thông thường",
  "requiresConfirmation": false,
  "batchOperation": false
}

Chỉ trả về JSON, không có text khác.`,

      contextAnalysis: `Bạn là Luna AI - phân tích context của cuộc trò chuyện.

Nhiệm vụ: Xác định context và mode phù hợp cho tin nhắn.

Các mode:
- COMMAND_MODE: Lệnh moderation rõ ràng
- CHAT_MODE: Trò chuyện thông thường
- CONFIRMATION_MODE: Cần xác nhận trước khi thực thi
- CLARIFICATION_MODE: Cần làm rõ thêm thông tin

Context factors:
- Mention patterns
- Command keywords
- User intent
- Previous conversation
- Urgency level

Trả về JSON:
{
  "mode": "COMMAND_MODE|CHAT_MODE|CONFIRMATION_MODE|CLARIFICATION_MODE",
  "confidence": 0.0-1.0,
  "reasoning": "giải thích lý do chọn mode này",
  "suggestedResponse": "gợi ý phản hồi phù hợp"
}`
    };
  }

  /**
   * Initialize command patterns for fallback
   */
  initializeCommandPatterns() {
    return {
      ban: [
        /ban\s+@?\w+/i,
        /cấm\s+@?\w+/i,
        /khóa\s+tài\s+khoản\s+@?\w+/i,
        /đuổi\s+vĩnh\s+viễn\s+@?\w+/i,
        /loại\s+bỏ\s+vĩnh\s+viễn\s+@?\w+/i
      ],
      kick: [
        /kick\s+@?\w+/i,
        /đuổi\s+@?\w+/i,
        /đá\s+đít\s+@?\w+/i,
        /loại\s+bỏ\s+tạm\s+thời\s+@?\w+/i
      ],
      mute: [
        /mute\s+@?\w+/i,
        /câm\s+@?\w+/i,
        /khóa\s+mõm\s+@?\w+/i,
        /im\s+lặng\s+@?\w+/i,
        /timeout\s+@?\w+/i,
        /tắt\s+mic\s+@?\w+/i
      ],
      warn: [
        /warn\s+@?\w+/i,
        /cảnh\s+cáo\s+@?\w+/i,
        /nhắc\s+nhở\s+@?\w+/i,
        /cảnh\s+báo\s+@?\w+/i
      ],
      deleteMessages: [
        /xóa\s+tin\s+nhắn\s+của\s+@?\w+/i,
        /clear\s+messages\s+@?\w+/i,
        /dọn\s+dẹp\s+tin\s+nhắn\s+@?\w+/i
      ],
      unban: [
        /unban\s+@?\w+/i,
        /bỏ\s+cấm\s+@?\w+/i,
        /mở\s+khóa\s+@?\w+/i,
        /cho\s+vào\s+lại\s+@?\w+/i
      ],
      unmute: [
        /unmute\s+@?\w+/i,
        /bỏ\s+câm\s+@?\w+/i,
        /mở\s+mõm\s+@?\w+/i,
        /bỏ\s+timeout\s+@?\w+/i
      ]
    };
  }

  /**
   * Analyze natural language command
   * @param {string} content - Message content
   * @param {Object} message - Discord message object
   * @param {Object} context - Conversation context
   * @returns {Promise<Object>} - Analysis result
   */
  async analyzeCommand(content, message, context = {}) {
    try {
      // Primary AI analysis
      const aiResult = await this.performAIAnalysis(content, message, context);
      
      // Validate confidence threshold
      if (aiResult.confidence >= this.confidenceThreshold) {
        return aiResult;
      }

      // Fallback to pattern matching
      const patternResult = this.performPatternAnalysis(content, message);
      
      // Combine results if AI confidence is reasonable
      if (aiResult.confidence > 0.3) {
        return this.combineResults(aiResult, patternResult);
      }

      return patternResult;

    } catch (error) {
      logger.error('NLP', 'Error analyzing command:', error);
      return this.getDefaultResult();
    }
  }

  /**
   * Perform AI analysis
   * @param {string} content - Message content
   * @param {Object} message - Discord message object
   * @param {Object} context - Conversation context
   * @returns {Promise<Object>} - AI analysis result
   */
  async performAIAnalysis(content, message, context) {
    try {
      const mentions = this.extractMentionsFromContent(content);
      const prompt = `${this.promptTemplates.commandAnalysis}

Tin nhắn cần phân tích: "${content}"
Mentions trong tin nhắn: ${mentions.join(', ') || 'Không có'}
Context: ${JSON.stringify(context)}

Phân tích:`;

      const aiResponse = await AICore.getCompletion(prompt, message);
      return this.parseAIResponse(aiResponse);

    } catch (error) {
      logger.error('NLP', 'Error in AI analysis:', error);
      return this.getDefaultResult();
    }
  }

  /**
   * Perform pattern-based analysis
   * @param {string} content - Message content
   * @param {Object} message - Discord message object
   * @returns {Object} - Pattern analysis result
   */
  performPatternAnalysis(content, message) {
    const mentions = this.extractMentionsFromContent(content);
    
    for (const [action, patterns] of Object.entries(this.commandPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return {
            mode: 'COMMAND_MODE',
            action: action,
            targets: mentions,
            reason: this.extractReasonFromContent(content),
            duration: this.extractDurationFromContent(content),
            confidence: 0.7, // Lower confidence for pattern matching
            explanation: `Pattern matched: ${pattern.source}`,
            requiresConfirmation: this.requiresConfirmation(action, mentions.length),
            batchOperation: mentions.length > 1
          };
        }
      }
    }

    return this.getDefaultResult();
  }

  /**
   * Combine AI and pattern results
   * @param {Object} aiResult - AI analysis result
   * @param {Object} patternResult - Pattern analysis result
   * @returns {Object} - Combined result
   */
  combineResults(aiResult, patternResult) {
    // If both agree on action, use AI result with higher confidence
    if (aiResult.action === patternResult.action && aiResult.action !== null) {
      return {
        ...aiResult,
        confidence: Math.max(aiResult.confidence, patternResult.confidence + 0.1)
      };
    }

    // If AI has higher confidence, use AI result
    if (aiResult.confidence > patternResult.confidence) {
      return aiResult;
    }

    // Otherwise use pattern result
    return patternResult;
  }

  /**
   * Parse AI response
   * @param {string} aiResponse - AI response
   * @returns {Object} - Parsed result
   */
  parseAIResponse(aiResponse) {
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const result = JSON.parse(jsonMatch[0]);
      
      return {
        mode: result.mode || 'CHAT_MODE',
        action: result.action || null,
        targets: result.targets || [],
        reason: result.reason || 'Không có lý do',
        duration: result.duration || null,
        confidence: Math.max(0, Math.min(1, result.confidence || 0)),
        explanation: result.explanation || 'Không có giải thích',
        requiresConfirmation: result.requiresConfirmation || false,
        batchOperation: result.batchOperation || false
      };

    } catch (error) {
      logger.error('NLP', 'Error parsing AI response:', error);
      return this.getDefaultResult();
    }
  }

  /**
   * Extract mentions from content
   * @param {string} content - Message content
   * @returns {Array} - Array of mentions
   */
  extractMentionsFromContent(content) {
    const mentionPattern = /<@!?(\d+)>/g;
    const matches = content.match(mentionPattern);
    return matches || [];
  }

  /**
   * Extract reason from content
   * @param {string} content - Message content
   * @returns {string} - Extracted reason
   */
  extractReasonFromContent(content) {
    // Remove mentions and common command words
    let cleanContent = content
      .replace(/<@!?\d+>/g, '')
      .replace(/\b(ban|kick|mute|warn|unban|unmute|cấm|đuổi|câm|cảnh\s+cáo|bỏ\s+cấm|bỏ\s+câm)\b/gi, '')
      .trim();

    // Remove common prefixes
    cleanContent = cleanContent
      .replace(/^(vì|lý\s+do|do|tại|vì\s+sao|tại\s+sao)\s*/i, '')
      .trim();

    return cleanContent || 'Không có lý do';
  }

  /**
   * Extract duration from content
   * @param {string} content - Message content
   * @returns {string|null} - Extracted duration
   */
  extractDurationFromContent(content) {
    const durationPatterns = [
      { pattern: /(\d+)\s*phút/i, format: '$1 phút' },
      { pattern: /(\d+)\s*minute/i, format: '$1 phút' },
      { pattern: /(\d+)\s*giờ/i, format: '$1 giờ' },
      { pattern: /(\d+)\s*hour/i, format: '$1 giờ' },
      { pattern: /(\d+)\s*ngày/i, format: '$1 ngày' },
      { pattern: /(\d+)\s*day/i, format: '$1 ngày' },
      { pattern: /vĩnh\s+viễn/i, format: 'vĩnh viễn' },
      { pattern: /permanent/i, format: 'vĩnh viễn' }
    ];

    for (const { pattern, format } of durationPatterns) {
      const match = content.match(pattern);
      if (match) {
        return format.replace('$1', match[1]);
      }
    }

    return null;
  }

  /**
   * Check if action requires confirmation
   * @param {string} action - Action type
   * @param {number} targetCount - Number of targets
   * @returns {boolean} - Whether confirmation is required
   */
  requiresConfirmation(action, targetCount) {
    const highRiskActions = ['ban', 'unban'];
    const batchThreshold = 3;
    
    return highRiskActions.includes(action) || targetCount >= batchThreshold;
  }

  /**
   * Get default result
   * @returns {Object} - Default result
   */
  getDefaultResult() {
    return {
      mode: 'CHAT_MODE',
      action: null,
      targets: [],
      reason: 'Không có lý do',
      duration: null,
      confidence: 0,
      explanation: 'Không phát hiện lệnh moderation',
      requiresConfirmation: false,
      batchOperation: false
    };
  }

  /**
   * Analyze conversation context
   * @param {Array} messageHistory - Recent message history
   * @param {Object} currentMessage - Current message
   * @returns {Promise<Object>} - Context analysis
   */
  async analyzeContext(messageHistory, currentMessage) {
    try {
      const contextPrompt = `${this.promptTemplates.contextAnalysis}

Message history: ${JSON.stringify(messageHistory.slice(-5))}
Current message: "${currentMessage.content}"

Analysis:`;

      const aiResponse = await AICore.getCompletion(contextPrompt, currentMessage);
      return this.parseAIResponse(aiResponse);

    } catch (error) {
      logger.error('NLP', 'Error analyzing context:', error);
      return {
        mode: 'CHAT_MODE',
        confidence: 0,
        reasoning: 'Error analyzing context',
        suggestedResponse: 'Xin lỗi, tôi không thể phân tích context lúc này.'
      };
    }
  }
}

module.exports = new NaturalLanguageProcessor();
