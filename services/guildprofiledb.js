const { MongoClient, ObjectId } = require('mongodb');
const mongoClient = require('./mongoClient.js');

// Log khi module được tải
console.log('🔄 GuildProfileDB module đã được tải vào hệ thống');

/**
 * Cấu trúc mặc định cho hồ sơ guild
 */
const guildProfileStructure = {
  _id: String,  // Guild ID
  prefix: null,
  greeter: {
    welcome: {
      isEnabled: false,
      channel: null,
      message: null,
      embed: false,
      type: 'default'
    },
    leaving: {
      isEnabled: false,
      channel: null,
      message: null,
      embed: null,
      type: 'default'
    }
  },
  xp: {
    isActive: true,  // XP được kích hoạt mặc định
    exceptions: []   // Mảng ID kênh không tính XP
  },
  roles: {
    muted: null
  },
  channels: {
    suggest: null
  }
};

/**
 * Lấy collection hồ sơ guild từ MongoDB
 * @returns {Promise<Collection>} MongoDB collection
 */
const getGuildProfileCollection = async () => {
  try {
    const db = mongoClient.getDb();
    console.log('📋 Đang truy cập collection guild_profiles');
    return db.collection('guild_profiles');
  } catch (error) {
    console.error('❌ Lỗi khi truy cập collection guild_profiles:', error);
    throw error;
  }
};

/**
 * Tạo profile mới cho guild với các giá trị mặc định
 * @param {String} guildId - ID của guild
 * @returns {Object} Guild profile object
 */
const createDefaultGuildProfile = (guildId) => {
  console.log(`🆕 Tạo profile mới cho guild: ${guildId}`);
  return {
    _id: guildId,
    ...guildProfileStructure
  };
};

/**
 * Lấy tất cả hồ sơ guild
 * @returns {Promise<Array>} Mảng tất cả hồ sơ guild
 */
const getAllGuildProfiles = async () => {
  try {
    const collection = await getGuildProfileCollection();
    return await collection.find({}).toArray();
  } catch (error) {
    console.error('❌ Lỗi khi lấy tất cả hồ sơ guild:', error);
    return [];
  }
};

/**
 * Lấy hồ sơ của một guild cụ thể
 * @param {String} guildId - ID của guild
 * @returns {Promise<Object|null>} Hồ sơ guild hoặc null nếu không tìm thấy
 */
const getGuildProfile = async (guildId) => {
  try {
    const collection = await getGuildProfileCollection();
    
    // Tìm hồ sơ guild trong database
    let profile = await collection.findOne({ _id: guildId });
    
    // Nếu không tìm thấy, tạo mới
    if (!profile) {
      profile = createDefaultGuildProfile(guildId);
      await collection.insertOne(profile);
    }
    
    return profile;
  } catch (error) {
    console.error(`❌ Lỗi khi lấy hồ sơ guild ${guildId}:`, error);
    throw error;
  }
};

/**
 * Cập nhật hồ sơ của một guild
 * @param {String} guildId - ID của guild
 * @param {Object} updateData - Dữ liệu cần cập nhật
 * @returns {Promise<Boolean>} Kết quả cập nhật
 */
const updateGuildProfile = async (guildId, updateData) => {
  try {
    const collection = await getGuildProfileCollection();
    
    // Cập nhật hoặc tạo mới nếu chưa tồn tại
    const result = await collection.updateOne(
      { _id: guildId },
      { $set: updateData },
      { upsert: true }
    );
    
    return result.acknowledged;
  } catch (error) {
    console.error(`❌ Lỗi khi cập nhật hồ sơ guild ${guildId}:`, error);
    return false;
  }
};

/**
 * Thiết lập kênh ngoại lệ XP
 * @param {String} guildId - ID của guild
 * @param {String} channelId - ID của kênh
 * @param {Boolean} isException - true để thêm vào ngoại lệ, false để loại bỏ
 * @returns {Promise<Boolean>} Kết quả cập nhật
 */
const setXpChannelException = async (guildId, channelId, isException) => {
  try {
    const profile = await getGuildProfile(guildId);
    
    if (!profile.xp) {
      profile.xp = { isActive: true, exceptions: [] };
    }
    
    const exceptions = profile.xp.exceptions || [];
    const hasException = exceptions.includes(channelId);
    
    if (isException && !hasException) {
      // Thêm kênh vào danh sách ngoại lệ
      profile.xp.exceptions = [...exceptions, channelId];
    } else if (!isException && hasException) {
      // Xóa kênh khỏi danh sách ngoại lệ
      profile.xp.exceptions = exceptions.filter(id => id !== channelId);
    } else {
      // Không có thay đổi
      return true;
    }
    
    return await updateGuildProfile(guildId, { xp: profile.xp });
  } catch (error) {
    console.error(`❌ Lỗi khi thiết lập ngoại lệ XP cho guild ${guildId}:`, error);
    return false;
  }
};

/**
 * Bật/tắt hệ thống XP cho guild
 * @param {String} guildId - ID của guild
 * @param {Boolean} isActive - true để bật, false để tắt
 * @returns {Promise<Boolean>} Kết quả cập nhật
 */
const toggleXpSystem = async (guildId, isActive) => {
  try {
    const profile = await getGuildProfile(guildId);
    
    if (!profile.xp) {
      profile.xp = { isActive, exceptions: [] };
    } else {
      profile.xp.isActive = isActive;
    }
    
    return await updateGuildProfile(guildId, { xp: profile.xp });
  } catch (error) {
    console.error(`❌ Lỗi khi ${isActive ? 'bật' : 'tắt'} XP cho guild ${guildId}:`, error);
    return false;
  }
};

/**
 * Tạo và thiết lập indexes cho collection guild_profiles
 */
const setupGuildProfileIndexes = async () => {
  try {
    const db = mongoClient.getDb();
    
    // Tạo index cho collections
    await db.collection('guild_profiles').createIndex({ '_id': 1 });
    
    console.log('✅ Đã thiết lập indexes cho collection guild_profiles');
  } catch (error) {
    console.error('❌ Lỗi khi thiết lập indexes cho guild_profiles:', error);
    throw error;
  }
};

module.exports = {
  guildProfileStructure,
  getGuildProfileCollection,
  createDefaultGuildProfile,
  getGuildProfile,
  getAllGuildProfiles,
  updateGuildProfile,
  setXpChannelException,
  toggleXpSystem,
  setupGuildProfileIndexes
};