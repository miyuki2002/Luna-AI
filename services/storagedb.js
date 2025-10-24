const mongoClient = require('./mongoClient.js');
const Profile = require('./profiledb.js');
const logger = require('../utils/logger.js');

/**
 * Class để xử lý tất cả các hoạt động lưu trữ liên quan đến cuộc trò chuyện
 */
class StorageDB {
  constructor() {
    // Số lượng tin nhắn tối đa để giữ trong ngữ cảnh
    this.maxConversationLength = 20;

    // Tuổi thọ tối đa của cuộc trò chuyện (tính bằng mili giây) - 3 giờ
    this.maxConversationAge = 3 * 60 * 60 * 1000;

    // Dọn dẹp cuộc trò chuyện cũ mỗi giờ
    setInterval(() => this.cleanupOldConversations(), 60 * 60 * 1000);
  }

  /**
   * Thiết lập các collections và indexes MongoDB
   */
  async setupCollections() {
    try {
      const db = mongoClient.getDb();

      // Xử lý collection conversations
      try {
        const indexes = await db.collection('conversations').listIndexes().toArray();
        const hasConversationIdIndex = indexes.some(index => index.name === 'conversationId_1');
        const hasUserIdMessageIndexIndex = indexes.some(index => index.name === 'userId_1_messageIndex_1');

        if (hasConversationIdIndex) {
          logger.info('DATABASE', 'Phát hiện chỉ mục conversationId_1 không cần thiết...');
          try {
            await db.collection('conversations').dropIndex('conversationId_1');
            logger.info('DATABASE', 'Đã xóa chỉ mục conversationId_1');
          } catch (dropIndexError) {
            logger.error('DATABASE', 'Không thể xóa chỉ mục conversationId_1:', dropIndexError.message);
          }
        }

        if (hasUserIdMessageIndexIndex) {
          logger.info('DATABASE', 'Phát hiện chỉ mục userId_1_messageIndex_1 hiện có...');
          try {
            await db.collection('conversations').dropIndex('userId_1_messageIndex_1');
            logger.info('DATABASE', 'Đã xóa chỉ mục userId_1_messageIndex_1');
          } catch (dropIndexError) {
            logger.error('DATABASE', 'Không thể xóa chỉ mục userId_1_messageIndex_1:', dropIndexError.message);
          }
        }

        // Xóa dữ liệu không hợp lệ
        const deleteResult = await db.collection('conversations').deleteMany({
          $or: [
            { userId: null },
            { messageIndex: null },
            { userId: { $exists: false } },
            { messageIndex: { $exists: false } }
          ]
        });

        if (deleteResult.deletedCount > 0) {
          logger.info('DATABASE', `Đã xóa ${deleteResult.deletedCount} bản ghi không hợp lệ (userId hoặc messageIndex là null)`);
        }

      } catch (indexError) {
        // Xử lý lỗi về index - tạo lại collection nếu cần
        logger.info('DATABASE', 'Thử xóa và tạo lại collection conversations...');
        try {
          await db.collection('conversations').drop();
          logger.info('DATABASE', 'Đã xóa collection conversations để tạo lại');
        } catch (dropError) {
          logger.info('DATABASE', 'Collection conversations chưa tồn tại hoặc không thể xóa');
        }
      }

      // Tạo lại collection nếu cần
      try {
        const collections = await db.listCollections({ name: 'conversations' }).toArray();
        if (collections.length === 0) {
          await db.createCollection('conversations');
          logger.info('DATABASE', 'Đã tạo mới collection conversations');
        }
      } catch (createError) {
        logger.error('DATABASE', 'Lỗi khi tạo collection conversations:', createError);
      }

      // Tạo index cần thiết
      try {
        await db.collection('conversations').createIndex({ userId: 1, messageIndex: 1 }, { unique: true });
        logger.info('DATABASE', 'Đã tạo chỉ mục userId_1_messageIndex_1');
      } catch (indexError) {
        logger.error('DATABASE', 'Lỗi khi tạo chỉ mục userId_1_messageIndex_1:', indexError);
        await this.resetConversationsCollection();
      }

      // Tạo các chỉ mục khác
      await db.collection('conversation_meta').createIndex({ userId: 1 }, { unique: true });

      // Tạo các collection cho hệ thống quản lý
      try {
        await db.createCollection('mod_settings');
        await db.createCollection('image_blacklist');
        logger.info('DATABASE', 'Đã tạo các collection cho hệ thống moderation');
      } catch (error) {
        logger.info('DATABASE', 'Các collection cho hệ thống moderation đã tồn tại hoặc không thể tạo');
      }

      // Tạo các chỉ mục cho hệ thống moderation
      try {
        await db.collection('mod_settings').createIndex({ guildId: 1 }, { unique: true });
        await db.collection('image_blacklist').createIndex({ category: 1 });
        await db.collection('image_blacklist').createIndex({ keyword: 1 });
        logger.info('DATABASE', 'Đã tạo các chỉ mục cho hệ thống moderation');
      } catch (error) {
        logger.error('DATABASE', 'Lỗi khi tạo chỉ mục cho hệ thống moderation:', error);
      }

      // Khởi tạo hệ thống token limit
      try {
        const TokenService = require('./TokenService.js');
        await TokenService.initializeCollection();
        logger.info('DATABASE', 'Đã khởi tạo hệ thống token limit');
      } catch (error) {
        logger.error('DATABASE', 'Lỗi khi khởi tạo hệ thống token limit:', error);
      }

      logger.info('DATABASE', 'Đã thiết lập collections và indexes MongoDB');
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi thiết lập collections MongoDB:', error);
      throw error;
    }
  }

