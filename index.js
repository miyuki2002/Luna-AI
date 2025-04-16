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

// Tải các lệnh
const commandCount = loadCommands(client);
console.log(`Đang tải ${commandCount} lệnh vào bộ nhớ...`);

// Sử dụng handler cho sự kiện ready
startbot(client, () => commandCount);

// Chuẩn bị mảng commands JSON để deploy
const commandsJson = [];
for (const [name, command] of client.commands) {
  if ('data' in command && 'execute' in command) {
    commandsJson.push(command.data.toJSON());
  }
}

// Thiết lập xử lý sự kiện guild (tự động deploy khi bot tham gia guild mới)
setupGuildHandlers(client, commandsJson);

// Xử lý tin nhắn
client.on(Events.MessageCreate, async message => {
  // Bỏ qua tin nhắn từ bot
  if (message.author.bot) return;
  
  // Kiểm tra xem bot có được nhắc đến không
  if (message.mentions.has(client.user)) {
    await handleMessage(message);
  }
});

// Xử lý lệnh slash
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  await handleCommand(interaction, client);
});

// Đăng nhập vào Discord bằng token của ứng dụng
client.login(process.env.DISCORD_TOKEN);
