require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, Collection } = require('discord.js');
// Import the new handler function
const { handleMentionMessage } = require('./handlers/messageHandler');
const { handleCommand, loadCommands } = require('./handlers/commandHandler'); // Removed getCommandsJson as it's not used directly here
const { startbot } = require('./events/ready');
const { setupGuildHandlers } = require('./handlers/guildHandler');
const logger = require('./utils/logger.js');

// Tạo một Discord client mới
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,       
    GatewayIntentBits.GuildMessageReactions, 
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction] // Thêm partials để xử lý tin nhắn cũ
});

client.commands = new Collection();
client.features = ['EXPERIENCE_POINTS']; // Kích hoạt tính năng XP
client.logs = []; // Mảng để lưu các log

// Sử dụng handler cho sự kiện ready - mọi khởi tạo sẽ diễn ra ở đây
startbot(client, () => loadCommands(client));

// Thiết lập xử lý sự kiện guild (tự động deploy khi bot tham gia guild mới)
setupGuildHandlers(client);

// Đăng ký sự kiện tin nhắn - sử dụng handler mới
client.on(Events.MessageCreate, async message => {
  // Delegate the entire mention handling logic to the handler
  await handleMentionMessage(message, client);
});

// Đăng ký sự kiện interaction - sẽ được kích hoạt sau khi ready
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  await handleCommand(interaction, client);
});

// Xử lý lỗi và thoát
process.on('unhandledRejection', (error) => {
  logger.error('SYSTEM', 'Lỗi không được xử lý:', error);
});

// Đăng nhập vào Discord bằng token của ứng dụng
client.login(process.env.DISCORD_TOKEN);
