const { MongoClient } = require('mongodb');
const initSystem = require('./initSystem.js');

class MongoDBClient {
  constructor() {
    this.uri = process.env.MONGODB_URI;
    if (!this.uri) {
      throw new Error('MONGODB_URI không được đặt trong biến môi trường');
    }
    
    this.client = new MongoClient(this.uri);
    this.db = null;
    this.isConnecting = false;
  }

  async connect() {
    try {
      // Tránh kết nối kép
      if (this.db) {
        console.log('Đã kết nối đến MongoDB rồi.');
        return this.db;
      }
      
      if (this.isConnecting) {
        console.log('Đang trong quá trình kết nối đến MongoDB...');
        // Đợi kết nối hoàn thành
        while (!this.db) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return this.db;
      }
      
      this.isConnecting = true;
      await this.client.connect();
      this.db = this.client.db();
      this.isConnecting = false;
      console.log('Đã kết nối thành công đến MongoDB');
      
      // Tạo các indexes cần thiết
      await this.db.collection('conversations').createIndex({ userId: 1, messageIndex: 1 }, { unique: true });
      await this.db.collection('conversation_meta').createIndex({ userId: 1 }, { unique: true });
      
      // Wait for initialization to complete if needed by other modules
      if (!initSystem.getStatus().services.mongodb) {
        console.log('MongoDB đang đợi trong hàng đợi khởi tạo...');
        await initSystem.waitForReady();
      }
      
      return this.db;
    } catch (error) {
      this.isConnecting = false;
      console.error('Lỗi khi kết nối đến MongoDB:', error);
      throw error;
    }
  }

  async close() {
    try {
      await this.client.close();
      console.log('Đã đóng kết nối MongoDB');
    } catch (error) {
      console.error('Lỗi khi đóng kết nối MongoDB:', error);
    }
  }

  getDb() {
    if (!this.db) {
      throw new Error('Chưa kết nối tới MongoDB. Hãy gọi connect() trước.');
    }
    return this.db;
  }

  // Phương thức mới để lấy DB một cách an toàn
  async getDbSafe() {
    // Đợi cho đến khi hệ thống đã sẵn sàng
    if (!this.db || !initSystem.getStatus().services.mongodb) {
      await initSystem.waitForReady();
    }
    return this.getDb();
  }
}

module.exports = new MongoDBClient();
