const fs = require('fs');
const path = require('path');

// Cache cho commands JSON
let commandsJsonCache = null;

// Hàm để tải lệnh từ một thư mục
const loadCommandsFromDirectory = (client, dir, commandsJson) => {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      // Nếu là thư mục, đệ quy tải lệnh từ thư mục con
      loadCommandsFromDirectory(client, itemPath, commandsJson);
    } else if (item.name.endsWith('.js')) {
      // Nếu là file .js, tải lệnh
      try {
        const command = require(itemPath);

        // Kiểm tra xem có các thuộc tính bắt buộc không
        if ('data' in command && 'execute' in command) {
          // Lấy tên lệnh từ data
          const commandName = command.data.name;

          // Kiểm tra xem lệnh đã tồn tại chưa
          if (client.commands.has(commandName)) {
            console.log(`[CẢNH BÁO] Lệnh "${commandName}" đã tồn tại và sẽ bị ghi đè bởi ${itemPath}`);
          }

          // Thêm lệnh vào collection
          client.commands.set(commandName, command);
          commandsJson.push(command.data.toJSON());

          // Hiển thị thông tin về thư mục chứa lệnh
          const category = path.relative(path.join(__dirname, '../commands'), dir).split(path.sep)[0] || 'root';
          // console.log(`[ĐÃ TẢI] Lệnh "${commandName}" từ danh mục "${category}"`); // Tắt hiển thị thông tin chi tiết (console log quá nhiều)
        } else {
          console.log(`[CẢNH BÁO] Lệnh tại ${itemPath} thiếu thuộc tính "data" hoặc "execute" bắt buộc.`);
        }
      } catch (error) {
        console.error(`[LỖI] Không thể tải lệnh từ ${itemPath}:`, error);
      }
    }
  }
};

// Tải tất cả các tệp lệnh
const loadCommands = (client) => {
  const commandsPath = path.join(__dirname, '../commands');
  const commandsJson = [];

  // Xóa tất cả lệnh hiện tại
  client.commands.clear();

  // Tải lệnh từ thư mục gốc và các thư mục con
  loadCommandsFromDirectory(client, commandsPath, commandsJson);

  // Lưu vào cache
  commandsJsonCache = commandsJson;

  // Hiển thị thông tin tổng quan
  console.log(`Đã tải tổng cộng ${client.commands.size} lệnh từ tất cả các danh mục.`);

  return client.commands.size;
};

// Lấy commands dưới dạng JSON từ cache hoặc tải mới
const getCommandsJson = (client) => {
  if (!commandsJsonCache) {
    loadCommands(client);
  }
  return commandsJsonCache;
};

// Xử lý việc thực thi lệnh
const handleCommand = async (interaction, client) => {
  if (!client.commands.size) {
    loadCommands(client);
  }

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`Không tìm thấy lệnh nào khớp với ${interaction.commandName}.`);
    return;
  }

  try {
    await command.execute(interaction);
    console.log(`Người dùng ${interaction.user.tag} đã sử dụng lệnh /${interaction.commandName}`);
  } catch (error) {
    console.error(`Lỗi khi thực thi lệnh ${interaction.commandName}:`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'Đã xảy ra lỗi khi thực thi lệnh này!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Đã xảy ra lỗi khi thực thi lệnh này!', ephemeral: true });
    }
  }
};

module.exports = {
  loadCommands,
  handleCommand,
  getCommandsJson
};