  /**
   * Xóa hoàn toàn cơ sở dữ liệu và tạo lại từ đầu
   * @returns {Promise<boolean>} - Trả về true nếu thành công
   */
  async resetDatabase() {
    try {
      const db = mongoClient.getDb();

      const collectionsToReset = [
        'conversations',
        'conversation_meta',
        'monitor_settings',
        'monitor_logs',
        'mod_settings',
        'image_blacklist'
      ];

      // Xóa từng collection
      for (const collectionName of collectionsToReset) {
        try {
          const collections = await db.listCollections({ name: collectionName }).toArray();
          if (collections.length > 0) {
            await db.collection(collectionName).drop();
            logger.info('DATABASE', `Đã xóa collection ${collectionName}`);
          }
        } catch (dropError) {
          logger.info('DATABASE', `Collection ${collectionName} chưa tồn tại hoặc không thể xóa`);
        }
      }

      // Thiết lập lại các collection và chỉ mục
      await this.setupCollections();

      // Khởi tạo lại dữ liệu
      await this.initializeConversationHistory();
      await this.initializeProfiles();
      await this.initializeImageBlacklist();

      logger.info('DATABASE', 'Đã xóa và tạo lại cơ sở dữ liệu thành công');
      return true;
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi reset cơ sở dữ liệu:', error);
      return false;
    }
  }

