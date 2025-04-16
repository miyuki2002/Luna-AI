const { MongoClient } = require('mongodb');

class MongoDBClient {
  constructor() {
    this.uri = process.env.MONGODB_URI;
    if (!this.uri) {
      throw new Error('MONGODB_URI không được đặt trong biến môi trường');
    }
    
    this.client = new MongoClient(this.uri);
    this.db = null;
  }

  async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db();
      console.log('Đã kết nối thành công đến MongoDB');
      
      // Tạo các indexes cần thiết
      await this.db.collection('conversations').createIndex({ userId: 1, messageIndex: 1 }, { unique: true });
      await this.db.collection('conversation_meta').createIndex({ userId: 1 }, { unique: true });
      
      return this.db;
    } catch (error) {
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
}

module.exports = new MongoDBClient();
