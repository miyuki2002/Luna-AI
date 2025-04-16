require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, Collection } = require('discord.js');
const { handleMessage } = require('./handlers/messageHandler');
const { handleCommand, loadCommands } = require('./handlers/commandHandler');
const { startbot } = require('./events/ready');
const { setupGuildHandlers } = require('./handlers/guildHandler');

// Tạo một Discord client mới
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel]
});

// Bộ sưu tập lệnh
client.commands = new Collection();

// Sử dụng handler cho sự kiện ready - mọi khởi tạo sẽ diễn ra ở đây
startbot(client, () => loadCommands(client));

// Chuẩn bị mảng commands JSON để deploy
const commandsJson = [];
for (const [name, command] of client.commands) {
  if ('data' in command && 'execute' in command) {
    commandsJson.push(command.data.toJSON());
  }
}

// Thiết lập xử lý sự kiện guild (tự động deploy khi bot tham gia guild mới)
setupGuildHandlers(client, commandsJson);

// Đăng ký sự kiện tin nhắn - sẽ được kích hoạt sau khi ready
client.on(Events.MessageCreate, async message => {
  // Bỏ qua tin nhắn từ bot
  if (message.author.bot) return;
  
  // Kiểm tra xem bot có được nhắc đến không
  if (message.mentions.has(client.user)) {
    await handleMessage(message);
  }
});

// Đăng ký sự kiện interaction - sẽ được kích hoạt sau khi ready
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  await handleCommand(interaction, client);
});

// Xử lý lỗi và thoát
process.on('unhandledRejection', (error) => {
  console.error('Lỗi không được xử lý:', error);
});

// Đăng nhập vào Discord bằng token của ứng dụng
client.login(process.env.DISCORD_TOKEN);
