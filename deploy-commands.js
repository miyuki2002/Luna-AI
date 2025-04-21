require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { getCommandsJson, loadCommands } = require('./handlers/commandHandler.js');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

// Khởi tạo client tạm thời để tải lệnh
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Tải tất cả lệnh
console.log('Đang tải lệnh...');
loadCommands(client);

// Lấy danh sách lệnh dưới dạng JSON
const commands = getCommandsJson(client);

// Khởi tạo REST API client
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Hàm đăng ký lệnh
async function deployCommands() {
  try {
    console.log(`Bắt đầu đăng ký ${commands.length} lệnh slash...`);

    // Xác định xem đăng ký toàn cục hay cho một guild cụ thể
    let data;
    if (process.env.GUILD_ID) {
      // Đăng ký cho guild cụ thể (phát triển)
      data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log(`Đã đăng ký ${data.length} lệnh slash cho guild ${process.env.GUILD_ID}`);
    } else {
      // Đăng ký toàn cục (sản xuất)
      data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log(`Đã đăng ký ${data.length} lệnh slash toàn cục`);
    }

    console.log('Đăng ký lệnh slash thành công!');
  } catch (error) {
    console.error('Lỗi khi đăng ký lệnh slash:', error);
  }
}

// Thực thi đăng ký lệnh
deployCommands();
