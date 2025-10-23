const { REST, Routes } = require('discord.js');
const mongoClient = require('../services/mongoClient.js');
const initSystem = require('../services/initSystem.js');
const { getCommandsJson, loadCommands, reloadCommands } = require('./commandHandler');
const logger = require('../utils/logger.js');

/**
 * Lưu thông tin guild vào MongoDB
 * @param {Discord.Guild} guild - Guild cần lưu thông tin
 */
async function storeGuildInDB(guild) {
  try {
    const db = await mongoClient.getDbSafe();

    // Chuẩn bị dữ liệu guild để lưu trữ
    const guildData = {
      guildId: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      ownerID: guild.ownerId,
      icon: guild.iconURL(),
      joinedAt: new Date(),
      settings: {
        welcomeChannel: null,
        moderationEnabled: true,
        autoRoles: []
      },
      // Thêm cấu hình XP mặc định cho guild
      xp: {
        isActive: true,
        exceptions: []
      }
    };

    // Upsert guild vào cơ sở dữ liệu (thêm mới hoặc cập nhật nếu đã tồn tại)
    await db.collection('guilds').updateOne(
      { guildId: guild.id },
      { $set: guildData },
      { upsert: true }
    );

    // Lưu cấu hình XP vào client.guildProfiles để sử dụng ở memory
    if (guild.client && guild.client.guildProfiles) {
      guild.client.guildProfiles.set(guild.id, {
        xp: guildData.xp
      });
      logger.info('GUILD', `Đã lưu cấu hình XP cho guild ${guild.name} vào bộ nhớ`);
    }

    logger.info('GUILD', `Đã lưu thông tin server ${guild.name} vào MongoDB`);
  } catch (error) {
    logger.error('GUILD', `Lỗi khi lưu thông tin guild vào MongoDB:`, error);
  }
}

/**
 * Xóa thông tin guild khỏi MongoDB
 * @param {string} guildId - ID của guild cần xóa
 */
async function removeGuildFromDB(guildId) {
  try {
    const db = await mongoClient.getDbSafe();

    // Xóa thông tin guild từ cơ sở dữ liệu
    await db.collection('guilds').deleteOne({ guildId: guildId });
    logger.info('GUILD', `Đã xóa thông tin server ID: ${guildId} khỏi MongoDB`);
  } catch (error) {
    logger.error('GUILD', `Lỗi khi xóa guild từ MongoDB:`, error);
  }
}

/**
 * Lấy thông tin guild từ MongoDB
 * @param {string} guildId - ID của guild cần lấy thông tin
 */
async function getGuildFromDB(guildId) {
  try {
    const db = await mongoClient.getDbSafe();

    // Lấy thông tin guild từ cơ sở dữ liệu
    const guildData = await db.collection('guilds').findOne({ guildId: guildId });

    return guildData;
  } catch (error) {
    logger.error('GUILD', `Lỗi khi lấy thông tin guild từ MongoDB:`, error);
    return null;
  }
}

/**
 * Cập nhật cài đặt guild trong MongoDB
 * @param {string} guildId - ID của guild cần cập nhật
 * @param {Object} settings - Đối tượng chứa cài đặt cần cập nhật
 */
async function updateGuildSettings(guildId, settings) {
  try {
    const db = await mongoClient.getDbSafe();

    // Cập nhật cài đặt guild trong cơ sở dữ liệu
    await db.collection('guilds').updateOne(
      { guildId: guildId },
      { $set: { settings: settings } }
    );

    logger.info('GUILD', `Đã cập nhật cài đặt cho server ID: ${guildId}`);
    return true;
  } catch (error) {
    logger.error('GUILD', `Lỗi khi cập nhật cài đặt guild:`, error);
    return false;
  }
}

/**
 * Xử lý sự kiện khi bot tham gia một guild mới
 * @param {Discord.Guild} guild - Guild mới mà bot vừa tham gia
 */
