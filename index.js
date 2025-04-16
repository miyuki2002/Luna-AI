require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, Collection } = require('discord.js');
const { handleMessage } = require('./handlers/messageHandler');
const { handleCommand, loadCommands } = require('./handlers/commandHandler');
const { handleReady } = require('./handlers/ready');
const { setupGuildHandlers } = require('./handlers/guildHandler');
const grokClient = require('./services/grokClient');

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
const commands = loadCommands(client);

// Sử dụng handler cho sự kiện ready
handleReady(client, () => commands);

// Thiết lập xử lý sự kiện guild (tự động deploy khi bot tham gia guild mới)
setupGuildHandlers(client, commands.map(cmd => cmd.data.toJSON()));

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
