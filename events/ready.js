// events/ready.js
const NeuralNetworks = require('../services/NeuralNetworks');
const mongoClient = require('../services/mongoClient.js');
const storageDB = require('../services/storagedb.js');
const initSystem = require('../services/initSystem.js');
const ProfileDB = require('../services/profiledb.js');
const GuildProfileDB = require('../services/guildprofiledb.js');
const ownerService = require('../services/ownerService.js');
const { setupGuildHandlers } = require('../handlers/guildHandler');
const logger = require('../utils/logger.js');
const AutoUpdateService = require('../services/AutoUpdateService');

async function startbot(client, loadCommands) {
  client.once('ready', async () => {
    logger.info('SYSTEM', `\n\n
    ██╗     ██╗   ██╗███╗   ██╗ █████╗
    ██║     ██║   ██║██╔██╗ ██║███████║
    ██║     ██║   ██║██║╚██╗██║██╔══██║
    ███████╗╚██████╔╝██║ ╚████║██║  ██║
    ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝
    `);

    try {
      logger.info('SYSTEM', 'Khởi chạy Luna Bot...');
      
      const autoUpdateService = new AutoUpdateService();
      const currentVersion = autoUpdateService.getCurrentVersion();
      logger.info('SYSTEM', `Version hiện tại: v${currentVersion}`);
      
      const hasUpdate = await autoUpdateService.checkAndUpdate();
      
      if (hasUpdate) {
        return;
      }
      
      logger.info('SYSTEM', 'Tiếp tục khởi động bot...');
      
    } catch (error) {
      logger.error('SYSTEM', `Lỗi khi auto-update:`, error);
      logger.info('SYSTEM', `Tiếp tục khởi động bot bình thường do lỗi auto-update`);
    }

    try {
      logger.info('SYSTEM', `Đang kết nối đến MongoDB...`);
      await mongoClient.connect();
      await storageDB.setupCollections();
      initSystem.markReady('mongodb');
      logger.info('SYSTEM', `Đã kết nối thành công đến MongoDB!`);
    } catch (error) {
      logger.error('SYSTEM', 'Lỗi khi khởi tạo kết nối MongoDB:', error);
      initSystem.markReady('mongodb');
      logger.warn('SYSTEM', 'Bot sẽ hoạt động mà không có khả năng lưu trữ lâu dài.');
    }

    try {
      await storageDB.initializeConversationHistory();
      logger.info('SYSTEM', 'Đã khởi tạo cấu trúc lịch sử cuộc trò chuyện');
      initSystem.markReady('conversationHistory');
    } catch (error) {
      logger.error('SYSTEM', 'Lỗi khi khởi tạo cấu trúc lịch sử cuộc trò chuyện:', error);
      initSystem.markReady('conversationHistory');
    }

    try {
      logger.info('SYSTEM', 'Đang khởi tạo hệ thống profile người dùng...');
      await storageDB.initializeProfiles();

      const profileCollection = await ProfileDB.getProfileCollection();
      logger.info('SYSTEM', 'Đã thiết lập collection user_profiles và cấu trúc dữ liệu');

      const db = mongoClient.getDb();
      await db.collection('user_profiles').createIndex({ 'data.global_xp': -1 });
      await db.collection('user_profiles').createIndex({ 'data.xp.id': 1 });
      logger.info('SYSTEM', 'Đã khởi tạo các index cho collection user_profiles');

      initSystem.markReady('profiles');
    } catch (error) {
      logger.error('SYSTEM', 'Lỗi khi khởi tạo hệ thống profile người dùng:', error);
      initSystem.markReady('profiles');
    }

    try {
      logger.info('SYSTEM', 'Đang khởi tạo hệ thống profile guild...');
      await GuildProfileDB.setupGuildProfileIndexes();

      for (const [guildId, guild] of client.guilds.cache) {
        try {
          const guildProfile = await GuildProfileDB.getGuildProfile(guildId);
          logger.info('SYSTEM', `Đã tải cấu hình XP cho guild ${guild.name}`);
        } catch (err) {
          logger.error('SYSTEM', `Lỗi khi tải cấu hình guild ${guild.name}:`, err);
        }
      }

      logger.info('SYSTEM', 'Đã khởi tạo hệ thống profile guild');
      initSystem.markReady('guildProfiles');
    } catch (error) {
      logger.error('SYSTEM', 'Lỗi khi khởi tạo hệ thống profile guild:', error);
      initSystem.markReady('guildProfiles');
    }

    try {
      logger.info('SYSTEM', 'Đang khởi tạo OwnerService...');
      ownerService.initialize(client);
      logger.info('SYSTEM', 'Đã khởi tạo OwnerService thành công!');
    } catch (error) {
      logger.error('SYSTEM', 'Lỗi khi khởi tạo OwnerService:', error);
    }

    try {
      const commandCount = loadCommands(client);
      logger.info('SYSTEM', `Đã tải tổng cộng ${commandCount} lệnh!`);
      initSystem.markReady('commands');
    } catch (error) {
      logger.error('SYSTEM', 'Lỗi khi tải commands:', error);
      initSystem.markReady('commands');
    }

    // ========================================
    try {
      logger.info('SYSTEM', '=== BẮT ĐẦU THIẾT LẬP GUILD HANDLERS VÀ DEPLOY COMMANDS ===');
      
      // Phải await để đợi hàm async hoàn thành
      await setupGuildHandlers(client);
      
      logger.info('SYSTEM', '✓ Đã thiết lập guild handlers và deploy commands thành công!');
    } catch (error) {
      logger.error('SYSTEM', '❌ Lỗi khi thiết lập guild handlers:', error);
      logger.error('SYSTEM', 'Stack trace:', error.stack);
    }
    // ========================================

    // Thiết lập trạng thái cho bot
    client.user.setPresence({
      activities: [{ name: 'Không phải người | @Luna', type: 4 }],
      status: 'online'
    });

    logger.info('SYSTEM', `Bot đã sẵn sàng! Đã đăng nhập với tên ${client.user.tag}`);
  });
}

module.exports = { startbot };
