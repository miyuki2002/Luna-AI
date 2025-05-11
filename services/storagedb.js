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
      await db.collection('greetingPatterns').createIndex({ pattern: 1 }, { unique: true });

      // Tạo các collection cho hệ thống giám sát và quản lý
      try {
        await db.createCollection('monitor_settings');
        await db.createCollection('monitor_logs');
        await db.createCollection('mod_settings');
        await db.createCollection('image_blacklist');
        logger.info('DATABASE', 'Đã tạo các collection cho hệ thống giám sát và moderation');
      } catch (error) {
        logger.info('DATABASE', 'Các collection cho hệ thống giám sát đã tồn tại hoặc không thể tạo');
      }

      // Tạo các chỉ mục cho hệ thống giám sát
      try {
        await db.collection('monitor_settings').createIndex({ guildId: 1 }, { unique: true });
        await db.collection('monitor_logs').createIndex({ guildId: 1, timestamp: -1 });
        await db.collection('monitor_logs').createIndex({ userId: 1 });
        await db.collection('mod_settings').createIndex({ guildId: 1 }, { unique: true });
        await db.collection('image_blacklist').createIndex({ category: 1 });
        await db.collection('image_blacklist').createIndex({ keyword: 1 });
        logger.info('DATABASE', 'Đã tạo các chỉ mục cho hệ thống giám sát và moderation');
      } catch (error) {
        logger.error('DATABASE', 'Lỗi khi tạo chỉ mục cho hệ thống giám sát:', error);
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
        'greetingPatterns',
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
      await this.initializeDefaultGreetingPatterns();
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
        await this.initializeDefaultGreetingPatterns();
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
          .find({ userId })
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
   * Lấy danh sách các mẫu lời chào từ cơ sở dữ liệu
   * @returns {Promise<Array>} - Mảng các mẫu regex lời chào
   */
  async getGreetingPatterns() {
    try {
      const db = mongoClient.getDb();
      const collection = db.collection('greetingPatterns');

      const patterns = await collection.find({}).toArray();

      return patterns.map(item => new RegExp(item.pattern, item.flags));
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi lấy mẫu lời chào từ DB:', error);
      return [];
    }
  }

  /**
   * Thêm mẫu lời chào mới vào cơ sở dữ liệu
   * @param {string} pattern - Biểu thức chính quy dạng chuỗi
   * @param {string} flags - Cờ cho regex (vd: 'i' cho case-insensitive)
   * @param {string} description - Mô tả về mẫu lời chào
   * @returns {Promise<boolean>} - Kết quả thêm mới
   */
  async addGreetingPattern(pattern, flags = 'i', description = '') {
    try {
      const db = mongoClient.getDb();
      const collection = db.collection('greetingPatterns');

      const existing = await collection.findOne({ pattern });
      if (existing) {
        return false;
      }

      await collection.insertOne({
        pattern,
        flags,
        description,
        createdAt: new Date()
      });

      return true;
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi thêm mẫu lời chào:', error);
      return false;
    }
  }

  /**
   * Xóa mẫu lời chào từ cơ sở dữ liệu
   * @param {string} pattern - Biểu thức chính quy dạng chuỗi cần xóa
   * @returns {Promise<boolean>} - Kết quả xóa
   */
  async removeGreetingPattern(pattern) {
    try {
      const db = mongoClient.getDb();
      const collection = db.collection('greetingPatterns');

      const result = await collection.deleteOne({ pattern });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi xóa mẫu lời chào:', error);
      return false;
    }
  }

  /**
   * Khởi tạo các mẫu lời chào mặc định
   * @returns {Promise<void>}
   */
  async initializeDefaultGreetingPatterns() {
    try {
      const db = mongoClient.getDb();
      const collection = db.collection('greetingPatterns');

      const count = await collection.countDocuments();
      if (count > 0) {
        return;
      }

      const defaultPatterns = [
        { pattern: '^(xin\\s+)?(chào|kính\\s+chào|chào\\s+mừng|xin\\s+chúc|hú|hú\\s+hú|của\\s+nợ|haly|halo|ha\\s+lô|lô|lô\\s+lô)\\s+(bạn|cậu|các\\s+bạn|mọi\\s+người|anh|chị|em|quý\\s+khách|quý\\s+vị|mọi\\s+người)?(\\s*[,.!?~])*\\s*', flags: 'i', description: 'Lời chào tiếng Việt cơ bản' },
        { pattern: '^(hi+|hello+|hey+|hee+y+|good\\s+(morning|afternoon|evening|day)|greetings|howdy|what\'?s\\s+up|yo+|hai|hiya+|oi)(\\s+there)?(\\s+(everyone|friend|guys|folks|all))?(\\s*[,.!?~])*\\s*', flags: 'i', description: 'Lời chào tiếng Anh' },
        { pattern: '^(hehe|hihi|huhu|hoho|:D|:\\)|\\^\\^|<3|:\\*|\\(y\\))\\s*', flags: 'i', description: 'Lời chào với biểu cảm/emojis phổ biến' },
        { pattern: '^(mình|tôi|tớ|t|tui|em|anh|chị)(\\s+(là|tên|tên là|tên gọi là))?\\s+(luna|grok|ai|trợ\\s+lý|bot|chatbot|assistant|người\\s+máy)(\\s+(đây|nha|nhé|ạ|á|đó|nè|nhaa?|á))?(\\s*[,.!?~])*\\s*', flags: 'i', description: 'Tự giới thiệu' },
        { pattern: '^(chào\\s+(buổi\\s+)?(sáng|trưa|chiều|tối|khuya)|buổi\\s+(sáng|trưa|chiều|tối|khuya)(\\s+vui\\s+vẻ)?)(\\s+(bạn|các\\s+bạn|mọi\\s+người))?(\\s*[,.!?~])*\\s*', flags: 'i', description: 'Lời chào theo thời gian' },
        { pattern: '^(rất|thật)?\\s*vui\\s+(được\\s+)?(gặp|gặp\\s+gỡ|gặp\\s+lại|nói\\s+chuyện|trò\\s+chuyện|hội\\s+ngộ)(\\s+(với|cùng))?\\s+(bạn|các\\s+bạn|cậu|mọi\\s+người|quý\\s+vị)(\\s*[,.!?~])*\\s*', flags: 'i', description: 'Cách chào thăm hỏi' },
        { pattern: '^(hmm+|ừm+|ờm+|à+|ừ+|okay+|ok|okie|so|vậy|thế|nào|vậy\\s+thì|thế\\s+thì|bắt\\s+đầu\\s+nào|let\'s\\s+start|bắt\\s+đầu\\s+thôi)(\\s*[,.!?~])*\\s*', flags: 'i', description: 'Lời chào trước khi bắt đầu' },
        { pattern: '^(chúc\\s+mừng|happy|merry)\\s+(năm\\s+mới|sinh\\s+nhật|christmas|new\\s+year|holiday|anniversary|weekend)(\\s*[,.!?~])*\\s*', flags: 'i', description: 'Lời chào theo dịp đặc biệt' },
        { pattern: '^(mình\\s+là|tui\\s+là|tớ\\s+là|ai\\s+là|tao\\s+là|người\\s+đây\\s+là|đây\\s+là)\\s+luna(\\s*[,.!?~])*\\s*', flags: 'i', description: 'Lời chào bằng tiếng địa phương' },
        { pattern: '^(bonjour|hola|ciao|konnichiwa|namaste|guten\\s+tag|salut|aloha|xin\\s+chào)(\\s*[,.!?~])*\\s*', flags: 'i', description: 'Lời chào bằng nhiều ngôn ngữ khác' },
        { pattern: '^(tôi|mình|tớ|em)\\s+(là|chính\\s+là|hoạt\\s+động\\s+như|làm\\s+việc\\s+như)\\s+(một|1)?\\s*(con\\s+bot|trợ\\s+lý\\s+ảo|chatbot|large\\s+language\\s+model|virtual\\s+assistant|ai\\s+assistant|mô\\s+hình\\s+ngôn\\s+ngữ)(\\s*[,.!?~])*\\s*', flags: 'i', description: 'Lời giới thiệu kiểu bot/AI' },
        { pattern: '^(rất\\s+vui|vui|hân\\s+hạnh|vinh\\s+dự|rất\\s+hân\\s+hạnh|thật\\s+tuyệt|thật\\s+vui|thật\\s+tốt|tuyệt\\s+vời)\\s+(khi|được)\\s+(gặp|gặp\\s+gỡ|gặp\\s+lại|trò\\s+chuyện|nói\\s+chuyện|hỗ\\s+trợ|giúp\\s+đỡ|phục\\s+vụ)(\\s*[,.!?~])*\\s*', flags: 'i', description: 'Lời giới thiệu với cảm xúc' },
        { pattern: '^(chào|hi|hello|hey|xin\\s+chào)\\s+.{1,10}(,|\\.|\\!|\\?)\\s+mình\\s+là\\s+luna', flags: 'i', description: 'Lời chào mở rộng' },
        { pattern: '^(mình|tôi|tớ|em)\\s+(đã|sẽ|đang|vẫn|luôn)\\s+(sẵn\\s+sàng|ở\\s+đây|có\\s+mặt)(\\s+(để|nhằm))?\\s+(giúp|hỗ\\s+trợ|trả\\s+lời|giúp\\s+đỡ|hỗ\\s+trợ|phục\\s+vụ|làm\\s+việc\\s+với)\\s+(bạn|các\\s+bạn|cậu|bạn\\s+đó|quý\\s+khách)(\\s*[,.!?~])*\\s*', flags: 'i', description: 'Lời chào với thông báo sẵn sàng' }
      ];

      await collection.insertMany(defaultPatterns);
      logger.info('DATABASE', 'Đã khởi tạo các mẫu lời chào mặc định');
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi khởi tạo mẫu lời chào mặc định:', error);
    }
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
        { projection: { 'data.economy': 1 } }
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
          {
            category: 'adult',
            keyword: 'nude',
            description: 'Hình ảnh khỏa thân',
            severity: 'high'
          },
          {
            category: 'adult',
            keyword: 'porn',
            description: 'Nội dung khiêu dâm',
            severity: 'high'
          },
          {
            category: 'adult',
            keyword: 'hentai',
            description: 'Nội dung người lớn anime/manga',
            severity: 'high'
          },

          // Bạo lực
          {
            category: 'violence',
            keyword: 'gore',
            description: 'Bạo lực đẫm máu',
            severity: 'high'
          },
          {
            category: 'violence',
            keyword: 'murder',
            description: 'Giết người',
            severity: 'high'
          },

          // Chính trị nhạy cảm
          {
            category: 'politics',
            keyword: 'extremist',
            description: 'Nội dung cực đoan',
            severity: 'high'
          },
          {
            category: 'politics',
            keyword: 'terrorist',
            description: 'Khủng bố',
            severity: 'high'
          },

          // Phân biệt chủng tộc
          {
            category: 'racism',
            keyword: 'racist',
            description: 'Phân biệt chủng tộc',
            severity: 'high'
          },
          {
            category: 'racism',
            keyword: 'hate',
            description: 'Phát ngôn thù ghét',
            severity: 'high'
          },

          // Tôn giáo nhạy cảm
          {
            category: 'religion',
            keyword: 'blasphemy',
            description: 'Xúc phạm tôn giáo',
            severity: 'high'
          },
          {
            category: 'religion',
            keyword: 'sacrilege',
            description: 'Phạm thánh',
            severity: 'high'
          }
        ];

        await db.collection('image_blacklist').insertMany(defaultBlacklist);
        logger.info('DATABASE', 'Đã khởi tạo blacklist mặc định cho generateImage');
      }

      logger.info('DATABASE', 'Hệ thống blacklist cho generateImage đã sẵn sàng');
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi khởi tạo blacklist cho generateImage:', error);
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
      const blacklist = await db.collection('image_blacklist').find().toArray();

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
      return await db.collection('image_blacklist').find().toArray();
    } catch (error) {
      logger.error('DATABASE', 'Lỗi khi lấy danh sách blacklist:', error);
      return [];
    }
  }
}

module.exports = new StorageDB();
