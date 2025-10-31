const { REST, Routes } = require('discord.js');
const mongoClient = require('../services/mongoClient.js');
const initSystem = require('../services/initSystem.js');
const { getCommandsJson, loadCommands } = require('./commandHandler');
const logger = require('../utils/logger.js');

/**
 * Lưu thông tin guild vào MongoDB
 * @param {Discord.Guild} guild - Guild cần lưu thông tin
 */
async function storeGuildInDB(guild) {
  try {
    const db = await mongoClient.getDbSafe();

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
      xp: {
        isActive: true,
        exceptions: []
      }
    };

    await db.collection('guilds').updateOne(
      { guildId: guild.id },
      { $set: guildData },
      { upsert: true }
    );

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
 * Tìm kênh mặc định để gửi thông báo chào
 * @param {Discord.Guild} guild - Guild cần tìm kênh
 * @returns {Discord.TextChannel|null} - Kênh phù hợp hoặc null
 */
function findDefaultChannel(guild) {
  try {
    const generalChannel = guild.channels.cache.find(
      channel => 
        channel.type === 0 && 
        channel.permissionsFor(guild.members.me).has('SendMessages') &&
        (channel.name.toLowerCase().includes('general') || 
         channel.name.toLowerCase().includes('chung') ||
         channel.name.toLowerCase().includes('welcome'))
    );

    if (generalChannel) {
      return generalChannel;
    }
    const defaultChannel = guild.channels.cache.find(
      channel => 
        channel.type === 0 && 
        channel.permissionsFor(guild.members.me).has('SendMessages')
    );

    return defaultChannel || null;
  } catch (error) {
    logger.error('GUILD', `Lỗi khi tìm kênh mặc định cho guild ${guild.name}:`, error);
    return null;
  }
}

/**
 * Xử lý sự kiện khi bot rời khỏi một guild
 * @param {Discord.Guild} guild - Guild mà bot vừa rời khỏi
 */
async function handleGuildLeave(guild) {
  logger.info('GUILD', `Bot đã rời khỏi server: ${guild.name} (id: ${guild.id})`);
  try {
    await removeGuildFromDB(guild.id);
    logger.info('GUILD', `Đã xóa thông tin server ${guild.name} khỏi database`);
  } catch (error) {
    logger.error('GUILD', `Lỗi khi xóa thông tin server ${guild.name}:`, error);
  }
}

async function deployCommandsToGuild(guildId, existingCommands = null, client = null) {
 try {
   const token = process.env.DISCORD_TOKEN;
   const clientId = process.env.CLIENT_ID;
    logger.debug('GUILD', `Checking env variables - CLIENT_ID: ${clientId ? 'OK' : 'MISSING'}, TOKEN: ${token ? 'OK' : 'MISSING'}`);
    if (!token) {
      throw new Error('DISCORD_TOKEN không được thiết lập trong biến môi trường');
    }
    if (!clientId) {
      throw new Error('CLIENT_ID không được thiết lập trong biến môi trường');
    }
    const rest = new REST({ version: '10' }).setToken(token);
    const commands = existingCommands || (client ? getCommandsJson(client) : []);
    logger.info('GUILD', `CHUẨN BỊ DEPLOY LỆNH CHO GUILD ${guildId}`);
    if (!commands || commands.length === 0) {
      logger.warn('GUILD', `Không có lệnh nào để triển khai cho guild ID: ${guildId}`);
      return [];
    }
    logger.info('GUILD', `Số lượng lệnh chuẩn bị deploy: ${commands.length}`);
    logger.info('GUILD', `Danh sách lệnh: ${commands.map(c => c.name).join(', ')}`);
    if (process.env.NODE_ENV === 'development') {
      logger.debug('GUILD', 'Chi tiết các lệnh sẽ deploy:');
      commands.forEach((cmd, index) => {
        logger.debug('GUILD', `  ${index + 1}. ${cmd.name}: ${JSON.stringify(cmd, null, 2)}`);
      });
    }
    logger.info('GUILD', `Đang gửi request deploy tới Discord API...`);
    
    const startTime = Date.now();
    
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    
    const duration = Date.now() - startTime;

    logger.info('GUILD', `DEPLOY THÀNH CÔNG cho guild ${guildId} trong ${duration}ms`);
    logger.info('GUILD', `Discord đã xác nhận ${data.length} lệnh được đăng ký`);
    
    if (data.length !== commands.length) {
      logger.warn('GUILD', `Số lệnh deploy (${commands.length}) khác với số lệnh Discord xác nhận (${data.length})`);
    }
    
    logger.info('GUILD', `Lệnh đã được Discord xác nhận: ${data.map(c => c.name).join(', ')}`);
    
    return data;
    
  } catch (error) {
    logger.error('GUILD', `LỖI KHI DEPLOY LỆNH CHO GUILD ${guildId}:`);
    logger.error('GUILD', `Error Type: ${error.constructor.name}`);
    logger.error('GUILD', `Error Message: ${error.message}`);
    
    if (error.code) {
      logger.error('GUILD', `Discord Error Code: ${error.code}`);
    }
    
    if (error.status) {
      logger.error('GUILD', `HTTP Status: ${error.status}`);
    }
    
    if (error.rawError) {
      logger.error('GUILD', `Raw Error:`, JSON.stringify(error.rawError, null, 2));
    }
    
    logger.error('GUILD', `Stack Trace:`, error.stack);
    
    throw error;
  }
}

/**
* Xử lý sự kiện khi bot tham gia một guild mới
* @param {Discord.Guild} guild - Guild mới mà bot vừa tham gia
*/
async function handleGuildJoin(guild, commands) {
  logger.info('GUILD', `BOT THAM GIA GUILD MỚI`);
  logger.info('GUILD', `Guild Name: ${guild.name}`);
  logger.info('GUILD', `Guild ID: ${guild.id}`);
  logger.info('GUILD', `Member Count: ${guild.memberCount}`);
  logger.info('GUILD', `Owner ID: ${guild.ownerId}`);
  try {
    logger.info('GUILD', `Đang lưu thông tin guild vào MongoDB...`);
    await storeGuildInDB(guild);
    logger.info('GUILD', `Đã lưu thông tin guild vào MongoDB`);
    let commandsToRegister = commands;
    if (!commandsToRegister || !commandsToRegister.length) {
      logger.warn('GUILD', `Commands param rỗng, đang lấy từ commandHandler...`);
      commandsToRegister = getCommandsJson(guild.client);
      if (!commandsToRegister || !commandsToRegister.length) {
        logger.error('GUILD', `KHÔNG CÓ LỆNH NÀO ĐỂ TRIỂN KHAI cho server ${guild.name}!`);
        commandsToRegister = [];
        return;
      }
    }
    logger.info('GUILD', `Đang triển khai ${commandsToRegister.length} lệnh cho guild ${guild.name}...`);
    await deployCommandsToGuild(guild.id, commandsToRegister, guild.client);
    logger.info('GUILD', `Đã triển khai các lệnh slash cho server: ${guild.name}`);

    const defaultChannel = findDefaultChannel(guild);
    if (defaultChannel) {
      logger.info('GUILD', `Đang gửi thông báo chào tới kênh: ${defaultChannel.name}`);
      await defaultChannel.send({
        content: `Xin chào! Luna đã sẵn sàng hỗ trợ server **${guild.name}**!\n` +
                 `Bạn có thể chat với mình bằng cách @mention Luna hoặc sử dụng các lệnh slash.\n` +
                 `Cảm ơn đã thêm mình vào server!`
      });
      logger.info('GUILD', `Đã gửi thông báo chào`);
    } else {
      logger.warn('GUILD', `Không tìm thấy kênh phù hợp để gửi thông báo chào`);
    }
  } catch (error) {
    logger.error('GUILD', `LỖI KHI XỬ LÝ GUILD MỚI ${guild.name}:`, error);
  }
}

/**
 * Thiết lập xử lý sự kiện guild cho client
 * @deprecated Sử dụng setupGuildEvents từ events/guildEvents.js và syncAllGuilds thay thế
 * @param {Discord.Client} client - Discord client cần thiết lập
 * @param {Array} commands - Mảng các lệnh đã tải (tùy chọn)
 */
async function setupGuildHandlers(client, commands = null) {
  logger.warn('GUILD', 'setupGuildHandlers is deprecated. Use setupGuildEvents and syncAllGuilds instead.');
  
  // Event handlers are now registered in events/guildEvents.js
  // This function only syncs existing guilds
  await syncAllGuilds(client, commands);
}

/**
 * Đồng bộ tất cả guilds hiện tại và deploy commands
 * @param {Discord.Client} client - Discord client
 * @param {Array} commands - Mảng các lệnh đã tải (tùy chọn)
 */
async function syncAllGuilds(client, commands = null) {
  logger.info('GUILD', 'ĐỒNG BỘ VÀ DEPLOY CHO TẤT CẢ GUILDS');

  try {
    logger.info('GUILD', 'Đang chờ MongoDB sẵn sàng...');
    await mongoClient.getDbSafe();
    logger.info('GUILD', 'MongoDB đã sẵn sàng');

    if (!commands && (!client.commands || client.commands.size === 0)) {
      logger.info('GUILD', 'Đang tải lệnh từ thư mục commands...');
      loadCommands(client);
    }

    const guilds = client.guilds.cache;
    logger.info('GUILD', `Tổng số guild: ${guilds.size}`);
    
    if (guilds.size === 0) {
      logger.warn('GUILD', 'KHÔNG CÓ GUILD NÀO! Bot chưa được thêm vào server nào.');
      return;
    }
    
    let syncCount = 0;
    let deployCount = 0;
    let deployErrors = 0;

    const commandsToRegister = commands || getCommandsJson(client);

    if (!commandsToRegister || commandsToRegister.length === 0) {
      logger.error('GUILD', 'KHÔNG CÓ LỆNH NÀO ĐỂ TRIỂN KHAI!');
      logger.error('GUILD', 'Kiểm tra lại thư mục commands và file lệnh');
      return;
    } else {
      logger.info('GUILD', `Đã tải ${commandsToRegister.length} lệnh để triển khai`);
      logger.info('GUILD', `Danh sách: ${commandsToRegister.map(c => c.name).join(', ')}`);
    }

    for (const guild of guilds.values()) {
      logger.info('GUILD', `Processing guild: ${guild.name} (${guild.id})`);
      
      try {
        await storeGuildInDB(guild);
        syncCount++;
        logger.info('GUILD', `[${syncCount}/${guilds.size}] Synced: ${guild.name}`);
      } catch (error) {
        logger.error('GUILD', `Lỗi sync guild ${guild.name}:`, error);
      }

      try {
        await deployCommandsToGuild(guild.id, commandsToRegister, client);
        deployCount++;
        logger.info('GUILD', `[${deployCount}/${guilds.size}] Deployed commands: ${guild.name}`);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        deployErrors++;
        logger.error('GUILD', `[${deployErrors} errors] Lỗi deploy cho guild ${guild.name}:`, error.message);
      }
    }

    logger.info('GUILD', 'KẾT QUẢ ĐỒNG BỘ');
    logger.info('GUILD', `MongoDB Sync: ${syncCount}/${guilds.size} guilds`);
    logger.info('GUILD', `Commands Deploy: ${deployCount}/${guilds.size} guilds`);
    
    if (deployErrors > 0) {
      logger.warn('GUILD', `Có ${deployErrors} guilds deploy thất bại`);
    } else {
      logger.info('GUILD', `TẤT CẢ GUILDS DEPLOY THÀNH CÔNG!`);
    }

  } catch (error) {
    logger.error('GUILD', 'LỖI NGHIÊM TRỌNG KHI ĐỒNG BỘ GUILDS:', error);
    throw error;
  }
}

module.exports = {
  handleGuildJoin,
  handleGuildLeave,
  deployCommandsToGuild,
  setupGuildHandlers,
  syncAllGuilds,
  getGuildFromDB,
  updateGuildSettings,
  storeGuildInDB
};
