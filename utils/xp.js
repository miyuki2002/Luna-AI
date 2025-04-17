const { Collection } = require('discord.js');
const ProfileDB = require('../services/profiledb');
const GuildProfileDB = require('../services/guildprofiledb');

/**
 * Xử lý điểm kinh nghiệm cho người dùng dựa trên hoạt động nhắn tin của họ
 * @param {Object} message - Đối tượng tin nhắn từ Discord.js
 * @param {Boolean} command_executed - Cho biết lệnh có được thực thi trong tin nhắn không
 * @param {Boolean} execute - Cho biết hàm có nên tiếp tục thực thi không
 * @returns {Promise<Object>} - Kết quả của hoạt động XP
 */
async function experience(message, command_executed, execute) {
  // Không thêm xp nếu XP bị vô hiệu hóa
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
    // Lấy cooldowns từ client hoặc tạo mới nếu chưa có
    if (!message.client.xpCooldowns) {
      message.client.xpCooldowns = new Collection();
    }
    
    // Kiểm tra xem người dùng đã nói chuyện gần đây chưa (đang trong cooldown)
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
    
    // Kiểm tra xem kênh có bị loại trừ không
    if (guildProfile.xp?.exceptions?.includes(message.channel.id)) {
      return Promise.resolve({ xpAdded: false, reason: 'DISABLED_ON_CHANNEL' });
    }
    
    // Định nghĩa lượng xp tối đa và tối thiểu
    const max = 25;
    const min = 10;
    const points = Math.floor(Math.random() * (max - min)) + min;

    // Lấy bộ sưu tập hồ sơ từ MongoDB
    const profileCollection = await ProfileDB.getProfileCollection();
    
    // Tìm hồ sơ người dùng hoặc tạo mới nếu không tồn tại
    let doc = await profileCollection.findOne({ _id: message.author.id });
    
    if (!doc) {
      // Tạo hồ sơ mới cho người dùng này
      const defaultProfile = ProfileDB.createDefaultProfile(message.author.id);
      await profileCollection.insertOne(defaultProfile);
      doc = defaultProfile;
    }

    /*=======================TÍNH TOÁN XP============================*/
    // Đảm bảo data.xp tồn tại
    if (!doc.data.xp) {
      doc.data.xp = [];
    }
    
    // Lấy dữ liệu máy chủ
    const serverIndex = doc.data.xp.findIndex(x => x.id === message.guild.id);
    let serverData;
    const previousLevel = serverIndex !== -1 ? doc.data.xp[serverIndex].level : 0;
    
    // Thêm dữ liệu máy chủ vào hồ sơ nếu chưa tồn tại
    if (serverIndex === -1) {
      serverData = {
        id: message.guild.id,
        xp: 0,
        level: 1
      };
      doc.data.xp.push(serverData);
    } else {
      serverData = doc.data.xp[serverIndex];
    }

    // Định nghĩa giới hạn xp và ngưỡng cấp độ tiếp theo
    const getGlobalCap = () => (50 * Math.pow(doc.data.global_level, 2)) + (250 * doc.data.global_level);
    const getGlobalNext = () => getGlobalCap() - doc.data.global_xp;
    const getLocalCap = () => (50 * Math.pow(serverData.level, 2)) + (250 * serverData.level);
    const getLocalNext = () => getLocalCap() - serverData.xp;

    // XỬ LÝ XP TOÀN CẦU
    // Thêm 3xp vào xp toàn cầu
    doc.data.global_xp = (doc.data.global_xp || 0) + 3;
    
    // Kiểm tra xem người dùng có nên lên cấp không
    while (getGlobalNext() < 1) {
      doc.data.global_level++;
    }

    // XỬ LÝ XP CỤC BỘ
    // Thêm điểm đã được ngẫu nhiên trước đó vào xp cụ thể cho máy chủ
    serverData.xp = serverData.xp + points;
    
    // Kiểm tra xem người dùng có nên lên cấp trên máy chủ này không
    while (getLocalNext() < 1) {
      serverData.level++;
    }

    // Nếu trích xuất serverData trực tiếp, cần cập nhật nó trong mảng
    if (serverIndex !== -1) {
      doc.data.xp[serverIndex] = serverData;
    }

    // Cập nhật tài liệu trong MongoDB
    await profileCollection.updateOne(
      { _id: message.author.id },
      { $set: { data: doc.data } }
    );

    // Thiết lập cooldown
    message.client.xpCooldowns.set(message.author.id, Date.now());
    setTimeout(() => {
      message.client.xpCooldowns.delete(message.author.id);
    }, 60000); // 60 giây cooldown

    return { 
      xpAdded: true, 
      reason: null, 
      points, 
      level: serverData.level,
      previousLevel,
      totalXp: serverData.xp 
    };
    
  } catch (error) {
    console.error('Lỗi XP:', error);
    return { xpAdded: false, reason: 'DB_ERROR', error: error.message };
  }
}

module.exports = experience;