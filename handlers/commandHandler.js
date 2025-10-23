const fs = require('fs');
const path = require('path');
const { MessageFlags } = require('discord.js');
const logger = require('../utils/logger.js');

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
            logger.warn('COMMAND', `Lệnh "${commandName}" đã tồn tại và sẽ bị ghi đè bởi ${itemPath}`);
          }

          // Thêm lệnh vào collection
          client.commands.set(commandName, command);
          commandsJson.push(command.data.toJSON());

          // Hiển thị thông tin về thư mục chứa lệnh
          const category = path.relative(path.join(__dirname, '../commands'), dir).split(path.sep)[0] || 'root';
          // logger.debug('COMMAND', `Đã tải lệnh "${commandName}" từ danh mục "${category}"`); // Tắt hiển thị thông tin chi tiết (log quá nhiều)
        } else {
          logger.warn('COMMAND', `Lệnh tại ${itemPath} thiếu thuộc tính "data" hoặc "execute" bắt buộc.`);
        }
      } catch (error) {
        logger.error('COMMAND', `Không thể tải lệnh từ ${itemPath}:`, error);
      }
    }
  }
};

// Tải tất cả các tệp lệnh
const loadCommands = (client) => {
  const commandsPath = path.join(__dirname, '../commands');
  const commandsJson = [];

  client.commands.clear();

  loadCommandsFromDirectory(client, commandsPath, commandsJson);

  commandsJsonCache = commandsJson;

  logger.info('COMMAND', `Đã tải tổng cộng ${client.commands.size} lệnh.`);
  
  const commandNames = Array.from(client.commands.keys()).join(', ');
  logger.info('COMMAND', `Danh sách commands đã load: ${commandNames}`);

  return client.commands.size;
};

const getCommandsJson = (client) => {
  if (!commandsJsonCache) {
    loadCommands(client);
  }
  return commandsJsonCache;
};

const handleCommand = async (interaction, client) => {
  logger.info('COMMAND', `Nhận được interaction: ${interaction.commandName} từ ${interaction.user.tag}`);
  
  if (!client.commands.size) {
    logger.info('COMMAND', 'Commands chưa được load, đang load lại...');
    loadCommands(client);
  }

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    logger.error('COMMAND', `Không tìm thấy lệnh nào khớp với ${interaction.commandName}.`);
    logger.error('COMMAND', `Commands có sẵn: ${Array.from(client.commands.keys()).join(', ')}`);
    return;
  }
  
  logger.info('COMMAND', `Đã tìm thấy command: ${interaction.commandName}, đang thực thi...`);

  try {
    await command.execute(interaction);
    logger.info('COMMAND', `Người dùng ${interaction.user.tag} đã sử dụng lệnh /${interaction.commandName}`);
  } catch (error) {
    logger.error('COMMAND', `Lỗi khi thực thi lệnh ${interaction.commandName}:`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'Đã xảy ra lỗi khi thực thi lệnh này!', flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: 'Đã xảy ra lỗi khi thực thi lệnh này!', flags: MessageFlags.Ephemeral });
    }
  }
};

module.exports = {
  loadCommands,
  handleCommand,
  getCommandsJson
};
