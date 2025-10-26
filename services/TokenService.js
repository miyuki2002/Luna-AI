const mongoClient = require('./mongoClient.js');
const logger = require('../utils/logger.js');

/**
 * Service quản lý giới hạn lượt nhắn tin và vai trò người dùng
 */
class MessageService {
  constructor() {
    // Định nghĩa giới hạn lượt nhắn tin theo vai trò (lượt mỗi ngày)
    this.roleLimits = {
      owner: -1,        // Không giới hạn
      admin: 1000,      // 1000 lượt/ngày
      helper: 500,      // 500 lượt/ngày
      user: 100         // 100 lượt/ngày (mặc định)
    };

    // Owner ID từ biến môi trường
    this.ownerId = process.env.OWNER_ID ? process.env.OWNER_ID.trim() : null;
    
    logger.info('MESSAGE_SERVICE', `Khởi tạo MessageService với owner ID: ${this.ownerId || 'không có'}`);
  }

  /**
   * Lấy collection user_messages
   */
  async getMessageCollection() {
    const db = mongoClient.getDb();
    return db.collection('user_messages');
  }

  /**
   * Lấy collection user_profiles
   */
  async getProfileCollection() {
    const db = mongoClient.getDb();
    return db.collection('user_profiles');
  }

  /**
   * Khởi tạo dữ liệu token cho người dùng
   */
  async initializeUserMessageData(userId) {
    try {
      const collection = await this.getMessageCollection();
      const profileCollection = await this.getProfileCollection();

      // Kiểm tra xem user đã có dữ liệu chưa
      const existing = await collection.findOne({ userId });
      if (existing) {
        return existing;
      }

      // Xác định vai trò của người dùng
      let role = 'user';
      if (this.ownerId && userId === this.ownerId) {
        role = 'owner';
      } else {
        // Kiểm tra role trong profile
        const profile = await profileCollection.findOne({ _id: userId });
        if (profile?.data?.role) {
          role = profile.data.role;
        }
      }

      // Tạo dữ liệu message mới
      const messageData = {
        userId,
        role,
        messageUsage: {
          daily: 0,
          weekly: 0,
          monthly: 0,
          total: 0
        },
        limits: {
          daily: this.roleLimits[role]
        },
        lastReset: {
          daily: Date.now(),
          weekly: Date.now(),
          monthly: Date.now()
        },
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await collection.insertOne(tokenData);
      logger.info('TOKEN_SERVICE', `Khởi tạo dữ liệu token cho user ${userId} với role ${role}`);

      // Cập nhật role trong profile nếu chưa có
      if (role !== 'user') {
        await profileCollection.updateOne(
          { _id: userId },
          { $set: { 'data.role': role } },
          { upsert: true }
        );
      }

      return tokenData;
    } catch (error) {
      logger.error('TOKEN_SERVICE', `Lỗi khi khởi tạo dữ liệu token cho ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Lấy thông tin token của người dùng
   */
  async getUserMessageData(userId) {
    try {
      const collection = await this.getMessageCollection();
      let messageData = await collection.findOne({ userId });

      if (!messageData) {
        messageData = await this.initializeUserMessageData(userId);
      } else {
        // Kiểm tra và reset nếu cần
        await this.checkAndResetLimits(userId);
        // Lấy lại dữ liệu sau khi reset
        messageData = await collection.findOne({ userId });
      }

      return messageData;
    } catch (error) {
      logger.error('MESSAGE_SERVICE', `Lỗi khi lấy dữ liệu message cho ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kiểm tra và reset giới hạn nếu đã qua chu kỳ
   */
  async checkAndResetLimits(userId) {
    try {
      const collection = await this.getTokenCollection();
      const tokenData = await collection.findOne({ userId });

      if (!tokenData) return;

      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const oneWeek = 7 * oneDay;
      const oneMonth = 30 * oneDay;

      const updates = {};
      let needsUpdate = false;

      // Reset daily
      if (now - tokenData.lastReset.daily > oneDay) {
        updates['tokenUsage.daily'] = 0;
        updates['lastReset.daily'] = now;
        needsUpdate = true;
        logger.info('TOKEN_SERVICE', `Reset giới hạn hàng ngày cho user ${userId}`);
      }

      // Reset weekly
      if (now - tokenData.lastReset.weekly > oneWeek) {
        updates['tokenUsage.weekly'] = 0;
        updates['lastReset.weekly'] = now;
        needsUpdate = true;
      }

      // Reset monthly
      if (now - tokenData.lastReset.monthly > oneMonth) {
        updates['tokenUsage.monthly'] = 0;
        updates['lastReset.monthly'] = now;
        needsUpdate = true;
      }

      if (needsUpdate) {
        updates.updatedAt = now;
        await collection.updateOne({ userId }, { $set: updates });
      }
    } catch (error) {
      logger.error('TOKEN_SERVICE', `Lỗi khi reset giới hạn cho ${userId}:`, error);
    }
  }

  /**
   * Kiểm tra xem người dùng có thể sử dụng thêm lượt nhắn tin không
   */
  async canUseMessages(userId, estimatedMessages = 1) {
    try {
      const messageData = await this.getUserMessageData(userId);

      // Owner không bị giới hạn
      if (messageData.role === 'owner' || messageData.limits.daily === -1) {
        return {
          allowed: true,
          remaining: -1,
          role: messageData.role,
          current: messageData.messageUsage.daily,
          limit: -1
        };
      }

      const remaining = messageData.limits.daily - messageData.messageUsage.daily;
      const allowed = remaining >= estimatedMessages;

      return {
        allowed,
        remaining,
        role: messageData.role,
        current: messageData.messageUsage.daily,
        limit: messageData.limits.daily,
        estimated: estimatedMessages
      };
    } catch (error) {
      logger.error('TOKEN_SERVICE', `Lỗi khi kiểm tra giới hạn token cho ${userId}:`, error);
      // Mặc định cho phép nếu có lỗi để không làm gián đoạn dịch vụ
      return { allowed: true, remaining: 0, role: 'user', error: error.message };
    }
  }

  /**
   * Ghi nhận việc sử dụng token
   */
  async recordMessageUsage(userId, messagesUsed = 1, operation = 'chat') {
    try {
      const collection = await this.getMessageCollection();
      const now = Date.now();

      // Tạo bản ghi lịch sử
      const historyEntry = {
        messages: messagesUsed,
        operation,
        timestamp: now
      };

      // Cập nhật số liệu
      await collection.updateOne(
        { userId },
        {
          $inc: {
            'messageUsage.daily': messagesUsed,
            'messageUsage.weekly': messagesUsed,
            'messageUsage.monthly': messagesUsed,
            'messageUsage.total': messagesUsed
          },
          $push: {
            history: {
              $each: [historyEntry],
              $slice: -100 // Chỉ giữ 100 bản ghi gần nhất
            }
          },
          $set: {
            updatedAt: now
          }
        },
        { upsert: true }
      );

      logger.debug('TOKEN_SERVICE', `Ghi nhận ${tokensUsed} tokens cho user ${userId} (${operation})`);

      return true;
    } catch (error) {
      logger.error('TOKEN_SERVICE', `Lỗi khi ghi nhận token usage cho ${userId}:`, error);
      return false;
    }
  }

  /**
   * Đặt vai trò cho người dùng
   */
  async setUserRole(userId, role) {
    try {
      if (!['owner', 'admin', 'helper', 'user'].includes(role)) {
        throw new Error(`Vai trò không hợp lệ: ${role}`);
      }

      const collection = await this.getTokenCollection();
      const profileCollection = await this.getProfileCollection();
      const now = Date.now();

      // Cập nhật role và limits
      await collection.updateOne(
        { userId },
        {
          $set: {
            role,
            'limits.daily': this.roleLimits[role],
            updatedAt: now
          }
        },
        { upsert: true }
      );

      // Cập nhật role trong profile
      await profileCollection.updateOne(
        { _id: userId },
        { $set: { 'data.role': role } },
        { upsert: true }
      );

      logger.info('TOKEN_SERVICE', `Đặt role ${role} cho user ${userId}`);
      return true;
    } catch (error) {
      logger.error('TOKEN_SERVICE', `Lỗi khi đặt role cho ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Lấy vai trò của người dùng
   */
  async getUserRole(userId) {
    try {
      // Kiểm tra owner trước
      if (this.ownerId && userId === this.ownerId) {
        return 'owner';
      }

      const tokenData = await this.getUserTokenData(userId);
      return tokenData.role || 'user';
    } catch (error) {
      logger.error('TOKEN_SERVICE', `Lỗi khi lấy role của ${userId}:`, error);
      return 'user';
    }
  }

  /**
   * Lấy thống kê token của người dùng
   */
  async getUserTokenStats(userId) {
    try {
      const tokenData = await this.getUserTokenData(userId);

      return {
        userId,
        role: tokenData.role,
        usage: {
          daily: tokenData.tokenUsage.daily,
          weekly: tokenData.tokenUsage.weekly,
          monthly: tokenData.tokenUsage.monthly,
          total: tokenData.tokenUsage.total
        },
        limits: {
          daily: tokenData.limits.daily
        },
        remaining: {
          daily: tokenData.limits.daily === -1 ? -1 : tokenData.limits.daily - tokenData.tokenUsage.daily
        },
        lastReset: tokenData.lastReset,
        recentHistory: tokenData.history.slice(-10)
      };
    } catch (error) {
      logger.error('TOKEN_SERVICE', `Lỗi khi lấy thống kê token cho ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Reset token usage cho người dùng (admin only)
   */
  async resetUserTokens(userId, resetType = 'daily') {
    try {
      const collection = await this.getTokenCollection();
      const now = Date.now();

      const updates = {
        updatedAt: now
      };

      switch (resetType) {
        case 'daily':
          updates['tokenUsage.daily'] = 0;
          updates['lastReset.daily'] = now;
          break;
        case 'weekly':
          updates['tokenUsage.weekly'] = 0;
          updates['lastReset.weekly'] = now;
          break;
        case 'monthly':
          updates['tokenUsage.monthly'] = 0;
          updates['lastReset.monthly'] = now;
          break;
        case 'all':
          updates['tokenUsage.daily'] = 0;
          updates['tokenUsage.weekly'] = 0;
          updates['tokenUsage.monthly'] = 0;
          updates['lastReset.daily'] = now;
          updates['lastReset.weekly'] = now;
          updates['lastReset.monthly'] = now;
          break;
      }

      await collection.updateOne({ userId }, { $set: updates });
      logger.info('TOKEN_SERVICE', `Reset ${resetType} tokens cho user ${userId}`);

      return true;
    } catch (error) {
      logger.error('TOKEN_SERVICE', `Lỗi khi reset tokens cho ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Lấy thống kê tổng quan của hệ thống
   */
  async getSystemStats() {
    try {
      const collection = await this.getTokenCollection();
      
      const allUsers = await collection.find({}).toArray();
      
      const stats = {
        totalUsers: allUsers.length,
        byRole: {
          owner: 0,
          admin: 0,
          helper: 0,
          user: 0
        },
        totalTokensUsed: {
          daily: 0,
          weekly: 0,
          monthly: 0,
          total: 0
        },
        topUsers: []
      };

      allUsers.forEach(user => {
        stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1;
        stats.totalTokensUsed.daily += user.tokenUsage.daily || 0;
        stats.totalTokensUsed.weekly += user.tokenUsage.weekly || 0;
        stats.totalTokensUsed.monthly += user.tokenUsage.monthly || 0;
        stats.totalTokensUsed.total += user.tokenUsage.total || 0;
      });

      // Top 10 người dùng sử dụng nhiều token nhất
      stats.topUsers = allUsers
        .sort((a, b) => (b.tokenUsage.daily || 0) - (a.tokenUsage.daily || 0))
        .slice(0, 10)
        .map(u => ({
          userId: u.userId,
          role: u.role,
          daily: u.tokenUsage.daily,
          total: u.tokenUsage.total
        }));

      return stats;
    } catch (error) {
      logger.error('TOKEN_SERVICE', 'Lỗi khi lấy thống kê hệ thống:', error);
      throw error;
    }
  }

  /**
   * Khởi tạo collection và indexes
   */
  async initializeCollection() {
    try {
      const db = mongoClient.getDb();

      // Tạo collection nếu chưa có
      const collections = await db.listCollections({ name: 'user_tokens' }).toArray();
      if (collections.length === 0) {
        await db.createCollection('user_tokens');
        logger.info('TOKEN_SERVICE', 'Đã tạo collection user_tokens');
      }

      // Tạo indexes
      await db.collection('user_tokens').createIndex({ userId: 1 }, { unique: true });
      await db.collection('user_tokens').createIndex({ role: 1 });
      await db.collection('user_tokens').createIndex({ 'tokenUsage.total': -1 });

      logger.info('TOKEN_SERVICE', 'Đã khởi tạo collection và indexes cho TokenService');
    } catch (error) {
      logger.error('TOKEN_SERVICE', 'Lỗi khi khởi tạo collection:', error);
      throw error;
    }
  }
}

module.exports = new MessageService();

