const { Collection, AttachmentBuilder } = require("discord.js");
const path = require("path");
const fs = require("fs");
const ProfileDB = require("../services/profiledb");
const GuildProfileDB = require("../services/guildprofiledb");
// const { checkAchievements } = require("../services/canvas/achievements");

/**
 * Xử lý điểm kinh nghiệm cho người dùng dựa trên hoạt động nhắn tin của họ
 * @param {Object} message - Đối tượng tin nhắn từ Discord.js
 * @param {Boolean} command_executed - Cho biết lệnh có được thực thi trong tin nhắn không
 * @param {Boolean} execute - Cho biết hàm có nên tiếp tục thực thi không
 * @returns {Promise<Object>} - Kết quả của hoạt động XP
 */
async function experience(message, command_executed, execute) {
  if (!message.client.features?.includes("EXPERIENCE_POINTS")) {
    return Promise.resolve({ xpAdded: false, reason: "DISABLED" });
  }

  if (command_executed) {
    return Promise.resolve({ xpAdded: false, reason: "COMMAND_EXECUTED" });
  }

  if (!execute) {
    return Promise.resolve({ xpAdded: false, reason: "COMMAND_TERMINATED" });
  }

  // Không thêm xp khi tin nhắn đến từ DMs
  if (!message.guild || message.channel.type === "dm") {
    return Promise.resolve({ xpAdded: false, reason: "DM_CHANNEL" });
  }

  try {
    if (!message.client.xpCooldowns) {
      message.client.xpCooldowns = new Collection();
    }

    const userCooldown = message.client.xpCooldowns.get(message.author.id);
    if (userCooldown) {
      return Promise.resolve({ xpAdded: false, reason: "RECENTLY_TALKED" });
    }

    const guildProfile = await GuildProfileDB.getGuildProfile(message.guild.id);

    if (!guildProfile.xp?.isActive) {
      return Promise.resolve({ xpAdded: false, reason: "DISABLED_ON_GUILD" });
    }

    if (guildProfile.xp?.exceptions?.includes(message.channel.id)) {
      return Promise.resolve({ xpAdded: false, reason: "DISABLED_ON_CHANNEL" });
    }

    const max = 25;
    const min = 10;
    const points = Math.floor(Math.random() * (max - min)) + min;

    let doc = await ProfileDB.getProfile(message.author.id);

    if (!doc.data.xp) {
      doc.data.xp = [];
    }

    const serverIndex = doc.data.xp.findIndex((x) => x.id === message.guild.id);
    let serverData;
    const previousLevel =
      serverIndex !== -1 ? doc.data.xp[serverIndex].level : 0;

    const isFirstXP = serverIndex === -1;

    if (isFirstXP) {
      serverData = {
        id: message.guild.id,
        xp: 0,
        level: 1,
      };
      doc.data.xp.push(serverData);
    } else {
      serverData = doc.data.xp[serverIndex];
    }

    const getGlobalCap = () =>
      50 * Math.pow(doc.data.global_level, 2) + 250 * doc.data.global_level;
    const getGlobalNext = () => getGlobalCap() - doc.data.global_xp;
    const getLocalCap = () =>
      50 * Math.pow(serverData.level, 2) + 250 * serverData.level;
    const getLocalNext = () => getLocalCap() - serverData.xp;

    doc.data.global_xp = (doc.data.global_xp || 0) + 3;

    while (getGlobalNext() < 1) {
      doc.data.global_level++;
    }

    serverData.xp = serverData.xp + points;

    while (getLocalNext() < 1) {
      serverData.level++;
    }

    if (serverIndex !== -1) {
      doc.data.xp[serverIndex] = serverData;
    }

    const profileCollection = await ProfileDB.getProfileCollection();
    await profileCollection.updateOne(
      { _id: message.author.id },
      { $set: { data: doc.data } }
    );

    message.client.xpCooldowns.set(message.author.id, Date.now());
    setTimeout(() => {
      message.client.xpCooldowns.delete(message.author.id);
    }, 60000);

    const xpResult = {
      xpAdded: true,
      reason: null,
      points,
      level: serverData.level,
      previousLevel,
      totalXp: serverData.xp,
      isFirstXP: isFirstXP,
    };

    // Kiểm tra thành tựu không đồng bộ
    // if (xpResult.xpAdded) {
    //   setTimeout(() => {
    //     checkAchievements(message, xpResult).catch((err) => {
    //       console.error("Lỗi khi kiểm tra thành tựu:", err);
    //     });
    //   }, 100);
    // }

    return xpResult;
  } catch (error) {
    console.error("Lỗi XP:", error);
    return { xpAdded: false, reason: "DB_ERROR", error: error.message };
  }
}

module.exports = experience;
