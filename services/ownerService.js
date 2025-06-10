const logger = require("../utils/logger.js");
const neuralNetworks = require("./NeuralNetworks.js");
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
      return "Bạn đang nói về người sáng lập của mình à? 😊";
    }

    try {
      const prompt = prompts.owner.mentionResponse
        .replace("${ownerUsername}", this.ownerInfo.username)
        .replace("${ownerDisplayName}", this.ownerInfo.displayName)
        .replace("${context}", context);

      const response = await neuralNetworks.getCompletion(prompt);
      return response;
    } catch (error) {
      logger.error(
        "OWNER",
        "Lỗi khi tạo phản hồi động cho owner mention:",
        error
      );
      return "Lỗi khi tạo phản hồi động.";
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
      const response = await neuralNetworks.getCompletion(prompt);
      return response;
    } catch (error) {
      logger.error("OWNER", "Lỗi khi tạo lời chào động cho owner:", error);
      // Fallback greeting nếu API lỗi
      return `Chào ${this.ownerInfo.displayName}! 💖 Rất vui khi gặp lại creator của mình nè~ ✨`;
    }
  }

  /**
   * Refresh thông tin owner (gọi lại API Discord)
   */
  async refreshOwnerInfo() {
    await this.loadOwnerInfo();
  }
}

// Export singleton instance
module.exports = new OwnerService();
