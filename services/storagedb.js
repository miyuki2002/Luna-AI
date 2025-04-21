const mongoClient = require('./mongoClient.js');
const Profile = require('./profiledb.js');

/**
 * Class để xử lý tất cả các hoạt động lưu trữ liên quan đến cuộc trò chuyện
 */
class StorageDB {
  constructor() {
    // Số lượng tin nhắn tối đa để giữ trong ngữ cảnh
    this.maxConversationLength = 20;

    // Tuổi thọ tối đa của cuộc trò chuyện (tính bằng mili giây) - 3 giờ
    this.maxConversationAge = 3 * 60 * 60 * 1000;

    // Bỏ việc khởi tạo kết nối MongoDB ở đây để tránh kết nối kép
    // Việc khởi tạo sẽ được chuyển sang ready.js

    // Lên lịch dọn dẹp cuộc trò chuyện cũ mỗi giờ
    setInterval(() => this.cleanupOldConversations(), 60 * 60 * 1000);
  }

  /**
   * Thiết lập các collections và indexes MongoDB
   */
  async setupCollections() {
    try {
      const db = mongoClient.getDb();

      // Kiểm tra và xóa collection conversations nếu có vấn đề với chỉ mục
      try {
        // Kiểm tra các chỉ mục hiện tại
        const indexes = await db.collection('conversations').listIndexes().toArray();
        const hasConversationIdIndex = indexes.some(index => index.name === 'conversationId_1');

        if (hasConversationIdIndex) {
          console.log('Phát hiện chỉ mục conversationId_1 không cần thiết...');

          try {
            // Thử xóa chỉ mục trước
            await db.collection('conversations').dropIndex('conversationId_1');
            console.log('Đã xóa chỉ mục conversationId_1');
          } catch (dropIndexError) {
            console.error('Không thể xóa chỉ mục, sẽ xóa và tạo lại collection:', dropIndexError.message);

            // Xóa toàn bộ collection và tạo lại
            await db.collection('conversations').drop();
            console.log('Đã xóa collection conversations để tạo lại');
          }
        }
      } catch (indexError) {
        // Bỏ qua lỗi nếu collection chưa tồn tại
        console.log('Không tìm thấy chỉ mục cần xóa hoặc collection chưa tồn tại');
      }

      // Tạo các indexes cần thiết
      await db.collection('conversations').createIndex({ userId: 1, messageIndex: 1 }, { unique: true });
      await db.collection('conversation_meta').createIndex({ userId: 1 }, { unique: true });
      await db.collection('greetingPatterns').createIndex({ pattern: 1 }, { unique: true });

      console.log('Đã thiết lập collections và indexes MongoDB');
    } catch (error) {
      console.error('Lỗi khi thiết lập collections MongoDB:', error);
      throw error;
    }
  }

  /**
   * Khởi tạo kết nối MongoDB
   */
  async initDatabase() {
    try {
      // Kết nối tới MongoDB
      await mongoClient.connect();
      console.log('Đã khởi tạo kết nối MongoDB thành công, lịch sử trò chuyện sẽ được lưu trữ ở đây.');

      // Khởi tạo các hệ thống
      await this.initializeConversationHistory();
      await this.initializeDefaultGreetingPatterns();
      await this.initializeProfiles();
    } catch (error) {
      console.error('Lỗi khi khởi tạo kết nối MongoDB:', error);
      throw error;
    }
  }

