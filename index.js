require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, Collection } = require('discord.js');
const { handleMessage, processXp } = require('./handlers/messageHandler');
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

// Khởi tạo các bộ sưu tập và tính năng
client.commands = new Collection();
client.features = ['EXPERIENCE_POINTS']; // Kích hoạt tính năng XP
client.guildProfiles = new Collection(); // Collection để lưu trữ cấu hình guild
client.collections = new CollectionManager(); // Quản lý các bộ sưu tập tạm thời
client.logs = []; // Mảng để lưu các log

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
  
  // Kiểm tra xem tin nhắn có phải từ kênh guild (không phải DM)
  if (message.guild) {
    // Xử lý cấp XP cho tất cả tin nhắn trong guild
    // Chỉ bỏ qua việc xử lý XP nếu đây là lệnh được xử lý (để xử lý riêng trong handleMessage)
    const isCommand = message.content.startsWith('/') || message.content.startsWith('!');
    await processXp(message, isCommand, !isCommand);
  }
  
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

// CollectionManager đơn giản để quản lý các bộ sưu tập
class CollectionManager {
  constructor() {
    this.collections = new Map();
  }

  getFrom(name, key) {
    if (!this.collections.has(name)) {
      return null;
    }
    return this.collections.get(name).get(key);
  }

  setTo(name, key, value) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Collection());
    }
    this.collections.get(name).set(key, value);
    return this.collections.get(name);
  }
}

// Đăng nhập vào Discord bằng token của ứng dụng
client.login(process.env.DISCORD_TOKEN);
