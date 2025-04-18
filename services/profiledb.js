const { MongoClient, ObjectId } = require('mongodb');
const mongoClient = require('./mongoClient.js');

console.log('🔄 ProfileDB module đã được tải vào hệ thống');

// Cache để theo dõi những user đã được tạo profile
const userProfileCache = new Set();

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
const getProfileCollection = async () => {
  const db = mongoClient.getDb();
  // Bỏ thông báo debug để tránh spam console
  return db.collection('user_profiles');
};

// Helper function to create a new profile with default values
const createDefaultProfile = (userId) => {

  if (!userProfileCache.has(userId)) {
    console.log(`🆕 Tạo profile mới cho người dùng: ${userId}`);
    userProfileCache.add(userId);
  }
  
  return {
    _id: userId,
    ...profileStructure
  };
};

// Helper function to get profile or create if not exists
const getProfile = async (userId) => {
  const collection = await getProfileCollection();
  let profile = await collection.findOne({ _id: userId });
  
  if (!profile) {
    profile = createDefaultProfile(userId);
    await collection.insertOne(profile);
  } else {
    // Nếu đã tìm thấy, thêm vào cache để tránh in thông báo tạo mới sau này
    userProfileCache.add(userId);
  }
  
  return profile;
};

module.exports = {
  profileStructure,
  getProfileCollection,
  createDefaultProfile,
  getProfile
};
