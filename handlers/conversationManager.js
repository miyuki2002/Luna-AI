// Quản lý cuộc trò chuyện
const storageDB = require('../services/storagedb.js');

// Sử dụng closure để ngăn chặn truy cập trước khi khởi tạo
const conversationManager = (() => {
  // Map để lưu trữ lịch sử cuộc trò chuyện riêng biệt cho từng người dùng
  const userConversations = new Map();

  // Lấy hoặc tạo mới lịch sử cuộc trò chuyện cho người dùng
  const getUserHistory = (userId) => {
    if (!userConversations.has(userId)) {
      userConversations.set(userId, []);
    }
    return userConversations.get(userId);
  };

  return {
    /**
     * Tải lịch sử cuộc trò chuyện từ bộ nhớ
     * @param {string} userId - Định danh người dùng
     * @param {string} systemPrompt - System prompt để sử dụng
     * @param {string} modelName - Tên mô hình đang được sử dụng
     * @returns {Promise<Array>} - Lịch sử cuộc trò chuyện
     */
    async loadConversationHistory(userId, systemPrompt, modelName) {
      const history = await storageDB.getConversationHistory(userId, systemPrompt, modelName);

      // Xóa và cập nhật bộ nhớ đệm cục bộ cho người dùng cụ thể
      const userHistory = getUserHistory(userId);
      userHistory.length = 0;
      history.forEach(msg => userHistory.push(msg));

      return [...userHistory];
    },

    /**
     * Thêm tin nhắn vào lịch sử cuộc trò chuyện
     * @param {string} userId - Định danh người dùng
     * @param {string} role - Vai trò tin nhắn (user/assistant/system)
     * @param {string} content - Nội dung tin nhắn
     * @returns {Promise} - Kết quả của thao tác với cơ sở dữ liệu
     */
    addMessage(userId, role, content) {
      // Thêm vào bộ nhớ đệm cục bộ của người dùng cụ thể
      const userHistory = getUserHistory(userId);
      userHistory.push({ role, content });

      // Thêm vào cơ sở dữ liệu
      return storageDB.addMessageToConversation(userId, role, content);
    },

    /**
     * Lấy lịch sử cuộc trò chuyện hiện tại của người dùng
     * @param {string} userId - Định danh người dùng (tùy chọn)
     * @returns {Array} - Bản sao của lịch sử cuộc trò chuyện
     */
    getHistory(userId) {
      if (!userId) {
        console.warn('Cảnh báo: Đang truy cập lịch sử cuộc trò chuyện mà không cung cấp userId');
        return [];
      }
      return [...getUserHistory(userId)];
    },

    /**
     * Xóa lịch sử cuộc trò chuyện cục bộ của người dùng
     * @param {string} userId - Định danh người dùng
     */
    clearLocalHistory(userId) {
      if (userId) {
        // Xóa lịch sử của người dùng cụ thể
        if (userConversations.has(userId)) {
          userConversations.get(userId).length = 0;
        }
      } else {
        // Xóa tất cả lịch sử nếu không cung cấp userId
        userConversations.clear();
      }
    }
  };
})();

module.exports = conversationManager;
