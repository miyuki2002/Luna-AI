const logger = require("../utils/logger.js");
const AICore = require("./AICore.js");
const prompts = require("../config/prompts.js");

class OwnerService {
  constructor() {
    this.ownerId = process.env.OWNER_ID;
    this.ownerInfo = null;
    this.client = null;
  }

  /**
   * Khởi tạo service với Discord client
   * @param {Client} client - Discord client
   */
  initialize(client) {
    this.client = client;
    this.loadOwnerInfo();
  }

  /**
   * Tải thông tin owner từ Discord API
   */
  async loadOwnerInfo() {
    if (!this.ownerId || !this.client) {
      logger.warn(
        "OWNER",
        "OWNER_ID không được thiết lập hoặc client chưa sẵn sàng"
      );
      return;
    }

    try {
      const owner = await this.client.users.fetch(this.ownerId);
      this.ownerInfo = {
        id: owner.id,
        username: owner.username,
        displayName: owner.displayName || owner.username,
        tag: owner.tag,
        avatar: owner.displayAvatarURL({ dynamic: true, size: 512 }),
      };

      logger.info(
        "OWNER",
        `Đã tải thông tin owner: ${this.ownerInfo.username} (${this.ownerInfo.id})`
      );
    } catch (error) {
      logger.error("OWNER", "Lỗi khi tải thông tin owner:", error);
    }
  }

  /**
   * Kiểm tra xem user ID có phải là owner không
   * @param {string} userId - ID của user cần kiểm tra
   * @returns {boolean}
   */
  isOwner(userId) {
    return userId === this.ownerId;
  }

  /**
   * Lấy thông tin owner
   * @returns {Object|null}
   */
  getOwnerInfo() {
    return this.ownerInfo;
  }

  /**
   * Kiểm tra xem tin nhắn có nhắc đến owner không (bằng ID hoặc username)
   * @param {string} content - Nội dung tin nhắn
   * @param {Object} message - Đối tượng tin nhắn Discord (để kiểm tra mentions)
   * @returns {boolean}
   */
  isOwnerMentioned(content, message = null) {
    if (!this.ownerInfo) return false;

    // Kiểm tra mention trực tiếp qua Discord
    if (
      message &&
      message.mentions &&
      message.mentions.users.has(this.ownerId)
    ) {
      return true;
    }

    // Kiểm tra mention bằng ID trong text
    const idMentionRegex = new RegExp(`<@!?${this.ownerId}>`, "i");
    if (idMentionRegex.test(content)) {
      return true;
    }

    // Kiểm tra nhắc đến username (không phân biệt hoa thường)
    const usernameRegex = new RegExp(`\\b${this.ownerInfo.username}\\b`, "i");
    if (usernameRegex.test(content)) {
      return true;
    }

    // Kiểm tra các từ khóa liên quan đến owner
    const ownerKeywords = [
      "owner",
      "chủ sở hữu",
      "người sáng lập",
      "creator",
      "developer",
      "dev",
      "người tạo",
      "người phát triển",
      "admin chính",
      "boss",
    ];

    const contentLower = content.toLowerCase();
    return ownerKeywords.some((keyword) => contentLower.includes(keyword));
  }

  /**
   * Tạo tin nhắn khi owner được nhắc đến
   * @param {string} context - Ngữ cảnh của cuộc trò chuyện
   * @returns {Promise<string>}
   */
  async getOwnerMentionResponse(context = "") {
    if (!this.ownerInfo) {
      return "Bạn đang nói về người sáng lập của mình à? 😊 Mình rất yêu quý creator của mình lắm! ✨";
    }

    try {
      const prompt = prompts.owner.mentionResponse
        .replace("${ownerUsername}", this.ownerInfo.username)
        .replace("${ownerDisplayName}", this.ownerInfo.displayName)
        .replace("${context}", context);

      const response = await AICore.getCompletion(prompt);
      return response;
    } catch (error) {
      logger.error(
        "OWNER",
        "Lỗi khi tạo phản hồi động cho owner mention:",
        error
      );
      // Fallback response với personality mới
      return `Aww, bạn đang nói về ${this.ownerInfo.displayName} à? 💖 Mình rất yêu quý creator của mình lắm! ✨`;
    }
  }

