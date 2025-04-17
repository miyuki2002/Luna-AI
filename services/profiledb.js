const { MongoClient, ObjectId } = require('mongodb');
const mongoClient = require('./mongoClient.js');

// Log khi module được tải
console.log('🔄 ProfileDB module đã được tải vào hệ thống');

// Define the profile schema structure for reference
const profileStructure = {
  _id: String,
  data: {
    global_xp: 0,
    global_level: 1,
    profile: {
      bio: 'No bio written.',
      background: null,
      pattern: null,
      emblem: null,
      hat: null,
      wreath: null,
      color: null,
      birthday: null,
      inventory: [],
      // Thêm các trường mới
      social: {
        twitter: null,
        youtube: null,
        twitch: null,
        website: null
      },
      custom_status: null,
      badges: [],
      frame: null,
      effect: null
    },
    economy: {
      bank: null,
      wallet: null,
      streak: {
        alltime: 0,
        current: 0,
        timestamp: 0
      },
      shard: null
    },
    reputation: {
      points: 0,
      givenBy: [],
      lastGiven: 0
    },
    tips: {
      given: 0,
      received: 0,
      timestamp: 0
    },
    xp: [],
    vote: {
      notification: true
    }
  }
};

// Function to get the profile collection
const getProfileCollection = async (client) => {
  const db = mongoClient.getDb();
  // Log khi function này được gọi
  console.log('📋 Đang truy cập collection user_profiles');
  return db.collection('user_profiles');
};

// Helper function to create a new profile with default values
const createDefaultProfile = (userId) => {
  // Log khi có profile mới được tạo
  console.log(`🆕 Tạo profile mới cho người dùng: ${userId}`);
  return {
    _id: userId,
    ...profileStructure
  };
};

module.exports = {
  profileStructure,
  getProfileCollection,
  createDefaultProfile
};
