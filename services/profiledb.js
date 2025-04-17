const { MongoClient, ObjectId } = require('mongodb');
const mongoClient = require('./mongoClient.js');



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
      inventory: []
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
  return db.collection('user_profiles');
};

// Helper function to create a new profile with default values
const createDefaultProfile = (userId) => {
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
