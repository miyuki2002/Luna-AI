// events/ready.js
const mongoClient = require('../services/mongoClient.js');
const storageDB = require('../services/storagedb.js');
const initSystem = require('../services/initSystem.js');
const GuildProfileDB = require('../services/guildprofiledb.js');
const ownerService = require('../services/ownerService.js');
const { setupGuildHandlers } = require('../handlers/guildHandler');
const logger = require('../utils/logger.js');
const AutoUpdateService = require('../services/AutoUpdateService');
const APIProviderManager = require('../services/providers.js');

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
      const autoUpdateService = new AutoUpdateService();
      const currentVersion = autoUpdateService.getCurrentVersion();
      logger.info('SYSTEM', `Version hiện tại: v${currentVersion}`);
      const hasUpdate = await autoUpdateService.checkAndUpdate();
      if (hasUpdate) {
        return;
      }
    } catch (error) {
      logger.error('SYSTEM', `Lỗi khi auto-update:`, error);
    }

    try {
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
      initSystem.markReady('conversationHistory');
    } catch (error) {
      logger.error('SYSTEM', 'Lỗi khi khởi tạo cấu trúc lịch sử cuộc trò chuyện:', error);
      initSystem.markReady('conversationHistory');
    }

    try {
      await storageDB.initializeProfiles();
      const db = mongoClient.getDb();
      await db.collection('user_profiles').createIndex({ 'data.global_xp': -1 });
      await db.collection('user_profiles').createIndex({ 'data.xp.id': 1 });
      initSystem.markReady('profiles');
    } catch (error) {
      logger.error('SYSTEM', 'Lỗi khi khởi tạo hệ thống profile người dùng:', error);
      initSystem.markReady('profiles');
    }

    try {
      await GuildProfileDB.setupGuildProfileIndexes();
      for (const [guildId, guild] of client.guilds.cache) {
        try {
          await GuildProfileDB.getGuildProfile(guildId);
        } catch (err) {
          logger.error('SYSTEM', `Lỗi khi tải cấu hình guild ${guild.name}:`, err);
        }
      }
      initSystem.markReady('guildProfiles');
    } catch (error) {
      logger.error('SYSTEM', 'Lỗi khi khởi tạo hệ thống profile guild:', error);
      initSystem.markReady('guildProfiles');
    }

    try {
      ownerService.initialize(client);
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

    try {
      await setupGuildHandlers(client);
    } catch (error) {
      logger.error('SYSTEM', 'Lỗi khi thiết lập guild handlers:', error);
      logger.error('SYSTEM', 'Stack trace:', error.stack);
    }

    client.user.setPresence({
      activities: [{ name: 'Không phải người | @Luna', type: 4 }],
      status: 'online'
    });

    try {
      const providerManager = new APIProviderManager();
      const providers = providerManager.initializeProviders();
      logger.info('SYSTEM', `Đã khởi tạo ${providers.length} providers: ${providers.map(p => p.name).join(", ")}`);
    } catch (error) {
      logger.error('SYSTEM', 'Lỗi khi khởi tạo providers:', error);
    }

    logger.info('SYSTEM', `Bot đã sẵn sàng! Đã đăng nhập với tên ${client.user.tag}`);
  });
}

module.exports = { startbot };