  /**
   * Thêm tin nhắn vào lịch sử cuộc trò chuyện trong MongoDB
   * @param {string} userId - Định danh người dùng
   * @param {string} role - Vai trò của tin nhắn ('user' hoặc 'assistant')
   * @param {string} content - Nội dung tin nhắn
   */
  async addMessageToConversation(userId, role, content) {
    try {
      // Kiểm tra userId có hợp lệ không
      if (!userId) {
        console.error('Lỗi: Không thể thêm tin nhắn vào cuộc trò chuyện với userId rỗng');
        return;
      }

      const db = mongoClient.getDb();

      // Lấy số lượng tin nhắn hiện tại của người dùng
      const count = await db.collection('conversations').countDocuments({ userId });

      try {
        // Thêm tin nhắn mới
        await db.collection('conversations').insertOne({
          userId,
          messageIndex: count,
          role,
          content,
          timestamp: Date.now()
        });
      } catch (insertError) {
        // Xử lý lỗi trùng lặp khóa
        if (insertError.code === 11000) {
          console.warn(`Phát hiện lỗi trùng lặp khóa cho userId ${userId}, đang thử sửa chữa...`);

          // Kiểm tra xem lỗi có liên quan đến conversationId không
          if (insertError.keyValue && insertError.keyValue.conversationId === null) {
            // Reset collection và thử lại
            await this.resetConversationsCollection();

            // Thêm lại tin nhắn sau khi reset
            await db.collection('conversations').insertOne({
              userId,
              messageIndex: 0, // Bắt đầu lại từ 0 sau khi reset
              role,
              content,
              timestamp: Date.now()
            });

            console.log(`Đã khắc phục lỗi trùng lặp khóa bằng cách reset collection`);
          } else {
            // Lỗi trùng lặp khóa userId + messageIndex
            // Tìm messageIndex cao nhất hiện tại
            const highestMsg = await db.collection('conversations')
              .findOne({ userId }, { sort: { messageIndex: -1 } });

            const nextIndex = highestMsg ? highestMsg.messageIndex + 1 : 0;

            // Thử lại với messageIndex mới
            await db.collection('conversations').insertOne({
              userId,
              messageIndex: nextIndex,
              role,
              content,
              timestamp: Date.now()
            });

            console.log(`Đã khắc phục lỗi trùng lặp khóa bằng cách sử dụng messageIndex mới: ${nextIndex}`);
          }
        } else {
          // Nếu không phải lỗi trùng lặp khóa, ném lại lỗi
          throw insertError;
        }
      }

      // Cập nhật timestamp trong bảng meta
      await db.collection('conversation_meta').updateOne(
        { userId },
        { $set: { lastUpdated: Date.now() } },
        { upsert: true }
      );

      // Nếu vượt quá giới hạn, xóa tin nhắn cũ nhất (trừ lời nhắc hệ thống ở index 0)
      if (count >= this.maxConversationLength) {
        // Lấy tin nhắn cũ nhất (ngoại trừ lời nhắc hệ thống)
        const oldestMsg = await db.collection('conversations')
          .findOne(
            { userId, messageIndex: { $gt: 0 } },
            { sort: { messageIndex: 1 } }
          );

        if (oldestMsg) {
          // Xóa tin nhắn cũ nhất
          await db.collection('conversations').deleteOne({
            userId,
            messageIndex: oldestMsg.messageIndex
          });

          // Cập nhật lại chỉ số của các tin nhắn
          await db.collection('conversations').updateMany(
            { userId, messageIndex: { $gt: oldestMsg.messageIndex } },
            { $inc: { messageIndex: -1 } }
          );
        }
      }

      // console.log(`Đã cập nhật cuộc trò chuyện cho người dùng ${userId}, số lượng tin nhắn: ${count + 1}`);
    } catch (error) {
      console.error('Lỗi khi thêm tin nhắn vào MongoDB:', error);
    }
  }

  /**
   * Lấy lịch sử cuộc trò chuyện của người dùng từ MongoDB
   * @param {string} userId - Định danh người dùng
   * @param {string} systemPrompt - Lời nhắc hệ thống để sử dụng nếu không có lịch sử
   * @param {string} modelName - Tên mô hình để thêm vào lời nhắc hệ thống
   * @returns {Array} - Mảng các tin nhắn trò chuyện
   */
  async getConversationHistory(userId, systemPrompt, modelName) {
    try {
      const db = mongoClient.getDb();

      // Kiểm tra xem người dùng đã có lịch sử chưa
      const count = await db.collection('conversations').countDocuments({ userId });

      if (count === 0) {
        // Khởi tạo với lời nhắc hệ thống nếu không có lịch sử
        const systemMessage = {
          role: 'system',
          content: systemPrompt + ` You are running on ${modelName} model.`
        };
        await this.addMessageToConversation(userId, systemMessage.role, systemMessage.content);
        return [systemMessage];
      } else {
        // Cập nhật thời gian để cho biết cuộc trò chuyện này vẫn đang hoạt động
        await db.collection('conversation_meta').updateOne(
          { userId },
          { $set: { lastUpdated: Date.now() } }
        );

        // Lấy tất cả tin nhắn theo thứ tự
        const messages = await db.collection('conversations')
          .find({ userId })
          .sort({ messageIndex: 1 })
          .project({ _id: 0, role: 1, content: 1 })
          .toArray();

        return messages;
      }
    } catch (error) {
      console.error('Lỗi khi lấy lịch sử cuộc trò chuyện:', error);
      // Trả về lời nhắc hệ thống mặc định nếu có lỗi
      return [{
        role: 'system',
        content: systemPrompt + ` You are running on ${modelName} model.`
      }];
    }
  }

