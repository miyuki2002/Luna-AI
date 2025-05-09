const storageDB = require('../services/storagedb.js');
const logger = require('../utils/logger.js');

// Sử dụng closure để ngăn chặn truy cập trực tiếp
const conversationManager = (() => {
  // Lưu trữ cuộc trò chuyện trong bộ nhớ tạm thời theo userId
  const userConversations = new Map();
  
  // Dùng để theo dõi thời gian hoạt động cuối cùng của người dùng
  const userLastActivity = new Map();

  /**
   * Xác thực và chuẩn hóa userId
   * @param {string} userId - Định danh người dùng cần kiểm tra
   * @returns {string} - Định danh người dùng đã chuẩn hóa
   * @throws {Error} - Nếu userId không hợp lệ
   */
  const validateUserId = (userId) => {
    if (!userId || typeof userId !== 'string') {
      throw new Error('UserId không hợp lệ: userId phải là một chuỗi không rỗng');
    }
    
    const trimmedId = userId.trim();
    if (!trimmedId || trimmedId === 'null' || trimmedId === 'undefined') {
      throw new Error('UserId không hợp lệ: userId không thể rỗng, "null", hoặc "undefined"');
    }
    
    return trimmedId;
  };

  /**
   * Lấy lịch sử cuộc trò chuyện cục bộ của người dùng
   * @param {string} userId - Định danh người dùng
   * @returns {Array} - Lịch sử cuộc trò chuyện của người dùng
   */
  const getUserHistory = (userId) => {
    try {
      const validUserId = validateUserId(userId);
      
      if (!userConversations.has(validUserId)) {
        userConversations.set(validUserId, []);
        userLastActivity.set(validUserId, Date.now());
      } else {
        // Cập nhật thời gian hoạt động mới nhất
        userLastActivity.set(validUserId, Date.now());
      }
      
      return userConversations.get(validUserId);
    } catch (error) {
      logger.error('CONVERSATION', `Lỗi khi lấy lịch sử cuộc trò chuyện: ${error.message}`);
      return [];
    }
  };

  // Dọn dẹp bộ nhớ định kỳ - xóa cuộc trò chuyện không hoạt động sau 30 phút
  setInterval(() => {
    const now = Date.now();
    const inactiveThreshold = 30 * 60 * 1000; // 30 phút
    
    for (const [userId, lastActive] of userLastActivity.entries()) {
      if (now - lastActive > inactiveThreshold) {
        userConversations.delete(userId);
        userLastActivity.delete(userId);
        logger.debug('CONVERSATION', `Đã xóa bộ đệm cuộc trò chuyện không hoạt động cho user ${userId}`);
      }
    }
  }, 10 * 60 * 1000); // Kiểm tra mỗi 10 phút

  return {
    /**
     * Tải lịch sử cuộc trò chuyện từ bộ nhớ
     * @param {string} userId - Định danh người dùng
     * @param {string} systemPrompt - System prompt để sử dụng
     * @param {string} modelName - Tên mô hình đang được sử dụng
     * @returns {Promise<Array>} - Lịch sử cuộc trò chuyện
     */
    async loadConversationHistory(userId, systemPrompt, modelName) {
      try {
        const validUserId = validateUserId(userId);
        
        const history = await storageDB.getConversationHistory(validUserId, systemPrompt, modelName);

        // Cập nhật cache cục bộ cho user
        const userHistory = getUserHistory(validUserId);
        userHistory.length = 0;
        history.forEach(msg => userHistory.push(msg));

        logger.debug('CONVERSATION', `Đã tải ${history.length} tin nhắn cho userId: ${validUserId}`);
        return [...userHistory];
      } catch (error) {
        logger.error('CONVERSATION', `Lỗi khi tải lịch sử cuộc trò chuyện: ${error.message}`);
        return [{
          role: 'system',
          content: systemPrompt + ` You are running on ${modelName} model.`
        }];
      }
    },

    /**
     * Thêm tin nhắn vào lịch sử cuộc trò chuyện
     * @param {string} userId - Định danh người dùng
     * @param {string} role - Vai trò tin nhắn (user/assistant/system)
     * @param {string} content - Nội dung tin nhắn
     * @returns {Promise<boolean>} - Kết quả của thao tác với cơ sở dữ liệu
     */
    async addMessage(userId, role, content) {
      try {
        const validUserId = validateUserId(userId);
        
        // Thêm vào cache cục bộ
        const userHistory = getUserHistory(validUserId);
        userHistory.push({ role, content });

        // Lưu vào cơ sở dữ liệu
        await storageDB.addMessageToConversation(validUserId, role, content);
        logger.debug('CONVERSATION', `Đã thêm tin nhắn (${role}) cho userId: ${validUserId}`);
        return true;
      } catch (error) {
        logger.error('CONVERSATION', `Lỗi khi thêm tin nhắn: ${error.message}`);
        return false;
      }
    },

    /**
     * Lấy lịch sử cuộc trò chuyện hiện tại của người dùng
     * @param {string} userId - Định danh người dùng
     * @returns {Array} - Bản sao của lịch sử cuộc trò chuyện
     */
    getHistory(userId) {
      try {
        const validUserId = validateUserId(userId);
        const history = [...getUserHistory(validUserId)];
        logger.debug('CONVERSATION', `Đã lấy ${history.length} tin nhắn từ bộ nhớ cache cho userId: ${validUserId}`);
        return history;
      } catch (error) {
        logger.error('CONVERSATION', `Lỗi khi lấy lịch sử: ${error.message}`);
        return [];
      }
    },

    /**
     * Xóa lịch sử cuộc trò chuyện cục bộ của người dùng
     * @param {string} userId - Định danh người dùng
     * @returns {boolean} - Kết quả xóa
     */
    clearLocalHistory(userId) {
      try {
        if (userId) {
          const validUserId = validateUserId(userId);
          // Xóa lịch sử của người dùng cụ thể
          if (userConversations.has(validUserId)) {
            userConversations.get(validUserId).length = 0;
            logger.debug('CONVERSATION', `Đã xóa lịch sử cục bộ cho userId: ${validUserId}`);
          }
        } else {
          // Xóa tất cả lịch sử nếu không cung cấp userId
          userConversations.clear();
          userLastActivity.clear();
          logger.debug('CONVERSATION', 'Đã xóa tất cả lịch sử cuộc trò chuyện cục bộ');
        }
        return true;
      } catch (error) {
        logger.error('CONVERSATION', `Lỗi khi xóa lịch sử: ${error.message}`);
        return false;
      }
    },
    
    /**
     * Xóa hoàn toàn lịch sử cuộc trò chuyện (cả cục bộ và cơ sở dữ liệu)
     * @param {string} userId - Định danh người dùng
     * @param {string} systemPrompt - System prompt mới
     * @param {string} modelName - Tên mô hình
     * @returns {Promise<boolean>} - Kết quả xóa
     */
    async resetConversation(userId, systemPrompt, modelName) {
      try {
        const validUserId = validateUserId(userId);
        
        // Xóa khỏi bộ nhớ cục bộ
        this.clearLocalHistory(validUserId);
        
        // Xóa trong cơ sở dữ liệu và khởi tạo lại
        await storageDB.clearConversationHistory(validUserId, systemPrompt, modelName);
        logger.info('CONVERSATION', `Đã xóa hoàn toàn cuộc trò chuyện cho userId: ${validUserId}`);
        
        // Tải lịch sử mới (chỉ có system prompt)
        await this.loadConversationHistory(validUserId, systemPrompt, modelName);
        return true;
      } catch (error) {
        logger.error('CONVERSATION', `Lỗi khi reset cuộc trò chuyện: ${error.message}`);
        return false;
      }
    }
  };
})();

module.exports = conversationManager;
