require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
// Lấy tất cả các tệp lệnh
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(`[CẢNH BÁO] Lệnh tại ${filePath} thiếu thuộc tính "data" bắt buộc.`);
  }
}

// Xây dựng và chuẩn bị một thể hiện của REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Triển khai lệnh
(async () => {
  try {
    console.log(`Bắt đầu cập nhật ${commands.length} lệnh ứng dụng (/)`);

    // Phương thức put được sử dụng để làm mới hoàn toàn tất cả các lệnh trong tất cả các guild với bộ hiện tại
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log(`Đã cập nhật thành công ${data.length} lệnh ứng dụng (/)`);
  } catch (error) {
    console.error(error);
  }
})();
