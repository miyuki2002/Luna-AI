const { MongoClient, ObjectId } = require("mongodb");
const mongoClient = require("./mongoClient.js");
const logger = require("../utils/logger.js");

logger.info("SYSTEM", "ProfileDB module đã được tải vào hệ thống");

// Cache các userId đã tạo profile
const userProfileCache = new Set();

// Cấu trúc cơ bản của profile người dùng
const createProfileStructure = (userId) => ({
  _id: userId,
  data: {
    global_xp: 0,
    global_level: 1,
    profile: {
      bio: "No bio written.",
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
        website: null,
      },
      custom_status: null,
      badges: [],
      frame: null,
      effect: null,
    },
    economy: {
      bank: null,
      wallet: null,
      streak: {
        alltime: 0,
        current: 0,
        timestamp: 0,
      },
      shard: null,
    },
    reputation: {
      points: 0,
      givenBy: [],
      lastGiven: 0,
    },
    tips: {
      given: 0,
      received: 0,
      timestamp: 0,
    },
    xp: [],
    vote: {
      notification: true,
    },
  },
});

// Lấy collection profile từ database
const getProfileCollection = async () => {
  const db = mongoClient.getDb();
  return db.collection("user_profiles");
};

// Tạo profile mới với giá trị mặc định
const createDefaultProfile = (userId) => {
  if (!userProfileCache.has(userId)) {
    logger.info("SYSTEM", `Tạo profile mới cho người dùng: ${userId}`);
    userProfileCache.add(userId);
  }

  return createProfileStructure(userId);
};

// Lấy profile người dùng hoặc tạo mới nếu chưa tồn tại
const getProfile = async (userId) => {
  const collection = await getProfileCollection();
  let profile = await collection.findOne({ _id: userId });

  if (!profile) {
    profile = createDefaultProfile(userId);
    await collection.insertOne(profile);
  } else {
    userProfileCache.add(userId);
  }

  return profile;
};

module.exports = {
  createProfileStructure,
  getProfileCollection,
  createDefaultProfile,
  getProfile,
};