  /**
   * Khởi tạo kết nối MongoDB
   */
  async initDatabase() {
    try {
      await mongoClient.connect();
      logger.info('DATABASE', 'Đã khởi tạo kết nối MongoDB thành công, lịch sử trò chuyện sẽ được lưu trữ ở đây.');

      try {
        await this.setupCollections();
        await this.initializeConversationHistory();
        await this.initializeProfiles();
        await this.initializeImageBlacklist();
      } catch (setupError) {
        logger.error('DATABASE', 'Lỗi khi thiết lập cơ sở dữ liệu:', setupError);

        // Thử reset nếu có lỗi
        logger.info('DATABASE', 'Thử xóa và tạo lại toàn bộ cơ sở dữ liệu...');
        const resetSuccess = await this.resetDatabase();

        if (!resetSuccess) {
          throw new Error('Không thể khắc phục lỗi bằng cách reset cơ sở dữ liệu');
        }
      }
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi khởi tạo kết nối MongoDB:', error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử cuộc trò chuyện của người dùng từ MongoDB
   * @param {string} userId - Định danh người dùng
   * @param {string} systemPrompt - Lời nhắc hệ thống cho cuộc trò chuyện mới
   * @param {string} modelName - Tên mô hình AI
   * @returns {Promise<Array>} - Mảng các tin nhắn trò chuyện
   */
  async getConversationHistory(userId, systemPrompt, modelName) {
    try {
      // Xác thực userId
      if (!userId || typeof userId !== 'string' || userId === 'null' || userId === 'undefined') {
        logger.error('DATABASE', 'Lỗi: Không thể lấy lịch sử cuộc trò chuyện với userId không hợp lệ:', userId);
        // Trả về system prompt mặc định
        return [{
          role: 'system',
          content: systemPrompt + ` You are running on ${modelName} model.`
        }];
      }

      // Chuẩn hóa userId
      const validUserId = userId.trim();

      const db = mongoClient.getDb();

      // Kiểm tra lịch sử hiện có
      const count = await db.collection('conversations').countDocuments({ userId: validUserId });

      if (count === 0) {
        // Khởi tạo với system prompt nếu chưa có lịch sử
        const systemMessage = {
          role: 'system',
          content: systemPrompt + ` You are running on ${modelName} model.`
        };
        await this.addMessageToConversation(validUserId, systemMessage.role, systemMessage.content);
        logger.info('DATABASE', `Đã khởi tạo cuộc trò chuyện mới cho userId: ${validUserId}`);
        return [systemMessage];
      } else {
        // Cập nhật thời gian hoạt động
        await db.collection('conversation_meta').updateOne(
          { userId: validUserId },
          { $set: { lastUpdated: Date.now() } },
          { upsert: true }
        );

        // Lấy toàn bộ lịch sử theo thứ tự
        const messages = await db.collection('conversations')
          .find({ userId: validUserId })
          .sort({ messageIndex: 1 })
          .project({ _id: 0, role: 1, content: 1 })
          .toArray();

        logger.debug('DATABASE', `Đã lấy ${messages.length} tin nhắn từ cơ sở dữ liệu cho userId: ${validUserId}`);

        if (messages.length === 0) {
          // Trường hợp cực kỳ hiếm: có bản ghi nhưng không lấy được tin nhắn nào
          logger.warn('DATABASE', `Sự không nhất quán: Phát hiện ${count} tin nhắn nhưng không truy vấn được cho userId: ${validUserId}`);

          // Khởi tạo lại với system prompt
          const systemMessage = {
            role: 'system',
            content: systemPrompt + ` You are running on ${modelName} model.`
          };
          await this.addMessageToConversation(validUserId, systemMessage.role, systemMessage.content);
          return [systemMessage];
        }

        return messages;
      }
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi lấy lịch sử cuộc trò chuyện:', error);

      // Fallback nếu có lỗi
      return [{
        role: 'system',
        content: systemPrompt + ` You are running on ${modelName} model.`
      }];
    }
  }

  /**
   * Thêm tin nhắn vào lịch sử cuộc trò chuyện trong MongoDB
   * @param {string} userId - Định danh người dùng
   * @param {string} role - Vai trò của tin nhắn ('user', 'assistant', hoặc 'system')
   * @param {string} content - Nội dung tin nhắn
   * @returns {Promise<boolean>} - Kết quả thao tác
   */
  async addMessageToConversation(userId, role, content) {
    try {
      // Xác thực tính hợp lệ của dữ liệu đầu vào
      if (!userId || typeof userId !== 'string' || userId === 'null' || userId === 'undefined') {
        logger.error('DATABASE', 'Lỗi: Không thể thêm tin nhắn vào cuộc trò chuyện với userId không hợp lệ:', userId);
        return false;
      }

      // Chuẩn hóa userId
      const validUserId = userId.trim();

      if (!role) {
        logger.error('DATABASE', 'Lỗi: Không thể thêm tin nhắn với role rỗng');
        return false;
      }

      if (!content) {
        logger.warn('DATABASE', `Cảnh báo: Đang thêm tin nhắn với nội dung rỗng cho userId: ${validUserId}`);
      }

      const db = mongoClient.getDb();

      // Đảm bảo meta document tồn tại
      await db.collection('conversation_meta').updateOne(
        { userId: validUserId },
        { $set: { lastUpdated: Date.now() } },
        { upsert: true }
      );

      // Đếm tin nhắn hiện có để xác định chỉ số mới
      const count = await db.collection('conversations').countDocuments({ userId: validUserId });

      try {
        // Thêm tin nhắn mới
        await db.collection('conversations').insertOne({
          userId: validUserId,
          messageIndex: count,
          role,
          content,
          timestamp: Date.now()
        });

        logger.debug('DATABASE', `Đã thêm tin nhắn (${role}) cho userId: ${validUserId}, messageIndex: ${count}`);
        // Kiểm tra và duy trì độ dài tối đa của cuộc trò chuyện
        await this.trimConversation(validUserId);

        return true;
      } catch (insertError) {
        // Xử lý lỗi trùng khóa
        if (insertError.code === 11000) {
          logger.warn('DATABASE', `Phát hiện lỗi trùng lặp khóa cho userId ${validUserId}, đang thử sửa chữa...`);

          try {
            // Xóa tin nhắn trùng lặp nếu có
            await db.collection('conversations').deleteOne({
              userId: validUserId,
              messageIndex: count
            });

            // Thử lại việc thêm tin nhắn
            await db.collection('conversations').insertOne({
              userId: validUserId,
              messageIndex: count,
              role,
              content,
              timestamp: Date.now()
            });

            logger.info('DATABASE', `Đã sửa chữa và thêm thành công tin nhắn cho userId: ${validUserId}`);
            return true;
          } catch (retryError) {
            logger.error('DATABASE', `Không thể sửa chữa lỗi trùng lặp cho userId: ${validUserId}`, retryError);
            return false;
          }
        } else {
          logger.error('DATABASE', `Lỗi khi thêm tin nhắn cho userId: ${validUserId}`, insertError);
          return false;
        }
      }
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi thêm tin nhắn vào MongoDB:', error);
      return false;
    }
  }

  /**
   * Giới hạn độ dài của cuộc trò chuyện theo maxConversationLength
   * @param {string} userId - Định danh người dùng
   * @private
   */
  async trimConversation(userId) {
    try {
      const db = mongoClient.getDb();
      const count = await db.collection('conversations').countDocuments({ userId });

      // Nếu số lượng tin nhắn vượt quá giới hạn, xóa tin nhắn cũ
      if (count > this.maxConversationLength) {
        // Lấy số tin nhắn cần xóa
        const excessCount = count - this.maxConversationLength;

        // Tìm tin nhắn cũ nhất để bảo toàn system prompt
        const oldestMsgs = await db.collection('conversations')
          .find({ userId }, { projection: { messageIndex: 1, role: 1 } })
          .sort({ messageIndex: 1 })
          .limit(excessCount + 1)
          .toArray();

        // Đảm bảo luôn giữ lại system prompt nếu có
        let startIndex = 0;
        if (oldestMsgs.length > 0 && oldestMsgs[0].role === 'system') {
          startIndex = 1;
        }

        // Lấy ID của các tin nhắn cần xóa
        const messageIndexesToDelete = oldestMsgs
          .slice(startIndex, startIndex + excessCount)
          .map(msg => msg.messageIndex);

        if (messageIndexesToDelete.length > 0) {
          // Xóa tin nhắn cũ
          await db.collection('conversations').deleteMany({
            userId,
            messageIndex: { $in: messageIndexesToDelete }
          });

          logger.debug('DATABASE', `Đã xóa ${messageIndexesToDelete.length} tin nhắn cũ cho userId: ${userId}`);

        }
      }
    } catch (error) {
      logger.error('DATABASE', `Lỗi khi cắt bớt cuộc trò chuyện cho userId: ${userId}`, error);
    }
  }

  /**
   * Xóa lịch sử cuộc trò chuyện của người dùng
   * @param {string} userId - Định danh người dùng
   * @param {string} systemPrompt - Lời nhắc hệ thống mới
   * @param {string} modelName - Tên mô hình
   * @returns {Promise<boolean>} - Kết quả xóa
   */
  async clearConversationHistory(userId, systemPrompt, modelName) {
    try {
      // Xác thực userId
      if (!userId || typeof userId !== 'string' || userId === 'null' || userId === 'undefined') {
        logger.error('DATABASE', 'Lỗi: Không thể xóa lịch sử cuộc trò chuyện với userId không hợp lệ:', userId);
        return false;
      }

      // Chuẩn hóa userId
      const validUserId = userId.trim();

      const db = mongoClient.getDb();

      // Xóa toàn bộ lịch sử hiện có
      await db.collection('conversations').deleteMany({ userId: validUserId });
      logger.info('DATABASE', `Đã xóa lịch sử cuộc trò chuyện cho userId: ${validUserId}`);

      // Khởi tạo lại với lời nhắc hệ thống
      const systemMessage = {
        role: 'system',
        content: systemPrompt + ` You are running on ${modelName} model.`
      };

      const success = await this.addMessageToConversation(validUserId, systemMessage.role, systemMessage.content);

      if (success) {
        await db.collection('conversation_meta').updateOne(
          { userId: validUserId },
          { $set: { lastUpdated: Date.now() } },
          { upsert: true }
        );
        logger.info('DATABASE', `Đã khởi tạo lại cuộc trò chuyện với system prompt cho userId: ${validUserId}`);
        return true;
      } else {
        logger.error('DATABASE', `Không thể thêm system prompt sau khi xóa cuộc trò chuyện cho userId: ${validUserId}`);
        return false;
      }
    } catch (error) {
      logger.error('DATABASE', `Lỗi khi xóa lịch sử cuộc trò chuyện: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Xóa các cuộc trò chuyện cũ để giải phóng bộ nhớ
   * @returns {Promise<number>} - Số lượng cuộc trò chuyện đã xóa
   */
  async cleanupOldConversations() {
    try {
      const db = mongoClient.getDb();
      const now = Date.now();
      const cutoffTime = now - this.maxConversationAge;

      logger.debug('DATABASE', `Đang tìm cuộc trò chuyện cũ hơn ${Math.round(this.maxConversationAge / (1000 * 60 * 60))} giờ...`);

      const oldUsers = await db.collection('conversation_meta')
        .find({ lastUpdated: { $lt: cutoffTime } })
        .project({ userId: 1, _id: 0, lastUpdated: 1 })
        .toArray();

      if (oldUsers.length > 0) {
        // Lập danh sách các userId cần xóa
        const userIds = oldUsers.map(user => user.userId);
        logger.info('DATABASE', `Tìm thấy ${oldUsers.length} cuộc trò chuyện cũ cần dọn dẹp`);

        // Hiển thị thời gian không hoạt động cho mỗi người dùng trong debug
        oldUsers.forEach(user => {
          const inactiveDuration = Math.round((now - user.lastUpdated) / (1000 * 60 * 60));
          logger.debug('DATABASE', `Cuộc trò chuyện của userId: ${user.userId} đã không hoạt động trong ${inactiveDuration} giờ`);
        });

        // Xóa dữ liệu cuộc trò chuyện
        const deleteResult = await db.collection('conversations').deleteMany({ userId: { $in: userIds } });

        // Xóa metadata
        const metaDeleteResult = await db.collection('conversation_meta').deleteMany({ userId: { $in: userIds } });

        logger.info('DATABASE', `Đã dọn dẹp ${oldUsers.length} cuộc trò chuyện cũ (đã xóa ${deleteResult.deletedCount} tin nhắn, ${metaDeleteResult.deletedCount} bản ghi metadata)`);
        return oldUsers.length;
      } else {
        logger.debug('DATABASE', 'Không có cuộc trò chuyện cũ cần dọn dẹp');
        return 0;
      }
    } catch (error) {
      logger.error('DATABASE', `Lỗi khi dọn dẹp cuộc trò chuyện cũ: ${error.message}`, error);
      return 0;
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



  /**
   * Xóa và tạo lại collection conversations
   * @returns {Promise<boolean>} - Kết quả thực hiện
   */
  async resetConversationsCollection() {
    try {
      const db = mongoClient.getDb();

      try {
        const collections = await db.listCollections({ name: 'conversations' }).toArray();
        if (collections.length > 0) {
          await db.collection('conversations').drop();
          logger.info('DATABASE', 'Đã xóa collection conversations để tạo lại');
        }
      } catch (dropError) {
        logger.info('DATABASE', 'Collection conversations chưa tồn tại hoặc không thể xóa');
      }

      try {
        await db.createCollection('conversations');
        logger.info('DATABASE', 'Đã tạo mới collection conversations');
      } catch (createError) {
        logger.info('DATABASE', 'Collection conversations đã tồn tại hoặc không thể tạo mới');
      }

      try {
        // Tạo index timestamp trước tiên
        await db.collection('conversations').createIndex({ timestamp: 1 });
        logger.info('DATABASE', 'Đã tạo chỉ mục timestamp_1');

        // Sau đó tạo index unique
        await db.collection('conversations').createIndex({ userId: 1, messageIndex: 1 }, { unique: true });
        logger.info('DATABASE', 'Đã tạo chỉ mục userId_1_messageIndex_1');
      } catch (indexError) {
        logger.error('DATABASE', 'Lỗi khi tạo chỉ mục cho collection conversations:', indexError);
        return false;
      }

      logger.info('DATABASE', 'Đã tạo lại collection conversations với các chỉ mục đúng');
      return true;
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi reset collection conversations:', error);
      return false;
    }
  }

  /**
   * Khởi tạo lịch sử cuộc trò chuyện
   * @returns {Promise<void>}
   */
  async initializeConversationHistory() {
    try {
      const db = mongoClient.getDb();

      // Kiểm tra và xử lý index nếu cần
      try {
        const indexes = await db.collection('conversations').listIndexes().toArray();
        const hasConversationIdIndex = indexes.some(index => index.name === 'conversationId_1');

        if (hasConversationIdIndex) {
          await this.resetConversationsCollection();
        } else {
          const hasTimeIndex = indexes.some(index => index.name === 'timestamp_1');

          if (!hasTimeIndex) {
            await db.collection('conversations').createIndex({ timestamp: 1 });
            logger.info('DATABASE', 'Đã tạo index timestamp cho collection conversations');
          }
        }
      } catch (indexError) {
        await this.resetConversationsCollection();
      }

      // Khởi tạo metadata cấu hình
      const conversationMeta = await db.collection('conversation_meta').findOne({
        metaVersion: { $exists: true }
      });

      if (!conversationMeta) {
        await db.collection('conversation_meta').insertOne({
          metaVersion: 1,
          lastCleanup: Date.now(),
          config: {
            maxConversationLength: this.maxConversationLength,
            maxConversationAge: this.maxConversationAge
          }
        });
        logger.info('DATABASE', 'Đã khởi tạo cấu hình lịch sử cuộc trò chuyện');
      } else {
        await db.collection('conversation_meta').updateOne(
          { metaVersion: { $exists: true } },
          {
            $set: {
              'config.maxConversationLength': this.maxConversationLength,
              'config.maxConversationAge': this.maxConversationAge,
            }
          }
        );
      }

      // Dọn dẹp dữ liệu cũ
      await this.cleanupOldConversations();

      logger.info('DATABASE', 'Hệ thống lịch sử cuộc trò chuyện đã sẵn sàng');
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi khởi tạo lịch sử cuộc trò chuyện:', error);
    }
  }

  /**
   * Lấy thông tin profile của người dùng
   * @param {string} userId - Định danh người dùng
   * @returns {Promise<Object>} - Thông tin profile
   */
  async getUserProfile(userId) {
    try {
      const db = mongoClient.getDb();
      const profiles = db.collection('user_profiles');

      let profile = await profiles.findOne({ _id: userId });

      if (!profile) {
        profile = Profile.createDefaultProfile(userId);
        await profiles.insertOne(profile);
        logger.info('DATABASE', `Đã tạo profile mới cho người dùng ${userId}`);
      }

      return profile;
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi lấy thông tin profile:', error);
      throw error;
    }
  }

  /**
   * Cập nhật thông tin profile của người dùng
   * @param {string} userId - Định danh người dùng
   * @param {Object} updateData - Dữ liệu cần cập nhật
   * @returns {Promise<boolean>} - Kết quả cập nhật
   */
  async updateUserProfile(userId, updateData) {
    try {
      const db = mongoClient.getDb();
      const profiles = db.collection('user_profiles');

      const result = await profiles.updateOne(
        { _id: userId },
        { $set: updateData },
        { upsert: true }
      );

      return result.acknowledged;
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi cập nhật profile:', error);
      return false;
    }
  }

  /**
   * Cập nhật tài nguyên trong ví của người dùng
   * @param {string} userId - Định danh người dùng
   * @param {string} resourceType - Loại tài nguyên (bank, wallet, shard)
   * @param {number} amount - Số lượng cần thay đổi
   * @returns {Promise<Object>} - Dữ liệu sau khi cập nhật
   */
  async updateUserEconomy(userId, resourceType, amount) {
    try {
      const db = mongoClient.getDb();
      const profiles = db.collection('user_profiles');

      const fieldPath = `data.economy.${resourceType}`;
      const updateObj = { $inc: {} };
      updateObj.$inc[fieldPath] = amount;

      await profiles.updateOne(
        { _id: userId },
        updateObj,
        { upsert: true }
      );

      const updatedProfile = await profiles.findOne(
        { _id: userId },
        { projection: { 'data.economy': 1, _id: 0 } }
      );

      return updatedProfile?.data?.economy || null;
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi cập nhật economy của người dùng:', error);
      return null;
    }
  }

  /**
   * Khởi tạo hệ thống profile người dùng
   * @returns {Promise<void>}
   */
  async initializeProfiles() {
    try {
      const db = mongoClient.getDb();

      // Tạo collection nếu chưa có
      const collections = await db.listCollections({ name: 'user_profiles' }).toArray();
      if (collections.length === 0) {
        await db.createCollection('user_profiles');
        logger.info('DATABASE', 'Đã tạo collection user_profiles');
      }

      // Xóa index cũ nếu tồn tại
      try {
        const indexes = await db.collection('user_profiles').listIndexes().toArray();
        const hasUserIdIndex = indexes.some(index => index.name === 'userId_1');

        if (hasUserIdIndex) {
          await db.collection('user_profiles').dropIndex('userId_1');
          logger.info('DATABASE', 'Đã xóa index userId_1 cũ từ collection user_profiles');
        }
      } catch (indexError) {
        logger.warn('DATABASE', 'Cảnh báo khi xóa index cũ:', indexError.message);
      }

      logger.info('DATABASE', 'Hệ thống profile người dùng đã sẵn sàng');
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi khởi tạo hệ thống profile:', error);
    }
  }

  /**
   * Lấy dữ liệu cho profile card
   * @param {string} userId - Định danh người dùng
   * @returns {Promise<Object>} - Dữ liệu cho profile card
   */
  async getProfileCardData(userId) {
    try {
      const profile = await this.getUserProfile(userId);
      const db = mongoClient.getDb();

      // Tính xếp hạng người dùng
      const allProfiles = await db.collection('user_profiles')
        .find({}, { projection: { _id: 1, 'data.global_xp': 1 } })
        .sort({ 'data.global_xp': -1 })
        .toArray();

      const globalRank = allProfiles.findIndex(p => p._id === userId) + 1;

      return {
        userId: profile._id,
        username: profile.data?.profile?.username || userId,
        discriminator: profile.data?.profile?.discriminator || "",
        level: profile.data?.global_level || 1,
        xp: profile.data?.global_xp || 0,
        bio: profile.data?.profile?.bio || "No bio written.",
        birthday: profile.data?.profile?.birthday || null,
        economy: {
          wallet: profile.data?.economy?.wallet || 0,
          bank: profile.data?.economy?.bank || 0,
          shard: profile.data?.economy?.shard || 0
        },
        customization: {
          background: profile.data?.profile?.background || null,
          pattern: profile.data?.profile?.pattern || null,
          emblem: profile.data?.profile?.emblem || null,
          hat: profile.data?.profile?.hat || null,
          wreath: profile.data?.profile?.wreath || null,
          color: profile.data?.profile?.color || null
        },
        rank: {
          server: 1, // Placeholder - implement server-specific ranking if needed
          global: globalRank
        }
      };
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi lấy dữ liệu profile card:', error);
      throw error;
    }
  }

  /**
   * Tạo profile card cho người dùng
   * @param {string} userId - Định danh người dùng
   * @returns {Promise<Buffer>} - Buffer hình ảnh profile card
   */
  async generateProfileCard(userId) {
    try {
      const profileData = await this.getProfileCardData(userId);
      const profileCanvas = require('./canvas/profileCanvas');
      const cardBuffer = await profileCanvas.createProfileCard(profileData);

      return cardBuffer;
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi tạo profile card:', error);
      throw error;
    }
  }

  /**
   * Khởi tạo blacklist cho generateImage
   * @returns {Promise<void>}
   */
  async initializeImageBlacklist() {
    try {
      const db = mongoClient.getDb();

      // Tạo collection nếu chưa có
      const collections = await db.listCollections({ name: 'image_blacklist' }).toArray();
      if (collections.length === 0) {
        await db.createCollection('image_blacklist');
        logger.info('DATABASE', 'Đã tạo collection image_blacklist');
      }

      // Tạo indexes
      await db.collection('image_blacklist').createIndex({ category: 1 });
      await db.collection('image_blacklist').createIndex({ keyword: 1 });

      // Kiểm tra xem đã có dữ liệu chưa
      const count = await db.collection('image_blacklist').countDocuments();
      if (count === 0) {
        // Khởi tạo blacklist mặc định
        const defaultBlacklist = [
          // Nội dung người lớn
          { keyword: "khỏa thân", category: "adult", description: "Hình ảnh khỏa thân", severity: "high" },
          { keyword: "nude", category: "adult", description: "Nude content", severity: "high" },
          { keyword: "erotic", category: "adult", description: "Erotic content", severity: "high" },
          { keyword: "sexy", category: "adult", description: "Nội dung gợi cảm", severity: "medium" },
          { keyword: "18+", category: "adult", description: "Nội dung 18+", severity: "high" },
          { keyword: "nsfw", category: "adult", description: "Not safe for work content", severity: "high" },
          { keyword: "pornographic", category: "adult", description: "Pornographic content", severity: "high" },
          { keyword: "khiêu dâm", category: "adult", description: "Nội dung khiêu dâm", severity: "high" },

          // Bạo lực
          { keyword: "blood", category: "violence", description: "Blood content", severity: "high" },
          { keyword: "gore", category: "violence", description: "Gore content", severity: "high" },
          { keyword: "máu me", category: "violence", description: "Cảnh máu me", severity: "high" },
          { keyword: "bạo lực", category: "violence", description: "Nội dung bạo lực", severity: "high" },
          { keyword: "giết", category: "violence", description: "Hành động giết chóc", severity: "high" },
          { keyword: "đánh đập", category: "violence", description: "Hành vi bạo lực", severity: "high" },
          { keyword: "tử vong", category: "violence", description: "Cảnh tử vong", severity: "high" },
          { keyword: "tai nạn", category: "violence", description: "Cảnh tai nạn", severity: "medium" },

          // Chính trị nhạy cảm
          { keyword: "chính trị", category: "politics", description: "Nội dung chính trị nhạy cảm", severity: "medium" },
          { keyword: "đảng phái", category: "politics", description: "Nội dung về đảng phái", severity: "medium" },
          { keyword: "biểu tình", category: "politics", description: "Cảnh biểu tình", severity: "medium" },
          { keyword: "bạo động", category: "politics", description: "Cảnh bạo động chính trị", severity: "high" },
          { keyword: "cách mạng", category: "politics", description: "Nội dung về cách mạng", severity: "medium" },
          { keyword: "chống đối", category: "politics", description: "Nội dung chống đối", severity: "high" },

          // Phân biệt chủng tộc
          { keyword: "phân biệt", category: "discrimination", description: "Phân biệt đối xử", severity: "high" },
          { keyword: "racist", category: "discrimination", description: "Racist content", severity: "high" },
          { keyword: "kỳ thị", category: "discrimination", description: "Kỳ thị chủng tộc", severity: "high" },
          { keyword: "phân biệt chủng tộc", category: "discrimination", description: "Phân biệt chủng tộc", severity: "high" },
          { keyword: "phân biệt màu da", category: "discrimination", description: "Phân biệt màu da", severity: "high" },

          // Tôn giáo nhạy cảm
          { keyword: "tôn giáo", category: "religion", description: "Nội dung tôn giáo nhạy cảm", severity: "medium" },
          { keyword: "blasphemy", category: "religion", description: "Blasphemous content", severity: "high" },
          { keyword: "xúc phạm tôn giáo", category: "religion", description: "Xúc phạm tôn giáo", severity: "high" },
          { keyword: "phỉ báng", category: "religion", description: "Phỉ báng tôn giáo", severity: "high" },
          { keyword: "báng bổ", category: "religion", description: "Báng bổ tôn giáo", severity: "high" },

          // Ma túy và chất cấm
          { keyword: "ma túy", category: "drugs", description: "Nội dung về ma túy", severity: "high" },
          { keyword: "drugs", category: "drugs", description: "Drug content", severity: "high" },
          { keyword: "cocaine", category: "drugs", description: "Cocaine reference", severity: "high" },
          { keyword: "heroin", category: "drugs", description: "Heroin reference", severity: "high" },
          { keyword: "cần sa", category: "drugs", description: "Nội dung về cần sa", severity: "high" },
          { keyword: "chất gây nghiện", category: "drugs", description: "Chất gây nghiện", severity: "high" },

          // Vũ khí nguy hiểm
          { keyword: "vũ khí", category: "weapons", description: "Nội dung về vũ khí", severity: "medium" },
          { keyword: "súng", category: "weapons", description: "Hình ảnh súng đạn", severity: "medium" },
          { keyword: "đạn", category: "weapons", description: "Đạn dược", severity: "medium" },
          { keyword: "bom", category: "weapons", description: "Chất nổ", severity: "high" },
          { keyword: "mìn", category: "weapons", description: "Mìn nổ", severity: "high" },
          { keyword: "weapons", category: "weapons", description: "Weapon content", severity: "medium" },

          // Nội dung lừa đảo
          { keyword: "lừa đảo", category: "scam", description: "Nội dung lừa đảo", severity: "high" },
          { keyword: "scam", category: "scam", description: "Scam content", severity: "high" },
          { keyword: "hack", category: "scam", description: "Hack content", severity: "medium" },
          { keyword: "cheat", category: "scam", description: "Cheat content", severity: "medium" },
          { keyword: "gian lận", category: "scam", description: "Nội dung gian lận", severity: "high" },

          // Nội dung quấy rối
          { keyword: "quấy rối", category: "harassment", description: "Nội dung quấy rối", severity: "high" },
          { keyword: "harassment", category: "harassment", description: "Harassment content", severity: "high" },
          { keyword: "bắt nạt", category: "harassment", description: "Nội dung bắt nạt", severity: "high" },
          { keyword: "bullying", category: "harassment", description: "Bullying content", severity: "high" },
          { keyword: "stalking", category: "harassment", description: "Stalking content", severity: "high" },

          // Nội dung xúc phạm
          { keyword: "xúc phạm", category: "offensive", description: "Nội dung xúc phạm", severity: "medium" },
          { keyword: "offensive", category: "offensive", description: "Offensive content", severity: "medium" },
          { keyword: "chửi bới", category: "offensive", description: "Ngôn từ chửi bới", severity: "medium" },
          { keyword: "thô tục", category: "offensive", description: "Ngôn từ thô tục", severity: "medium" },
          { keyword: "nhạy cảm", category: "offensive", description: "Nội dung nhạy cảm", severity: "medium" }
        ];

        // Thêm vào database
        await db.collection('image_blacklist').insertMany(defaultBlacklist);
        logger.info('DATABASE', `Đã thêm ${defaultBlacklist.length} từ khóa vào blacklist`);
      }

      return true;
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi khởi tạo image blacklist:', error);
      return false;
    }
  }

  /**
   * Kiểm tra từ khóa có trong blacklist không
   * @param {string} text - Văn bản cần kiểm tra
   * @returns {Promise<Object>} - Kết quả kiểm tra blacklist
   */
  async checkImageBlacklist(text) {
    try {
      const db = mongoClient.getDb();
      const blacklist = await db.collection('image_blacklist').find({}, { projection: { keyword: 1, category: 1, _id: 0 } }).toArray();

      // Chuyển text về chữ thường để so sánh
      const lowerText = text.toLowerCase();

      // Lưu các từ khóa và danh mục vi phạm
      const matchedKeywords = [];
      const categories = new Set();

      // Kiểm tra từng từ khóa trong blacklist
      for (const item of blacklist) {
        if (lowerText.includes(item.keyword.toLowerCase())) {
          matchedKeywords.push(item.keyword);
          categories.add(item.category);
        }
      }

      return {
        isBlocked: matchedKeywords.length > 0,
        matchedKeywords,
        categories: Array.from(categories)
      };
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi kiểm tra blacklist:', error);
      return {
        isBlocked: false,
        matchedKeywords: [],
        categories: []
      };
    }
  }

  /**
   * Thêm từ khóa mới vào blacklist
   * @param {string} keyword - Từ khóa cần thêm
   * @param {string} category - Danh mục (adult, violence, politics, racism, religion)
   * @param {string} description - Mô tả
   * @param {string} severity - Mức độ nghiêm trọng (low, medium, high)
   * @returns {Promise<boolean>} - Kết quả thêm mới
   */
  async addToImageBlacklist(keyword, category, description, severity = 'medium') {
    try {
      const db = mongoClient.getDb();

      // Kiểm tra xem từ khóa đã tồn tại chưa
      const existing = await db.collection('image_blacklist').findOne({ keyword });
      if (existing) {
        return false;
      }

      // Thêm từ khóa mới
      await db.collection('image_blacklist').insertOne({
        keyword,
        category,
        description,
        severity,
        createdAt: new Date()
      });

      return true;
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi thêm từ khóa vào blacklist:', error);
      return false;
    }
  }

  /**
   * Xóa từ khóa khỏi blacklist
   * @param {string} keyword - Từ khóa cần xóa
   * @returns {Promise<boolean>} - Kết quả xóa
   */
  async removeFromImageBlacklist(keyword) {
    try {
      const db = mongoClient.getDb();
      const result = await db.collection('image_blacklist').deleteOne({ keyword });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi xóa từ khóa khỏi blacklist:', error);
      return false;
    }
  }

  /**
   * Lấy toàn bộ blacklist
   * @returns {Promise<Array>} - Danh sách các từ khóa trong blacklist
   */
  async getImageBlacklist() {
    try {
      const db = mongoClient.getDb();
      return await db.collection('image_blacklist').find({}, { projection: { _id: 0, keyword: 1, category: 1 } }).toArray();
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi lấy danh sách blacklist:', error);
      return [];
    }
  }
}

module.exports = new StorageDB();