  /**
   * Xóa lịch sử cuộc trò chuyện của người dùng
   * @param {string} userId - Định danh người dùng
   * @param {string} systemPrompt - Lời nhắc hệ thống để khởi tạo lại cuộc trò chuyện
   * @param {string} modelName - Tên mô hình để thêm vào lời nhắc hệ thống
   */
  async clearConversationHistory(userId, systemPrompt, modelName) {
    try {
      const db = mongoClient.getDb();

      // Xóa tất cả tin nhắn của người dùng
      await db.collection('conversations').deleteMany({ userId });

      // Khởi tạo lại với lời nhắc hệ thống
      const systemMessage = {
        role: 'system',
        content: systemPrompt + ` You are running on ${modelName} model.`
      };
      await this.addMessageToConversation(userId, systemMessage.role, systemMessage.content);

      // Cập nhật meta
      await db.collection('conversation_meta').updateOne(
        { userId },
        { $set: { lastUpdated: Date.now() } },
        { upsert: true }
      );

      console.log(`Đã xóa cuộc trò chuyện của người dùng ${userId}`);
    } catch (error) {
      console.error('Lỗi khi xóa lịch sử cuộc trò chuyện:', error);
    }
  }

  /**
   * Xóa các cuộc trò chuyện cũ để giải phóng bộ nhớ
   */
  async cleanupOldConversations() {
    try {
      const db = mongoClient.getDb();
      const now = Date.now();

      // Tìm người dùng có cuộc trò chuyện cũ
      const oldUsers = await db.collection('conversation_meta')
        .find({ lastUpdated: { $lt: now - this.maxConversationAge } })
        .project({ userId: 1, _id: 0 })
        .toArray();

      if (oldUsers.length > 0) {
        const userIds = oldUsers.map(user => user.userId);

        // Xóa tin nhắn và metadata của người dùng có cuộc trò chuyện cũ
        await db.collection('conversations').deleteMany({ userId: { $in: userIds } });
        await db.collection('conversation_meta').deleteMany({ userId: { $in: userIds } });

        console.log(`Đã dọn dẹp ${oldUsers.length} cuộc trò chuyện cũ`);
      }
    } catch (error) {
      console.error('Lỗi khi dọn dẹp cuộc trò chuyện cũ:', error);
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

      // Lấy tất cả các mẫu lời chào
      const patterns = await collection.find({}).toArray();

      // Chuyển đổi các mẫu chuỗi thành đối tượng RegExp
      return patterns.map(item => new RegExp(item.pattern, item.flags));
    } catch (error) {
      console.error('Lỗi khi lấy mẫu lời chào từ DB:', error);
      return []; // Trả về mảng rỗng nếu có lỗi
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

      // Kiểm tra xem mẫu đã tồn tại chưa
      const existing = await collection.findOne({ pattern });
      if (existing) {
        return false; // Mẫu đã tồn tại
      }

      // Thêm mẫu mới
      await collection.insertOne({
        pattern,
        flags,
        description,
        createdAt: new Date()
      });

      return true;
    } catch (error) {
      console.error('Lỗi khi thêm mẫu lời chào:', error);
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
      console.error('Lỗi khi xóa mẫu lời chào:', error);
      return false;
    }
  }

  /**
   * Khởi tạo các mẫu lời chào mặc định nếu cơ sở dữ liệu trống
   * @returns {Promise<void>}
   */
  async initializeDefaultGreetingPatterns() {
    try {
      const db = mongoClient.getDb();
      const collection = db.collection('greetingPatterns');

      // Kiểm tra xem collection có trống không
      const count = await collection.countDocuments();
      if (count > 0) {
        return; // Các mẫu đã tồn tại
      }

      // Các mẫu lời chào mặc định
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

      // Thêm các mẫu
      await collection.insertMany(defaultPatterns);
      console.log('Đã khởi tạo các mẫu lời chào mặc định');
    } catch (error) {
      console.error('Lỗi khi khởi tạo mẫu lời chào mặc định:', error);
    }
  }

