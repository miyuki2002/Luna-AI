const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger.js');

let commandsJsonCache = null;

// Hàm để tải lệnh từ một thư mục
const loadCommandsFromDirectory = (client, dir, commandsJson) => {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      loadCommandsFromDirectory(client, itemPath, commandsJson);
    } else if (item.name.endsWith('.js')) {
      try {
        const command = require(itemPath);
        if ('data' in command && 'execute' in command) {
          const commandName = command.data.name;
          if (client.commands.has(commandName)) {
            logger.warn('COMMAND', `Lệnh "${commandName}" đã tồn tại và sẽ bị ghi đè bởi ${itemPath}`);
          }

          try {
            const jsonData = command.data.toJSON();
            if (!jsonData || typeof jsonData !== 'object') {
              logger.error('COMMAND', `Lệnh "${commandName}" có toJSON() không hợp lệ:`, jsonData);
              continue;
            }
            if (!jsonData.name || !jsonData.description) {
              logger.error('COMMAND', `Lệnh "${commandName}" thiếu name hoặc description:`, jsonData);
              continue;
            }
            client.commands.set(commandName, command);
            commandsJson.push(jsonData);
            // const category = path.relative(path.join(__dirname, '../commands'), dir).split(path.sep)[0] || 'root';
            // logger.info('COMMAND', `Đã tải lệnh "${commandName}" từ "${category}" - Description: "${jsonData.description}"`);
          } catch (jsonError) {
            logger.error('COMMAND', `Lỗi khi convert lệnh "${commandName}" sang JSON:`, jsonError);
            continue;
          }
        } else {
          logger.warn('COMMAND', `Lệnh tại ${itemPath} thiếu thuộc tính "data" hoặc "execute" bắt buộc.`);
        }
      } catch (error) {
        logger.error('COMMAND', `Không thể tải lệnh từ ${itemPath}:`, error);
      }
    }
  }
};

const loadCommands = (client) => {
  const commandsPath = path.join(__dirname, '../commands');
  const commandsJson = [];
  logger.info('COMMAND', 'BẮT ĐẦU TẢI LỆNH');
  client.commands.clear();
  loadCommandsFromDirectory(client, commandsPath, commandsJson);
  commandsJsonCache = commandsJson;
  logger.info('COMMAND', `ĐÃ TẢI TỔNG CỘNG ${client.commands.size} LỆNH`);
  if (commandsJson.length > 0) {
    // logger.info('COMMAND', `Danh sách lệnh đã tải: ${commandsJson.map(c => c.name).join(', ')}`);
  } else {
    logger.warn('COMMAND', 'KHÔNG CÓ LỆNH NÀO ĐƯỢC TẢI!');
  }
  return client.commands.size;
};

const getCommandsJson = (client) => {
  if (!commandsJsonCache) {
    // logger.info('COMMAND', 'Cache rỗng, đang tải lại commands...');
    loadCommands(client);
  }
  // logger.debug('COMMAND', `Đang trả về ${commandsJsonCache?.length || 0} lệnh từ cache`);
  return commandsJsonCache;
};

const handleCommand = async (interaction, client) => {
  if (!client.commands.size) {
    logger.warn('COMMAND', 'Commands chưa được tải, đang tải lại...');
    loadCommands(client);
  }
  const command = client.commands.get(interaction.commandName);
  if (!command) {
    logger.error('COMMAND', `Không tìm thấy lệnh nào khớp với ${interaction.commandName}.`);
    return;
  }
  try {
    await command.execute(interaction);
    logger.info('COMMAND', `Người dùng ${interaction.user.tag} đã sử dụng lệnh /${interaction.commandName}`);
  } catch (error) {
    logger.error('COMMAND', `Lỗi khi thực thi lệnh ${interaction.commandName}:`, error);
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
