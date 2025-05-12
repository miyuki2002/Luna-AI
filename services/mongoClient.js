const { MongoClient } = require('mongodb');
const initSystem = require('./initSystem.js');
const logger = require('../utils/logger.js');

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
      if (this.db) {
        logger.info('SYSTEM', 'Đã kết nối đến MongoDB rồi.');
        return this.db;
      }

      if (this.isConnecting) {
        logger.info('SYSTEM', 'Đang trong quá trình kết nối đến MongoDB...');
        while (!this.db) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return this.db;
      }

      this.isConnecting = true;
      await this.client.connect();
      this.db = this.client.db();
      this.isConnecting = false;
      logger.info('SYSTEM', 'Đã kết nối thành công đến MongoDB');

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
      logger.error('SYSTEM', 'Lỗi khi kết nối đến MongoDB:', error);
      throw error;
    }
  }

  async close() {
    try {
      await this.client.close();
      logger.info('SYSTEM', 'Đã đóng kết nối MongoDB');
    } catch (error) {
      logger.error('SYSTEM', 'Lỗi khi đóng kết nối MongoDB:', error);
    }
  }

  getDb() {
    if (!this.db) {
      throw new Error('Chưa kết nối tới MongoDB. Hãy gọi connect() trước.');
    }
    return this.db;
  }

  async getDbSafe() {
    if (!this.db) {
      try {
        await this.connect();
      } catch (error) {
        logger.error('SYSTEM', 'Không thể kết nối đến MongoDB:', error);
        throw new Error('Không thể kết nối đến MongoDB. Vui lòng kiểm tra kết nối và cấu hình.');
      }
    }
    return this.db;
  }
}

module.exports = new MongoDBClient();
