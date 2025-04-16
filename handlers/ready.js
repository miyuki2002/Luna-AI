const grokClient = require('../services/grokClient');
const mongoClient = require('../services/mongoClient.js');
const storageDB = require('../services/storagedb.js');

function handleReady(client, loadCommands) {
  client.once('ready', async () => {
    console.log('\x1b[36m%s\x1b[0m', `
    ██╗     ██╗   ██╗███╗   ██╗ █████╗ 
    ██║     ██║   ██║████╗  ██║██╔══██╗
    ██║     ██║   ██║██╔██╗ ██║███████║
    ██║     ██║   ██║██║╚██╗██║██╔══██║
    ███████╗╚██████╔╝██║ ╚████║██║  ██║
    ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝
    `);

    try {
      // Kết nối MongoDB khi bot sẵn sàng
      console.log(`🔄 Đang kết nối đến MongoDB...`);
      await mongoClient.connect();
      
      // Khởi tạo cài đặt cho StorageDB sau khi kết nối
      await storageDB.setupCollections();
      
      // Khởi tạo mẫu lời chào
      await grokClient.initializeGreetingPatterns();
      
      console.log(`✅ Đã kết nối thành công đến MongoDB!`);
    } catch (error) {
      console.error('❌ Lỗi khi khởi tạo kết nối MongoDB:', error);
      // Không thoát chương trình, chỉ ghi log lỗi để bot vẫn hoạt động
      console.warn('⚠️ Bot sẽ hoạt động mà không có khả năng lưu trữ lâu dài. Một số tính năng có thể không hoạt động chính xác.');
    }

    // Tải các lệnh khi khởi động
    const commandCount = loadCommands(client);
    console.log('\x1b[32m%s\x1b[0m', `Đã tải tổng cộng ${commandCount} lệnh!`);
    
    // Kiểm tra kết nối với X.AI API
    const connected = await grokClient.testConnection();
    
    // Set bot presence
    client.user.setPresence({ 
      activities: [{ name: 'Không phải người | @Luna', type: 4 }],
      status: 'online'
    });

    console.log(`✅ Bot đã sẵn sàng! Đã đăng nhập với tên ${client.user.tag}`);
  });
}

module.exports = { handleReady };
