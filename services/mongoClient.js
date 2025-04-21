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

      // Chú ý: Các indexes sẽ được tạo trong storageDB.setupCollections()
      // Để tránh xung đột, không tạo indexes ở đây

      // REMOVE THIS - THIS IS CAUSING THE CIRCULAR DEPENDENCY
      // if (!initSystem.getStatus().services.mongodb) {
      //   console.log('MongoDB đang đợi trong hàng đợi khởi tạo...');
      //   await initSystem.waitForReady();
      // }

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
    // Nếu chưa kết nối, hãy kết nối
    if (!this.db) {
      try {
        await this.connect();
      } catch (error) {
        console.error('Không thể kết nối đến MongoDB:', error);
        throw new Error('Không thể kết nối đến MongoDB. Vui lòng kiểm tra kết nối và cấu hình.');
      }
    }
    return this.db;
  }
}

module.exports = new MongoDBClient();