async function handleGuildJoin(guild, commands) {
  logger.info('GUILD', `Bot đã được thêm vào server mới: ${guild.name} (id: ${guild.id})`);
  logger.info('GUILD', `Server hiện có ${guild.memberCount} thành viên`);

  try {
    // Lưu thông tin guild vào MongoDB
    await storeGuildInDB(guild);

    // Đảm bảo rằng commands không rỗng
    let commandsToRegister = commands;
    if (!commandsToRegister || !commandsToRegister.length) {
      // Nếu không có commands được truyền vào, lấy từ commandHandler
      commandsToRegister = getCommandsJson(guild.client);

      // Nếu vẫn không có lệnh, hiển thị cảnh báo
      if (!commandsToRegister || !commandsToRegister.length) {
        logger.warn('GUILD', `Không có lệnh nào được tải để triển khai cho server ${guild.name}!`);
        commandsToRegister = [];
      }
    }

    // Triển khai slash commands cho guild mới
    await deployCommandsToGuild(guild.id, commandsToRegister, guild.client);
    logger.info('GUILD', `Đã triển khai các lệnh slash cho server: ${guild.name}`);

    // Thông báo cho chủ sở hữu server hoặc kênh mặc định nếu có thể
    const defaultChannel = findDefaultChannel(guild);
    if (defaultChannel) {
      await defaultChannel.send({
        content: `👋 Xin chào! Luna đã sẵn sàng hỗ trợ server **${guild.name}**!\n` +
                 `🔍 Tất cả các lệnh slash đã được tự động cài đặt.\n` +
                 `💬 Bạn có thể chat với mình bằng cách @mention Luna hoặc sử dụng các lệnh slash.\n` +
                 `✨ Cảm ơn đã thêm mình vào server!`
      });
    }
  } catch (error) {
    logger.error('GUILD', `Lỗi khi xử lý guild mới:`, error);
  }
}

/**
 * Xử lý sự kiện khi bot rời khỏi một guild
 * @param {Discord.Guild} guild - Guild mà bot vừa rời khỏi
 */
function handleGuildLeave(guild) {
  logger.info('GUILD', `Bot đã rời khỏi server: ${guild.name} (id: ${guild.id})`);

  // Xóa thông tin guild khỏi MongoDB
  removeGuildFromDB(guild.id);
}

/**
 * Triển khai slash commands cho một guild cụ thể
 * @param {string} guildId - ID của guild cần triển khai lệnh
 * @param {Array} commands - Mảng các lệnh cần triển khai (tùy chọn)
 * @param {Discord.Client} client - Discord client (tùy chọn)
 */
async function deployCommandsToGuild(guildId, existingCommands = null, client = null) {
  try {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID;

    if (!token) {
      throw new Error('DISCORD_TOKEN không được thiết lập trong biến môi trường');
    }

    if (!clientId) {
      throw new Error('CLIENT_ID không được thiết lập trong biến môi trường');
    }

    // Tạo REST client
    const rest = new REST({ version: '10' }).setToken(token);

    // Sử dụng commands từ cache hoặc từ tham số
    let commands = existingCommands;
    if (!commands && client) {
      // Force reload commands để đảm bảo có commands mới nhất
      logger.info('GUILD', 'Đang reload commands để đảm bảo có commands mới nhất...');
      reloadCommands(client);
      commands = getCommandsJson(client);
      logger.info('GUILD', `Đã load ${commands ? commands.length : 0} commands cho guild ${guildId}`);
    }

    // Kiểm tra xem có lệnh nào để triển khai không
    if (!commands || commands.length === 0) {
      logger.warn('GUILD', `Không có lệnh nào để triển khai cho guild ID: ${guildId}`);
      return [];
    }

    // Triển khai lệnh đến guild cụ thể
    logger.info('GUILD', `Bắt đầu triển khai ${commands.length} lệnh đến guild ID: ${guildId}`);
    
    // Log danh sách commands để debug
    const commandNames = commands.map(cmd => cmd.name).join(', ');
    logger.info('GUILD', `Danh sách commands: ${commandNames}`);

    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    logger.info('GUILD', `Đã triển khai thành công ${data.length} lệnh đến guild ID: ${guildId}`);
    return data;
  } catch (error) {
    logger.error('GUILD', 'Lỗi khi triển khai lệnh đến guild:', error);
    throw error;
  }
}

/**
 * Tìm kênh mặc định để gửi tin nhắn chào mừng
 * @param {Discord.Guild} guild - Guild để tìm kênh mặc định
 * @returns {Discord.TextChannel|null} - Kênh văn bản mặc định hoặc null nếu không tìm thấy
 */
function findDefaultChannel(guild) {
  // Các phương pháp tìm kênh mặc định theo thứ tự ưu tiên

  // 1. Tìm kênh có tên 'general' hoặc 'chung'
  let channel = guild.channels.cache.find(
    channel => channel.type === 0 && // TextChannel
    (channel.name === 'general' || channel.name === 'chung') &&
    channel.permissionsFor(guild.members.me).has(['SendMessages', 'ViewChannel'])
  );

  if (channel) return channel;

  // 2. Tìm kênh mà bot có quyền gửi tin nhắn và hiển thị
  channel = guild.channels.cache.find(
    channel => channel.type === 0 && // TextChannel
    channel.permissionsFor(guild.members.me).has(['SendMessages', 'ViewChannel'])
  );

  return channel; // Có thể null nếu không tìm thấy kênh phù hợp
}