  /**
   * Xóa và tạo lại collection conversations
   * @returns {Promise<void>}
   */
  async resetConversationsCollection() {
    try {
      const db = mongoClient.getDb();

      // Kiểm tra xem collection có tồn tại không
      const collections = await db.listCollections({ name: 'conversations' }).toArray();

      if (collections.length > 0) {
        // Xóa collection nếu tồn tại
        await db.collection('conversations').drop();
        console.log('Đã xóa collection conversations để tạo lại');
      }

      // Tạo lại collection và các chỉ mục
      await db.createCollection('conversations');
      await db.collection('conversations').createIndex({ userId: 1, messageIndex: 1 }, { unique: true });
      await db.collection('conversations').createIndex({ timestamp: 1 });

      console.log('Đã tạo lại collection conversations với các chỉ mục đúng');
      return true;
    } catch (error) {
      console.error('Lỗi khi reset collection conversations:', error);
      return false;
    }
  }

  /**
   * Khởi tạo các cài đặt và cấu trúc cho lịch sử cuộc trò chuyện
   * @returns {Promise<void>}
   */
  async initializeConversationHistory() {
    try {
      const db = mongoClient.getDb();

      // Kiểm tra xem có vấn đề với chỉ mục conversationId_1 không
      try {
        const indexes = await db.collection('conversations').listIndexes().toArray();
        const hasConversationIdIndex = indexes.some(index => index.name === 'conversationId_1');

        if (hasConversationIdIndex) {
          // Nếu có vấn đề với chỉ mục, reset toàn bộ collection
          await this.resetConversationsCollection();
        } else {
          // Kiểm tra và tạo indexes cho collection conversations nếu chưa có
          const hasTimeIndex = indexes.some(index => index.name === 'timestamp_1');

          if (!hasTimeIndex) {
            // Tạo index theo timestamp để tối ưu hóa truy vấn theo thời gian
            await db.collection('conversations').createIndex({ timestamp: 1 });
            console.log('Đã tạo index timestamp cho collection conversations');
          }
        }
      } catch (indexError) {
        // Nếu collection chưa tồn tại, tạo mới
        await this.resetConversationsCollection();
      }

      // Kiểm tra xem có cần cập nhật cấu trúc dữ liệu lịch sử cuộc trò chuyện không
      const conversationMeta = await db.collection('conversation_meta').findOne({
        metaVersion: { $exists: true }
      });

      if (!conversationMeta) {
        // Khởi tạo document meta với phiên bản hiện tại
        await db.collection('conversation_meta').insertOne({
          metaVersion: 1,
          lastCleanup: Date.now(),
          config: {
            maxConversationLength: this.maxConversationLength,
            maxConversationAge: this.maxConversationAge
          }
        });
        console.log('Đã khởi tạo cấu hình lịch sử cuộc trò chuyện');
      } else {
        // Cập nhật cấu hình nếu cần
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

      // Thực hiện dọn dẹp ban đầu cho dữ liệu cũ
      await this.cleanupOldConversations();

      console.log('Hệ thống lịch sử cuộc trò chuyện đã sẵn sàng');
    } catch (error) {
      console.error('Lỗi khi khởi tạo lịch sử cuộc trò chuyện:', error);
    }
  }

  /**
   * Lấy thông tin profile của người dùng
   * @param {string} userId - Định danh người dùng
   * @returns {Promise<Object>} - Thông tin profile của người dùng
   */
  async getUserProfile(userId) {
    try {
      const db = mongoClient.getDb();
      const profiles = db.collection('user_profiles');

      // Tìm profile của người dùng
      let profile = await profiles.findOne({ _id: userId });

      // Nếu người dùng không có profile, tạo mới
      if (!profile) {
        profile = Profile.createDefaultProfile(userId);
        await profiles.insertOne(profile);
        console.log(`Đã tạo profile mới cho người dùng ${userId}`);
      }

      return profile;
    } catch (error) {
      console.error('Lỗi khi lấy thông tin profile:', error);
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

      // Cập nhật dữ liệu
      const result = await profiles.updateOne(
        { _id: userId },
        { $set: updateData },
        { upsert: true }
      );

      return result.acknowledged;
    } catch (error) {
      console.error('Lỗi khi cập nhật profile:', error);
      return false;
    }
  }

  /**
   * Tăng hoặc giảm số lượng tài nguyên trong ví của người dùng
   * @param {string} userId - Định danh người dùng
   * @param {string} resourceType - Loại tài nguyên (bank, wallet, shard)
   * @param {number} amount - Số lượng cần thay đổi
   * @returns {Promise<Object>} - Dữ liệu economy sau khi cập nhật
   */
  async updateUserEconomy(userId, resourceType, amount) {
    try {
      const db = mongoClient.getDb();
      const profiles = db.collection('user_profiles');

      // Xác định đường dẫn của trường cần cập nhật
      const fieldPath = `data.economy.${resourceType}`;

      // Tạo đối tượng cập nhật
      const updateObj = { $inc: {} };
      updateObj.$inc[fieldPath] = amount;

      // Cập nhật dữ liệu
      await profiles.updateOne(
        { _id: userId },
        updateObj,
        { upsert: true }
      );

      // Lấy dữ liệu economy mới sau khi cập nhật
      const updatedProfile = await profiles.findOne(
        { _id: userId },
        { projection: { 'data.economy': 1 } }
      );

      return updatedProfile?.data?.economy || null;
    } catch (error) {
      console.error('Lỗi khi cập nhật economy của người dùng:', error);
      return null;
    }
  }

  /**
   * Khởi tạo các cài đặt và cấu trúc cho hệ thống profile
   * @returns {Promise<void>}
   */
  async initializeProfiles() {
    try {
      const db = mongoClient.getDb();

      // Kiểm tra và tạo collection nếu chưa có
      const collections = await db.listCollections({ name: 'user_profiles' }).toArray();
      if (collections.length === 0) {
        await db.createCollection('user_profiles');
        console.log('Đã tạo collection user_profiles');
      }

      // Xóa index cũ nếu tồn tại để tránh xung đột
      try {
        // Kiểm tra xem index userId_1 có tồn tại không
        const indexes = await db.collection('user_profiles').listIndexes().toArray();
        const hasUserIdIndex = indexes.some(index => index.name === 'userId_1');

        if (hasUserIdIndex) {
          // Nếu tồn tại, xóa index này
          await db.collection('user_profiles').dropIndex('userId_1');
          console.log('Đã xóa index userId_1 cũ từ collection user_profiles');
        }
      } catch (indexError) {
        console.warn('Cảnh báo khi xóa index cũ:', indexError.message);
      }

      console.log('Hệ thống profile người dùng đã sẵn sàng');
    } catch (error) {
      console.error('Lỗi khi khởi tạo hệ thống profile:', error);
    }
  }

  /**
   * Lấy thông tin profile card của người dùng
   * @param {string} userId - Định danh người dùng
   * @returns {Promise<Object>} - Dữ liệu cho profile card
   */
  async getProfileCardData(userId) {
    try {
      const profile = await this.getUserProfile(userId);

      // Lấy thêm thông tin xếp hạng từ database (nếu có)
      const db = mongoClient.getDb();

      // Lấy tất cả người dùng theo global_xp để tính xếp hạng
      const allProfiles = await db.collection('user_profiles')
        .find({}, { projection: { _id: 1, 'data.global_xp': 1 } })
        .sort({ 'data.global_xp': -1 })
        .toArray();

      // Tính toán xếp hạng toàn cầu
      const globalRank = allProfiles.findIndex(p => p._id === userId) + 1;

      // Trả về dữ liệu cần thiết cho profile card
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
      console.error('Lỗi khi lấy dữ liệu profile card:', error);
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
      // Lấy dữ liệu profile
      const profileData = await this.getProfileCardData(userId);

      // Sử dụng module profileCanvas để tạo hình ảnh
      const profileCanvas = require('./canvas/profileCanvas');
      const cardBuffer = await profileCanvas.createProfileCard(profileData);

      return cardBuffer;
    } catch (error) {
      console.error('Lỗi khi tạo profile card:', error);
      throw error;
    }
  }
}

// Xuất một thể hiện duy nhất của StorageDB
module.exports = new StorageDB();
