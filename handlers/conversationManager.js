// Quản lý cuộc trò chuyện
const storageDB = require('../services/storagedb.js');

// Sử dụng closure để ngăn chặn truy cập trước khi khởi tạo
const conversationManager = (() => {
  // Biến lịch sử cuộc trò chuyện riêng tư
  const conversationHistory = [];
  
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
      
      // Xóa và cập nhật bộ nhớ đệm cục bộ
      conversationHistory.length = 0;
      history.forEach(msg => conversationHistory.push(msg));
      
      return [...conversationHistory];
    },
    
    /**
     * Thêm tin nhắn vào lịch sử cuộc trò chuyện
     * @param {string} userId - Định danh người dùng
     * @param {string} role - Vai trò tin nhắn (user/assistant/system)
     * @param {string} content - Nội dung tin nhắn
     * @returns {Promise} - Kết quả của thao tác với cơ sở dữ liệu
     */
    addMessage(userId, role, content) {
      // Thêm vào bộ nhớ đệm cục bộ
      conversationHistory.push({ role, content });
      
      // Thêm vào cơ sở dữ liệu
      return storageDB.addMessageToConversation(userId, role, content);
    },
    
    /**
     * Lấy lịch sử cuộc trò chuyện hiện tại
     * @returns {Array} - Bản sao của lịch sử cuộc trò chuyện
     */
    getHistory() {
      return [...conversationHistory];
    },
    
    /**
     * Xóa lịch sử cuộc trò chuyện cục bộ
     */
    clearLocalHistory() {
      conversationHistory.length = 0;
    }
  };
})();

module.exports = conversationManager;
