const logger = require('../utils/logger.js');

class ModerationUtilsService {
  constructor() {
    this.durationPatterns = this.initializeDurationPatterns();
    this.reasonPatterns = this.initializeReasonPatterns();
    this.actionAliases = this.initializeActionAliases();
  }

  /**
   * Initialize duration parsing patterns
   */
  initializeDurationPatterns() {
    return [
      // Vietnamese patterns
      { pattern: /(\d+)\s*phút/i, multiplier: 1, unit: 'phút' },
      { pattern: /(\d+)\s*giờ/i, multiplier: 60, unit: 'giờ' },
      { pattern: /(\d+)\s*ngày/i, multiplier: 1440, unit: 'ngày' },
      { pattern: /(\d+)\s*tuần/i, multiplier: 10080, unit: 'tuần' },
      { pattern: /(\d+)\s*tháng/i, multiplier: 43200, unit: 'tháng' },
      
      // English patterns
      { pattern: /(\d+)\s*minute/i, multiplier: 1, unit: 'minute' },
      { pattern: /(\d+)\s*hour/i, multiplier: 60, unit: 'hour' },
      { pattern: /(\d+)\s*day/i, multiplier: 1440, unit: 'day' },
      { pattern: /(\d+)\s*week/i, multiplier: 10080, unit: 'week' },
      { pattern: /(\d+)\s*month/i, multiplier: 43200, unit: 'month' },
      
      // Special patterns
      { pattern: /vĩnh\s+viễn/i, multiplier: 'permanent', unit: 'permanent' },
      { pattern: /permanent/i, multiplier: 'permanent', unit: 'permanent' },
      { pattern: /forever/i, multiplier: 'permanent', unit: 'permanent' }
    ];
  }

  /**
   * Initialize reason extraction patterns
   */
  initializeReasonPatterns() {
    return {
      prefixes: [
        /vì\s+/i,
        /lý\s+do\s+/i,
        /do\s+/i,
        /tại\s+/i,
        /vì\s+sao\s+/i,
        /tại\s+sao\s+/i,
        /because\s+/i,
        /reason\s+/i,
        /for\s+/i
      ],
      separators: [
        /\s*-\s*/,
        /\s*:\s*/,
        /\s*,\s*/,
        /\s*\.\s*/
      ],
      stopWords: [
        'và', 'and', 'hoặc', 'or', 'nhưng', 'but',
        'cũng', 'also', 'nữa', 'too', 'nữa', 'as well'
      ]
    };
  }

  /**
   * Initialize action aliases
   */
  initializeActionAliases() {
    return {
      ban: ['ban', 'cấm', 'khóa tài khoản', 'đuổi vĩnh viễn', 'loại bỏ vĩnh viễn'],
      kick: ['kick', 'đuổi', 'đá đít', 'loại bỏ tạm thời', 'đuổi ra khỏi server'],
      mute: ['mute', 'câm', 'khóa mõm', 'im lặng', 'timeout', 'tắt mic', 'tạm dừng'],
      warn: ['warn', 'cảnh cáo', 'nhắc nhở', 'cảnh báo', 'warning'],
      deleteMessages: ['xóa tin nhắn', 'clear messages', 'dọn dẹp tin nhắn', 'xóa messages'],
      unban: ['unban', 'bỏ cấm', 'mở khóa', 'cho vào lại', 'unlock'],
      unmute: ['unmute', 'bỏ câm', 'mở mõm', 'bỏ timeout', 'unlock mic']
    };
  }

  /**
   * Parse duration from text
   * @param {string} text - Text containing duration
   * @returns {Object} - Parsed duration
   */
  parseDuration(text) {
    if (!text) {
      return { value: 10, unit: 'phút', original: null };
    }

    for (const { pattern, multiplier, unit } of this.durationPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = multiplier === 'permanent' ? 'permanent' : parseInt(match[1]) * multiplier;
        return {
          value: value,
          unit: unit,
          original: match[0],
          minutes: multiplier === 'permanent' ? 'permanent' : value
        };
      }
    }

