const { Collection, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const ProfileDB = require('../services/profiledb');
const GuildProfileDB = require('../services/guildprofiledb');
const { checkAchievements } = require('../services/canvas/achievements');

/**
 * Xử lý điểm kinh nghiệm cho người dùng dựa trên hoạt động nhắn tin của họ
 * @param {Object} message - Đối tượng tin nhắn từ Discord.js
 * @param {Boolean} command_executed - Cho biết lệnh có được thực thi trong tin nhắn không
 * @param {Boolean} execute - Cho biết hàm có nên tiếp tục thực thi không
 * @returns {Promise<Object>} - Kết quả của hoạt động XP
 */
async function experience(message, command_executed, execute) {
  // Không thêm xp nếu tính năng bị vô hiệu hóa
  if (!message.client.features?.includes('EXPERIENCE_POINTS')) {
    return Promise.resolve({ xpAdded: false, reason: 'DISABLED' });
  }

  // Không thêm xp nếu lệnh đã được thực thi
  if (command_executed) {
    return Promise.resolve({ xpAdded: false, reason: 'COMMAND_EXECUTED' });
  }

  // Không thêm xp nếu lệnh bị chấm dứt
  if (!execute) {
    return Promise.resolve({ xpAdded: false, reason: 'COMMAND_TERMINATED' });
  }

  // Không thêm xp khi tin nhắn đến từ DMs
  if (message.channel.type === 'dm') {
    return Promise.resolve({ xpAdded: false, reason: 'DM_CHANNEL' });
  }

  try {
    // Khởi tạo collection cooldown nếu chưa có
    if (!message.client.xpCooldowns) {
      message.client.xpCooldowns = new Collection();
    }
    
    // Kiểm tra xem người dùng đã nói chuyện gần đây chưa
    const userCooldown = message.client.xpCooldowns.get(message.author.id);
    if (userCooldown) {
      return Promise.resolve({ xpAdded: false, reason: 'RECENTLY_TALKED' });
    }

    // Lấy cấu hình guild từ database
    const guildProfile = await GuildProfileDB.getGuildProfile(message.guild.id);
    
    // Kiểm tra xem XP có được bật trong guild không
    if (!guildProfile.xp?.isActive) {
      return Promise.resolve({ xpAdded: false, reason: 'DISABLED_ON_GUILD' });
    }
    
    // Kiểm tra xem kênh có bị chặn XP không
    if (guildProfile.xp?.exceptions?.includes(message.channel.id)) {
      return Promise.resolve({ xpAdded: false, reason: 'DISABLED_ON_CHANNEL' });
    }
    
    // Số điểm ngẫu nhiên từ 10-25
    const max = 25;
    const min = 10;
    const points = Math.floor(Math.random() * (max - min)) + min;

    // Lấy profile người dùng từ DB hoặc cache
    let doc = await ProfileDB.getProfile(message.author.id);

    // Xử lý dữ liệu XP
    if (!doc.data.xp) {
      doc.data.xp = [];
    }
    
    // Tìm dữ liệu XP của server hiện tại
    const serverIndex = doc.data.xp.findIndex(x => x.id === message.guild.id);
    let serverData;
    const previousLevel = serverIndex !== -1 ? doc.data.xp[serverIndex].level : 0;
    
    // Kiểm tra lần đầu nhận XP trong server
    const isFirstXP = serverIndex === -1;
    
    // Khởi tạo dữ liệu server nếu chưa có
    if (isFirstXP) {
      serverData = {
        id: message.guild.id,
        xp: 0,
        level: 1
      };
      doc.data.xp.push(serverData);
    } else {
      serverData = doc.data.xp[serverIndex];
    }

    // Các công thức tính XP và ngưỡng lên cấp
    const getGlobalCap = () => (50 * Math.pow(doc.data.global_level, 2)) + (250 * doc.data.global_level);
    const getGlobalNext = () => getGlobalCap() - doc.data.global_xp;
    const getLocalCap = () => (50 * Math.pow(serverData.level, 2)) + (250 * serverData.level);
    const getLocalNext = () => getLocalCap() - serverData.xp;

    // Tăng XP toàn cầu
    doc.data.global_xp = (doc.data.global_xp || 0) + 3;
    
    // Kiểm tra và tăng cấp global nếu đủ điều kiện
    while (getGlobalNext() < 1) {
      doc.data.global_level++;
    }

    // Tăng XP server
    serverData.xp = serverData.xp + points;
    
    // Kiểm tra và tăng cấp server nếu đủ điều kiện
    while (getLocalNext() < 1) {
      serverData.level++;
    }

    // Cập nhật lại dữ liệu server trong mảng
    if (serverIndex !== -1) {
      doc.data.xp[serverIndex] = serverData;
    }

    // Lưu vào database
    const profileCollection = await ProfileDB.getProfileCollection();
    await profileCollection.updateOne(
      { _id: message.author.id },
      { $set: { data: doc.data } }
    );

    // Thiết lập cooldown 1 phút
    message.client.xpCooldowns.set(message.author.id, Date.now());
    setTimeout(() => {
      message.client.xpCooldowns.delete(message.author.id);
    }, 60000);
    
    // Kết quả
    const xpResult = { 
      xpAdded: true, 
      reason: null, 
      points, 
      level: serverData.level,
      previousLevel,
      totalXp: serverData.xp,
      isFirstXP: isFirstXP
    };
    
    // Kiểm tra thành tựu không đồng bộ
    if (xpResult.xpAdded) {
      setTimeout(() => {
        checkAchievements(message, xpResult).catch(err => {
          console.error('Lỗi khi kiểm tra thành tựu:', err);
        });
      }, 100);
    }

    return xpResult;
    
  } catch (error) {
    console.error('Lỗi XP:', error);
    return { xpAdded: false, reason: 'DB_ERROR', error: error.message };
  }
}

module.exports = experience;