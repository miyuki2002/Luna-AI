const mongoClient = require('./mongoClient.js');

/**
 * Class để xử lý tất cả các hoạt động lưu trữ liên quan đến cuộc trò chuyện
 */
class StorageDB {
  constructor() {
    // Số lượng tin nhắn tối đa để giữ trong ngữ cảnh
    this.maxConversationLength = 10;
    
    // Tuổi thọ tối đa của cuộc trò chuyện (tính bằng mili giây) - 3 giờ
    this.maxConversationAge = 3 * 60 * 60 * 1000;
    
    // Khởi tạo kết nối MongoDB
    this.initDatabase();
    
    // Lên lịch dọn dẹp cuộc trò chuyện cũ mỗi giờ
    setInterval(() => this.cleanupOldConversations(), 60 * 60 * 1000);
  }
  
  /**
   * Khởi tạo kết nối MongoDB
   */
  async initDatabase() {
    try {
      // Kết nối tới MongoDB
      await mongoClient.connect();
      console.log('Đã khởi tạo kết nối MongoDB thành công, lịch sử trò chuyện sẽ được lưu trữ ở đây.');
    } catch (error) {
      console.error('Lỗi khi khởi tạo kết nối MongoDB:', error);
      throw error;
    }
  }

  /**
   * Thêm tin nhắn vào lịch sử cuộc trò chuyện trong MongoDB
   * @param {string} userId - Định danh người dùng
   * @param {string} role - Vai trò của tin nhắn ('user' hoặc 'assistant')
   * @param {string} content - Nội dung tin nhắn
   */
  async addMessageToConversation(userId, role, content) {
    try {
      const db = mongoClient.getDb();
      
      // Lấy số lượng tin nhắn hiện tại của người dùng
      const count = await db.collection('conversations').countDocuments({ userId });
      
      // Thêm tin nhắn mới
      await db.collection('conversations').insertOne({
        userId,
        messageIndex: count,
        role,
        content,
        timestamp: Date.now()
      });
      
      // Cập nhật timestamp trong bảng meta
      await db.collection('conversation_meta').updateOne(
        { userId },
        { $set: { lastUpdated: Date.now() } },
        { upsert: true }
      );
      
      // Nếu vượt quá giới hạn, xóa tin nhắn cũ nhất (trừ lời nhắc hệ thống ở index 0)
      if (count >= this.maxConversationLength) {
        // Lấy tin nhắn cũ nhất (ngoại trừ lời nhắc hệ thống)
        const oldestMsg = await db.collection('conversations')
          .findOne(
            { userId, messageIndex: { $gt: 0 } },
            { sort: { messageIndex: 1 } }
          );
        
        if (oldestMsg) {
          // Xóa tin nhắn cũ nhất
          await db.collection('conversations').deleteOne({ 
            userId, 
            messageIndex: oldestMsg.messageIndex 
          });
          
          // Cập nhật lại chỉ số của các tin nhắn
          await db.collection('conversations').updateMany(
            { userId, messageIndex: { $gt: oldestMsg.messageIndex } },
            { $inc: { messageIndex: -1 } }
          );
        }
      }
      
      // console.log(`Đã cập nhật cuộc trò chuyện cho người dùng ${userId}, số lượng tin nhắn: ${count + 1}`);
    } catch (error) {
      console.error('Lỗi khi thêm tin nhắn vào MongoDB:', error);
    }
  }
  