    // Default to 10 minutes if no pattern matches
    return { value: 10, unit: 'phút', original: null, minutes: 10 };
  }

  /**
   * Extract reason from text
   * @param {string} text - Text containing reason
   * @param {string} action - Action being performed
   * @returns {string} - Extracted reason
   */
  extractReason(text, action = '') {
    if (!text) {
      return 'Không có lý do được cung cấp';
    }

    let cleanText = text.trim();

    // Remove action keywords
    const actionKeywords = this.actionAliases[action] || [];
    for (const keyword of actionKeywords) {
      cleanText = cleanText.replace(new RegExp(keyword, 'gi'), '').trim();
    }

    // Remove mentions
    cleanText = cleanText.replace(/<@!?\d+>/g, '').trim();

    // Remove duration patterns
    for (const { pattern } of this.durationPatterns) {
      cleanText = cleanText.replace(pattern, '').trim();
    }

    // Remove reason prefixes
    for (const prefix of this.reasonPatterns.prefixes) {
      cleanText = cleanText.replace(prefix, '').trim();
    }

    // Remove separators and clean up
    for (const separator of this.reasonPatterns.separators) {
      cleanText = cleanText.replace(separator, ' ').trim();
    }

    // Remove stop words
    for (const stopWord of this.reasonPatterns.stopWords) {
      const regex = new RegExp(`\\b${stopWord}\\b`, 'gi');
      cleanText = cleanText.replace(regex, '').trim();
    }

    // Clean up multiple spaces
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    return cleanText || 'Không có lý do được cung cấp';
  }

  /**
   * Validate duration
   * @param {Object} duration - Duration object
   * @param {string} action - Action type
   * @returns {Object} - Validation result
   */
  validateDuration(duration, action) {
    const limits = {
      mute: { max: 40320, min: 1 }, // Max 4 weeks, min 1 minute
      timeout: { max: 40320, min: 1 }, // Max 4 weeks, min 1 minute
      ban: { max: 'permanent', min: 'permanent' }, // Only permanent
      kick: { max: 0, min: 0 }, // No duration
      warn: { max: 0, min: 0 }, // No duration
      deleteMessages: { max: 0, min: 0 } // No duration
    };

    const limit = limits[action];
    if (!limit) {
      return { valid: true, reason: 'No limits defined for this action' };
    }

    if (duration.value === 'permanent') {
      if (action === 'ban') {
        return { valid: true, reason: 'Permanent ban is allowed' };
      } else {
        return { valid: false, reason: 'Permanent duration not allowed for this action' };
      }
    }

    if (limit.max === 0 && limit.min === 0) {
      return { valid: false, reason: 'Duration not allowed for this action' };
    }

    if (duration.minutes < limit.min) {
      return { valid: false, reason: `Duration too short. Minimum: ${limit.min} minutes` };
    }

    if (limit.max !== 'permanent' && duration.minutes > limit.max) {
      return { valid: false, reason: `Duration too long. Maximum: ${limit.max} minutes` };
    }

    return { valid: true, reason: 'Duration is valid' };
  }

  /**
   * Format duration for display
   * @param {Object} duration - Duration object
   * @returns {string} - Formatted duration string
   */
  formatDuration(duration) {
    if (duration.value === 'permanent') {
      return 'vĩnh viễn';
    }

    if (duration.minutes < 60) {
      return `${duration.minutes} phút`;
    } else if (duration.minutes < 1440) {
      const hours = Math.round(duration.minutes / 60);
      return `${hours} giờ`;
    } else if (duration.minutes < 10080) {
      const days = Math.round(duration.minutes / 1440);
      return `${days} ngày`;
    } else {
      const weeks = Math.round(duration.minutes / 10080);
      return `${weeks} tuần`;
    }
  }

  /**
   * Parse action from text
   * @param {string} text - Text containing action
   * @returns {string|null} - Parsed action or null
   */
  parseAction(text) {
    if (!text) return null;

    const lowerText = text.toLowerCase();

    for (const [action, aliases] of Object.entries(this.actionAliases)) {
      for (const alias of aliases) {
        if (lowerText.includes(alias.toLowerCase())) {
          return action;
        }
      }
    }

    return null;
  }

  /**
   * Extract targets from text
   * @param {string} text - Text containing targets
   * @param {Array} mentions - Available mentions
   * @returns {Array} - Extracted targets
   */
  extractTargets(text, mentions) {
    const targets = [];
    const mentionPattern = /<@!?(\d+)>/g;
    const matches = text.matchAll(mentionPattern);

    for (const match of matches) {
      const userId = match[1];
      const mention = mentions.find(m => m.id === userId);
      if (mention) {
        targets.push(mention);
      }
    }

    return targets;
  }

  /**
   * Generate operation summary
   * @param {Object} operation - Operation data
   * @returns {string} - Summary string
   */
  generateOperationSummary(operation) {
    const { action, targets, reason, duration } = operation;
    
    let summary = `**Hành động:** ${action.toUpperCase()}\n`;
    summary += `**Targets:** ${targets.map(t => t.displayName).join(', ')}\n`;
    summary += `**Lý do:** ${reason}\n`;
    
    if (duration && duration.value !== 'permanent') {
      summary += `**Thời gian:** ${this.formatDuration(duration)}\n`;
    } else if (duration && duration.value === 'permanent') {
      summary += `**Thời gian:** Vĩnh viễn\n`;
    }

    return summary;
  }

  /**
   * Validate operation parameters
   * @param {Object} operation - Operation data
   * @returns {Object} - Validation result
   */
  validateOperation(operation) {
    const errors = [];

    // Validate action
    if (!operation.action || !this.actionAliases[operation.action]) {
      errors.push('Invalid action type');
    }

    // Validate targets
    if (!operation.targets || operation.targets.length === 0) {
      errors.push('No targets specified');
    }

    // Validate duration if applicable
    if (operation.duration) {
      const durationValidation = this.validateDuration(operation.duration, operation.action);
      if (!durationValidation.valid) {
        errors.push(durationValidation.reason);
      }
    }

    // Validate reason
    if (!operation.reason || operation.reason.trim().length === 0) {
      errors.push('No reason provided');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Get action help text
   * @param {string} action - Action type
   * @returns {string} - Help text
   */
  getActionHelp(action) {
    const helpTexts = {
      ban: 'Cấm user khỏi server vĩnh viễn. Sử dụng: "ban @user lý do"',
      kick: 'Đuổi user khỏi server tạm thời. Sử dụng: "kick @user lý do"',
      mute: 'Tắt mic user trong thời gian nhất định. Sử dụng: "mute @user 10 phút lý do"',
      warn: 'Cảnh báo user. Sử dụng: "warn @user lý do"',
      deleteMessages: 'Xóa tin nhắn của user. Sử dụng: "xóa tin nhắn @user"',
      unban: 'Bỏ cấm user. Sử dụng: "unban @user lý do"',
      unmute: 'Bỏ mute user. Sử dụng: "unmute @user lý do"'
    };

    return helpTexts[action] || 'Không có thông tin trợ giúp cho hành động này';
  }
}

module.exports = new ModerationUtilsService();
