const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * Xử lý sự kiện khi bot tham gia một guild mới
 * @param {Discord.Guild} guild - Guild mới mà bot vừa tham gia
 */
async function handleGuildJoin(guild, commands) {
  console.log(`\x1b[32m%s\x1b[0m`, `Bot đã được thêm vào server mới: ${guild.name} (id: ${guild.id})`);
  console.log(`\x1b[33m%s\x1b[0m`, `Server hiện có ${guild.memberCount} thành viên`);
  
  try {
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
  
  // Thực hiện các hoạt động dọn dẹp nếu cần thiết
  // Ví dụ: xóa dữ liệu liên quan đến guild này từ cơ sở dữ liệu
  console.log(`\x1b[36m%s\x1b[0m`, `Đã dọn dẹp dữ liệu cho server: ${guild.name}`);
}

/**
 * Triển khai slash commands cho một guild cụ thể
 * @param {string} guildId - ID của guild cần triển khai lệnh
 * @param {Array} commands - Mảng các lệnh cần triển khai (tùy chọn)
 */
async function deployCommandsToGuild(guildId, existingCommands = null) {
  try {
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      throw new Error('DISCORD_TOKEN không được thiết lập trong biến môi trường');
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
    
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
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
  // Sự kiện khi bot tham gia guild mới
  client.on('guildCreate', guild => handleGuildJoin(guild, commands));
  
  // Sự kiện khi bot rời khỏi guild
  client.on('guildDelete', guild => handleGuildLeave(guild));
  
  console.log('\x1b[36m%s\x1b[0m', 'Đã thiết lập xử lý sự kiện guild');
}

module.exports = {
  handleGuildJoin,
  handleGuildLeave,
  deployCommandsToGuild,
  setupGuildHandlers
};