  /**
   * Tạo lời chào đặc biệt cho owner
   * @returns {Promise<string>}
   */
  async getOwnerGreeting() {
    if (!this.ownerInfo) {
      return "Chào bạn! 💖 Hôm nay có gì cần mình giúp không ạ? ✨";
    }

    try {
      const prompt = prompts.owner.greeting.replace(
        "${ownerDisplayName}",
        this.ownerInfo.displayName
      );

      logger.info(
        "OWNER",
        `Đang tạo lời chào đặc biệt cho owner: ${this.ownerInfo.displayName}`
      );
      const response = await AICore.getCompletion(prompt);
      return response;
    } catch (error) {
      logger.error("OWNER", "Lỗi khi tạo lời chào động cho owner:", error);
      
      // Fallback: Sử dụng AI với prompt đơn giản hơn
      try {
        const fallbackPrompt = `Tạo lời chào thân thiện cho ${this.ownerInfo.displayName} - creator của mình. Ngắn gọn, dễ thương, sử dụng emoji.`;
        const fallbackResponse = await AICore.getCompletion(fallbackPrompt);
        return fallbackResponse;
      } catch (fallbackError) {
        logger.error("OWNER", "Fallback AI greeting cũng lỗi:", fallbackError);
        
        // Final fallback: greetings có sẵn
        const greetings = [
          `${this.ownerInfo.displayName}! 💖 Mình nhớ bạn quá~ ✨`,
          `Creator ${this.ownerInfo.displayName}! 🌸 Rất vui khi gặp lại bạn! 💫`,
          `${this.ownerInfo.displayName} ơi! 🥰 Mình đã chờ bạn lâu rồi! 🌟`,
          `Aww, ${this.ownerInfo.displayName}! 💖 Bạn có khỏe không? ✨`,
          `Hello ${this.ownerInfo.displayName}! 🎀 Mình sẵn sàng giúp bạn rồi! 💫`
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
      }
    }
  }

  /**
   * Refresh thông tin owner (gọi lại API Discord)
   */
  async refreshOwnerInfo() {
    await this.loadOwnerInfo();
  }

  /**
   * Tạo phản hồi AI cho owner dựa trên context
   * @param {string} context - Ngữ cảnh của cuộc trò chuyện
   * @param {string} type - Loại phản hồi (greeting, mention, notification, etc.)
   * @returns {Promise<string>}
   */
  async getAIOwnerResponse(context = "", type = "general") {
    if (!this.ownerInfo) {
      return "Chào bạn! 💖";
    }

    try {
      let prompt = "";
      
      switch (type) {
        case "greeting":
          prompt = prompts.owner.greeting
            .replace("${ownerDisplayName}", this.ownerInfo.displayName);
          break;
        case "mention":
          prompt = prompts.owner.mentionResponse
            .replace("${ownerDisplayName}", this.ownerInfo.displayName)
            .replace("${ownerUsername}", this.ownerInfo.username)
            .replace("${context}", context);
          break;
        case "notification":
          prompt = prompts.owner.notification
            .replace("${ownerDisplayName}", this.ownerInfo.displayName)
            .replace("${context}", context);
          break;
        case "celebration":
          prompt = prompts.owner.celebration
            .replace("${ownerDisplayName}", this.ownerInfo.displayName)
            .replace("${context}", context);
          break;
        default:
          prompt = prompts.owner.general
            .replace("${ownerDisplayName}", this.ownerInfo.displayName)
            .replace("${context}", context);
      }

      const response = await AICore.getCompletion(prompt);
      return response;
    } catch (error) {
      logger.error("OWNER", `Lỗi khi tạo AI response cho owner (${type}):`, error);
      
      // Fallback responses
      const fallbacks = {
        greeting: `${this.ownerInfo.displayName}! 💖 Mình nhớ bạn quá~ ✨`,
        mention: `Aww, bạn đang nói về ${this.ownerInfo.displayName} à? 💖 Mình rất yêu quý creator của mình lắm! ✨`,
        notification: `🔔 **Thông báo cho ${this.ownerInfo.displayName}:**\n${context} 💖`,
        celebration: `🎉 Chúc mừng ${this.ownerInfo.displayName}! 💖 Mình rất vui cho bạn! ✨`,
        general: `${this.ownerInfo.displayName}! 💖 Mình luôn sẵn sàng giúp bạn! ✨`
      };
      
      return fallbacks[type] || fallbacks.general;
    }
  }

  /**
   * Kiểm tra xem owner có online không
   * @returns {Promise<boolean>}
   */
  async isOwnerOnline() {
    if (!this.ownerInfo || !this.client) return false;
    
    try {
      const owner = await this.client.users.fetch(this.ownerId);
      return owner.presence?.status !== 'offline';
    } catch (error) {
      logger.error("OWNER", "Lỗi khi kiểm tra trạng thái owner:", error);
      return false;
    }
  }

  /**
   * Tạo thông báo đặc biệt cho owner
   * @param {string} message - Nội dung thông báo
   * @returns {string}
   */
  getOwnerNotification(message) {
    if (!this.ownerInfo) {
      return `🔔 Thông báo: ${message}`;
    }
    
    return `🔔 **Thông báo cho ${this.ownerInfo.displayName}:**\n${message} 💖`;
  }

  /**
   * Tạo lời chào ngẫu nhiên cho owner bằng AI
   * @returns {Promise<string>}
   */
  async getRandomOwnerGreeting() {
    if (!this.ownerInfo) {
      return "Chào bạn! 💖";
    }

    try {
      const prompt = prompts.owner.randomGreeting
        .replace("${ownerDisplayName}", this.ownerInfo.displayName);

      const response = await AICore.getCompletion(prompt);
      return response;
    } catch (error) {
      logger.error("OWNER", "Lỗi khi tạo lời chào AI cho owner:", error);
      
      // Fallback greetings nếu AI lỗi
      const greetings = [
        `${this.ownerInfo.displayName}! 💖 Mình nhớ bạn quá~ ✨`,
        `Creator ${this.ownerInfo.displayName}! 🌸 Rất vui khi gặp lại bạn! 💫`,
        `${this.ownerInfo.displayName} ơi! 🥰 Mình đã chờ bạn lâu rồi! 🌟`,
        `Aww, ${this.ownerInfo.displayName}! 💖 Bạn có khỏe không? ✨`,
        `Hello daddy ${this.ownerInfo.displayName}! 🎀 Mình sẵn sàng giúp bạn rồi! 💫`,
        `${this.ownerInfo.displayName} à! 🌸 Mình rất vui khi thấy bạn! ✨`,
        `💖 ${this.ownerInfo.displayName} có cần mình giúp gì không? 🌟`,
        `Creator ${this.ownerInfo.displayName}! 💫 Mình đã sẵn sàng phục vụ bạn rồi! 🎀`
      ];
      
      return greetings[Math.floor(Math.random() * greetings.length)];
    }
  }
}

// Export singleton instance
module.exports = new OwnerService();