  /**
   * Lấy lịch sử cuộc trò chuyện của người dùng từ MongoDB
   * @param {string} userId - Định danh người dùng
   * @param {string} systemPrompt - Lời nhắc hệ thống để sử dụng nếu không có lịch sử
   * @param {string} modelName - Tên mô hình để thêm vào lời nhắc hệ thống
   * @returns {Array} - Mảng các tin nhắn trò chuyện
   */
  async getConversationHistory(userId, systemPrompt, modelName) {
    try {
      const db = mongoClient.getDb();
      
      // Kiểm tra xem người dùng đã có lịch sử chưa
      const count = await db.collection('conversations').countDocuments({ userId });
      
      if (count === 0) {
        // Khởi tạo với lời nhắc hệ thống nếu không có lịch sử
        const systemMessage = { 
          role: 'system', 
          content: systemPrompt + ` You are running on ${modelName} model.` 
        };
        await this.addMessageToConversation(userId, systemMessage.role, systemMessage.content);
        return [systemMessage];
      } else {
        // Cập nhật thời gian để cho biết cuộc trò chuyện này vẫn đang hoạt động
        await db.collection('conversation_meta').updateOne(
          { userId },
          { $set: { lastUpdated: Date.now() } }
        );
        
        // Lấy tất cả tin nhắn theo thứ tự
        const messages = await db.collection('conversations')
          .find({ userId })
          .sort({ messageIndex: 1 })
          .project({ _id: 0, role: 1, content: 1 })
          .toArray();
        
        return messages;
      }
    } catch (error) {
      console.error('Lỗi khi lấy lịch sử cuộc trò chuyện:', error);
      // Trả về lời nhắc hệ thống mặc định nếu có lỗi
      return [{ 
        role: 'system', 
        content: systemPrompt + ` You are running on ${modelName} model.` 
      }];
    }
  }
  
  /**
   * Xóa lịch sử cuộc trò chuyện của người dùng
   * @param {string} userId - Định danh người dùng
   * @param {string} systemPrompt - Lời nhắc hệ thống để khởi tạo lại cuộc trò chuyện
   * @param {string} modelName - Tên mô hình để thêm vào lời nhắc hệ thống
   */
  async clearConversationHistory(userId, systemPrompt, modelName) {
    try {
      const db = mongoClient.getDb();
      
      // Xóa tất cả tin nhắn của người dùng
      await db.collection('conversations').deleteMany({ userId });
      
      // Khởi tạo lại với lời nhắc hệ thống
      const systemMessage = { 
        role: 'system', 
        content: systemPrompt + ` You are running on ${modelName} model.` 
      };
      await this.addMessageToConversation(userId, systemMessage.role, systemMessage.content);
      
      // Cập nhật meta
      await db.collection('conversation_meta').updateOne(
        { userId },
        { $set: { lastUpdated: Date.now() } },
        { upsert: true }
      );
      
      console.log(`Đã xóa cuộc trò chuyện của người dùng ${userId}`);
    } catch (error) {
      console.error('Lỗi khi xóa lịch sử cuộc trò chuyện:', error);
    }
  }
  
  /**
   * Xóa các cuộc trò chuyện cũ để giải phóng bộ nhớ
   */
  async cleanupOldConversations() {
    try {
      const db = mongoClient.getDb();
      const now = Date.now();
      
      // Tìm người dùng có cuộc trò chuyện cũ
      const oldUsers = await db.collection('conversation_meta')
        .find({ lastUpdated: { $lt: now - this.maxConversationAge } })
        .project({ userId: 1, _id: 0 })
        .toArray();
      
      if (oldUsers.length > 0) {
        const userIds = oldUsers.map(user => user.userId);
        
        // Xóa tin nhắn và metadata của người dùng có cuộc trò chuyện cũ
        await db.collection('conversations').deleteMany({ userId: { $in: userIds } });
        await db.collection('conversation_meta').deleteMany({ userId: { $in: userIds } });
        
        console.log(`Đã dọn dẹp ${oldUsers.length} cuộc trò chuyện cũ`);
      }
    } catch (error) {
      console.error('Lỗi khi dọn dẹp cuộc trò chuyện cũ:', error);
    }
  }
  
  /**
   * Đặt giá trị cho maxConversationLength
   * @param {number} value - Số lượng tin nhắn tối đa
   */
  setMaxConversationLength(value) {
    this.maxConversationLength = value;
  }
  
  /**
   * Đặt giá trị cho maxConversationAge
   * @param {number} value - Tuổi thọ tối đa (mili giây)
   */
  setMaxConversationAge(value) {
    this.maxConversationAge = value;
  }
}

// Xuất một thể hiện duy nhất của StorageDB
module.exports = new StorageDB();
