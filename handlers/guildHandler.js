const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoClient = require('../services/mongoClient.js');

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
      prefix: '!', // Prefix mặc định nếu sử dụng
      settings: {
        welcomeChannel: null,
        moderationEnabled: true,
        autoRoles: []
      }
    };
    
    // Upsert guild vào cơ sở dữ liệu (thêm mới hoặc cập nhật nếu đã tồn tại)
    await db.collection('guilds').updateOne(
      { guildId: guild.id }, 
      { $set: guildData },
      { upsert: true }
    );
    
    console.log(`\x1b[32m%s\x1b[0m`, `Đã lưu thông tin server ${guild.name} vào MongoDB`);
  } catch (error) {
    console.error(`\x1b[31m%s\x1b[0m`, `Lỗi khi lưu thông tin guild vào MongoDB:`, error);
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
    console.log(`\x1b[33m%s\x1b[0m`, `Đã xóa thông tin server ID: ${guildId} khỏi MongoDB`);
  } catch (error) {
    console.error(`\x1b[31m%s\x1b[0m`, `Lỗi khi xóa guild từ MongoDB:`, error);
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
    console.error(`\x1b[31m%s\x1b[0m`, `Lỗi khi lấy thông tin guild từ MongoDB:`, error);
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
    
    console.log(`\x1b[32m%s\x1b[0m`, `Đã cập nhật cài đặt cho server ID: ${guildId}`);
    return true;
  } catch (error) {
    console.error(`\x1b[31m%s\x1b[0m`, `Lỗi khi cập nhật cài đặt guild:`, error);
    return false;
  }
}

/**
 * Xử lý sự kiện khi bot tham gia một guild mới
 * @param {Discord.Guild} guild - Guild mới mà bot vừa tham gia
 */
async function handleGuildJoin(guild, commands) {
  console.log(`\x1b[32m%s\x1b[0m`, `Bot đã được thêm vào server mới: ${guild.name} (id: ${guild.id})`);
  console.log(`\x1b[33m%s\x1b[0m`, `Server hiện có ${guild.memberCount} thành viên`);
  
  try {
    // Lưu thông tin guild vào MongoDB
    await storeGuildInDB(guild);
    
    // Triển khai slash commands cho guild mới
    await deployCommandsToGuild(guild.id, commands);
    console.log(`\x1b[32m%s\x1b[0m`, `Đã triển khai các lệnh slash cho server: ${guild.name}`);
    
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
    console.error(`\x1b[31m%s\x1b[0m`, `Lỗi khi xử lý guild mới:`, error);
  }
}

/**
 * Xử lý sự kiện khi bot rời khỏi một guild
 * @param {Discord.Guild} guild - Guild mà bot vừa rời khỏi
 */
function handleGuildLeave(guild) {
  console.log(`\x1b[33m%s\x1b[0m`, `Bot đã rời khỏi server: ${guild.name} (id: ${guild.id})`);
  
  // Xóa thông tin guild khỏi MongoDB
  removeGuildFromDB(guild.id);
}

/**
 * Triển khai slash commands cho một guild cụ thể
 * @param {string} guildId - ID của guild cần triển khai lệnh
 * @param {Array} commands - Mảng các lệnh cần triển khai (tùy chọn)
 */
async function deployCommandsToGuild(guildId, existingCommands = null) {
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
    
    // Nếu không có lệnh được cung cấp, tải lại từ thư mục commands
    let commands = existingCommands;
    if (!commands) {
      commands = [];
      const commandsPath = path.join(__dirname, '..', 'commands');
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
      
      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
        }
      }
    }
    
    // Triển khai lệnh đến guild cụ thể
    console.log(`\x1b[36m%s\x1b[0m`, `Bắt đầu triển khai ${commands.length} lệnh đến guild ID: ${guildId}`);
    console.log(`\x1b[36m%s\x1b[0m`, `Sử dụng CLIENT_ID: ${clientId}`);
    
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    
    console.log(`\x1b[32m%s\x1b[0m`, `Đã triển khai thành công ${data.length} lệnh đến guild ID: ${guildId}`);
    return data;
  } catch (error) {
    console.error(`\x1b[31m%s\x1b[0m`, 'Lỗi khi triển khai lệnh đến guild:', error);
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
  // Sự kiện khi bot tham gia guild mới/initSystem.js');
  client.on('guildCreate', guild => handleGuildJoin(guild, commands));
  nction setupGuildHandlers(client, commands) {
  // Sự kiện khi bot rời khỏi guildy initialized before setting up guild handlers
  client.on('guildDelete', guild => handleGuildLeave(guild));
    // Ensure MongoDB is ready to use
  // Tải tất cả guild hiện tại vào MongoDB khi khởi động
  client.once('ready', async () => {
    try {t.on(Events.GuildCreate, async guild => {
      console.log('\x1b[36m%s\x1b[0m', 'Đang đồng bộ thông tin servers với MongoDB...');
        console.log(`Bot đã tham gia guild mới: ${guild.name}`);
      // Lấy tất cả guild mà bot hiện đang tham gia
      const guilds = client.guilds.cache;n
      let syncCount = 0; mongoClient.getDbSafe();
        
      // Duyệt qua từng guild và lưu thông tin vào MongoDB
      for (const guild of guilds.values()) {One(
        await storeGuildInDB(guild);
        syncCount++;
      }     $set: { 
              guildId: guild.id, 
      console.log('\x1b[32m%s\x1b[0m', `Đã đồng bộ thành công ${syncCount}/${guilds.size} servers với MongoDB`);
    } catch (error) {count: guild.memberCount,
      console.error('\x1b[31m%s\x1b[0m', 'Lỗi khi đồng bộ servers với MongoDB:', error);
    }         lastUpdated: new Date()
  });       } 
          },
  console.log('\x1b[36m%s\x1b[0m', 'Đã thiết lập xử lý sự kiện guild với MongoDB');
});
        
// Export các hàm để sử dụng trong các file khácild.name} vào cơ sở dữ liệu`);
module.exports = {
  handleGuildJoin,itional guild setup here...
  handleGuildLeave,r) {
  deployCommandsToGuild,ỗi khi xử lý guild mới:', error);
  setupGuildHandlers,
  getGuildFromDB,
  updateGuildSettings,
  storeGuildInDB guild-related event handlers here...
};};
  
  // If system is ready, set up immediately; otherwise wait
  if (initSystem.getStatus().initialized) {
    setupHandlers();
  } else {
    initSystem.once('ready', setupHandlers);
  }
}

module.exports = { setupGuildHandlers };


// Export các hàm để sử dụng trong các file khác
module.exports = {
  handleGuildJoin,
  handleGuildLeave,
  deployCommandsToGuild,
  setupGuildHandlers,
  getGuildFromDB,
  updateGuildSettings,
  storeGuildInDB
};
