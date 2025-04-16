const fs = require('fs');
const path = require('path');

// Tải tất cả các tệp lệnh
const loadCommands = (client) => {
  const commandsPath = path.join(__dirname, '../commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // Đặt một mục mới trong Collection với key là tên lệnh và value là module được xuất
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(`[CẢNH BÁO] Lệnh tại ${filePath} thiếu thuộc tính "data" hoặc "execute" bắt buộc.`);
    }
  }
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
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'Đã xảy ra lỗi khi thực thi lệnh này!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Đã xảy ra lỗi khi thực thi lệnh này!', ephemeral: true });
    }
  }
};

module.exports = {
  loadCommands,
  handleCommand
};
