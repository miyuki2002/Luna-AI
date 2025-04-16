const { Events } = require('discord.js');
const mongoClient = require('../services/mongoClient.js');
const storageDB = require('../services/storagedb.js');
const grokClient = require('../services/grokClient.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    try {
      // Kết nối MongoDB khi bot sẵn sàng
      console.log(`🔄 Đang kết nối đến MongoDB...`);
      await mongoClient.connect();
      
      // Khởi tạo cài đặt cho StorageDB sau khi kết nối
      await storageDB.setupCollections();
      
      // Khởi tạo mẫu lời chào
      await grokClient.initializeGreetingPatterns();
      
      console.log(`✅ Bot đã sẵn sàng! Đã đăng nhập với tên ${client.user.tag}`);
    } catch (error) {
      console.error('❌ Lỗi khi khởi tạo kết nối:', error);
      process.exit(1); // Thoát nếu không thể kết nối đến cơ sở dữ liệu
    }
  },
};
