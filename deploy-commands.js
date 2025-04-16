require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Validate that necessary environment variables are set
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token) {
  console.error('\x1b[31m%s\x1b[0m', 'Lỗi: DISCORD_TOKEN không được thiết lập trong biến môi trường');
  process.exit(1);
}

if (!clientId) {
  console.error('\x1b[31m%s\x1b[0m', 'Lỗi: CLIENT_ID không được thiết lập trong biến môi trường');
  console.error('\x1b[33m%s\x1b[0m', 'Hãy thêm CLIENT_ID vào file .env của bạn');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

// Validate commands directory exists
if (!fs.existsSync(commandsPath)) {
  console.error('\x1b[31m%s\x1b[0m', `Lỗi: Thư mục lệnh không tồn tại: ${commandsPath}`);
  process.exit(1);
}

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Load commands from files
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
    console.log(`\x1b[36m%s\x1b[0m`, `Đã tải lệnh: ${command.data.name}`);
  } else {
    console.log(`\x1b[33m%s\x1b[0m`, `⚠️ Lệnh tại ${filePath} thiếu thuộc tính 'data' hoặc 'execute'`);
  }
}

// Create REST instance
const rest = new REST({ version: '10' }).setToken(token);

// Deploy commands
(async () => {
  try {
    console.log(`\x1b[36m%s\x1b[0m`, `Bắt đầu đăng ký ${commands.length} lệnh với Discord API.`);
    console.log(`\x1b[36m%s\x1b[0m`, `Sử dụng CLIENT_ID: ${clientId}`);

    // Đăng ký lệnh toàn cầu
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands },
    );

    console.log(`\x1b[32m%s\x1b[0m`, `Đã đăng ký thành công ${data.length} lệnh toàn cầu.`);
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Lỗi khi đăng ký lệnh:');
    console.error(error);
  }
})();