/**
 * Thiết lập xử lý sự kiện guild cho client
 * @param {Discord.Client} client - Discord client cần thiết lập
 * @param {Array} commands - Mảng các lệnh đã tải (tùy chọn)
 */
function setupGuildHandlers(client, commands = null) {
  const setupHandlers = async () => {
    try {
      // Đảm bảo MongoDB đã sẵn sàng
      await mongoClient.getDbSafe();

      // Tải lệnh nếu chưa được tải
      if (!commands && client.commands.size === 0) {
        logger.info('GUILD', 'Đang tải lệnh từ thư mục commands...');
        loadCommands(client);
      }

      // Sự kiện khi bot tham gia guild mới
      client.on('guildCreate', guild => handleGuildJoin(guild, commands));

      // Sự kiện khi bot rời khỏi guild
      client.on('guildDelete', guild => handleGuildLeave(guild));

      // Đồng bộ tất cả guild hiện tại vào MongoDB và triển khai lệnh
      logger.info('GUILD', 'Đang đồng bộ thông tin servers với MongoDB...');
      const guilds = client.guilds.cache;
      let syncCount = 0;
      let deployCount = 0;

      // Lấy danh sách lệnh từ commandHandler
      const commandsToRegister = commands || getCommandsJson(client);

      if (!commandsToRegister || commandsToRegister.length === 0) {
        logger.warn('GUILD', 'Không có lệnh nào được tải để triển khai!');
      } else {
        logger.info('GUILD', `Đã tải ${commandsToRegister.length} lệnh để triển khai cho các server`);
      }

      for (const guild of guilds.values()) {
        // Lưu thông tin guild vào MongoDB
        await storeGuildInDB(guild);
        syncCount++;

        // Triển khai lệnh cho guild
        if (commandsToRegister && commandsToRegister.length > 0) {
          try {
            await deployCommandsToGuild(guild.id, commandsToRegister, client);
            deployCount++;
          } catch (error) {
            logger.error('GUILD', `Lỗi khi triển khai lệnh cho server ${guild.name}:`, error);
          }
        }
      }

      logger.info('GUILD', `Đã đồng bộ thành công ${syncCount}/${guilds.size} servers với MongoDB`);

      if (commandsToRegister && commandsToRegister.length > 0) {
        logger.info('GUILD', `Đã triển khai lệnh thành công cho ${deployCount}/${guilds.size} servers`);
      }

    } catch (error) {
      logger.error('GUILD', 'Lỗi khi thiết lập xử lý sự kiện guild:', error);
    }
  };

  // Nếu hệ thống đã khởi tạo xong, thiết lập ngay lập tức; nếu không, đợi
  if (initSystem.getStatus().initialized) {
    setupHandlers();
  } else {
    initSystem.once('ready', setupHandlers);
  }

  logger.info('GUILD', 'Đã đăng ký handlers cho sự kiện guild');
}

/**
 * Force deploy commands cho tất cả guilds (dùng khi có commands mới)
 * @param {Discord.Client} client - Discord client
 */
async function forceDeployCommandsToAllGuilds(client) {
  try {
    logger.info('GUILD', 'Bắt đầu force deploy commands cho tất cả guilds...');
    
    // Clear cache và reload commands
    reloadCommands(client);
    const commands = getCommandsJson(client);
    
    if (!commands || commands.length === 0) {
      logger.warn('GUILD', 'Không có commands nào để deploy!');
      return;
    }
    
    logger.info('GUILD', `Đã load ${commands.length} commands, bắt đầu deploy...`);
    
    const guilds = client.guilds.cache;
    let successCount = 0;
    
    for (const guild of guilds.values()) {
      try {
        await deployCommandsToGuild(guild.id, commands, client);
        successCount++;
        logger.info('GUILD', `Đã deploy commands cho guild: ${guild.name}`);
      } catch (error) {
        logger.error('GUILD', `Lỗi khi deploy commands cho guild ${guild.name}:`, error);
      }
    }
    
    logger.info('GUILD', `Đã deploy commands thành công cho ${successCount}/${guilds.size} guilds`);
  } catch (error) {
    logger.error('GUILD', 'Lỗi khi force deploy commands:', error);
  }
}

// Export các hàm để sử dụng trong các file khác
module.exports = {
  handleGuildJoin,
  handleGuildLeave,
  deployCommandsToGuild,
  setupGuildHandlers,
  getGuildFromDB,
  updateGuildSettings,
  storeGuildInDB,
  forceDeployCommandsToAllGuilds
};
