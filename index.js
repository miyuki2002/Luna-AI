require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, Collection } = require('discord.js');
const { handleMessage } = require('./handlers/messageHandler');
const { handleCommand, loadCommands, getCommandsJson } = require('./handlers/commandHandler');
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
    GatewayIntentBits.GuildMembers,       // Thêm intent này để đọc thông tin thành viên
    GatewayIntentBits.GuildMessageReactions, // Thêm intent này để đọc phản ứng tin nhắn
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction] // Thêm partials để xử lý tin nhắn cũ
});

// Khởi tạo các bộ sưu tập cơ bản
client.commands = new Collection();
client.features = ['EXPERIENCE_POINTS']; // Kích hoạt tính năng XP
client.logs = []; // Mảng để lưu các log

// Sử dụng handler cho sự kiện ready - mọi khởi tạo sẽ diễn ra ở đây
startbot(client, () => loadCommands(client));

// Thiết lập xử lý sự kiện guild (tự động deploy khi bot tham gia guild mới)
// Sử dụng getCommandsJson để lấy commands từ cache
setupGuildHandlers(client);

// Đăng ký sự kiện tin nhắn cho chức năng trò chuyện khi được tag
client.on(Events.MessageCreate, async message => {
  // Bỏ qua tin nhắn từ bot
  if (message.author.bot) return;

  // Chỉ xử lý tin nhắn khi bot được tag trực tiếp và không phải là cảnh báo từ chức năng giám sát
  if (message.mentions.has(client.user)) {
    // Kiểm tra xem tin nhắn có mention @everyone hoặc @role không
    const hasEveryoneOrRoleMention = message.mentions.everyone || message.mentions.roles.size > 0;

    // Kiểm tra xem tin nhắn có phải là cảnh báo từ chức năng giám sát không
    const isMonitorWarning = message.content.includes('**CẢNH BÁO') ||
                            message.content.includes('**Lưu ý') ||
                            message.content.includes('**CẢNH BÁO NGHÊM TRỌNG');

    // Nếu không phải cảnh báo từ chức năng giám sát và không có mention @everyone hoặc @role, xử lý như tin nhắn trò chuyện bình thường
    if (!isMonitorWarning && !hasEveryoneOrRoleMention) {
      // Ghi log để debug
      logger.info('CHAT', `Xử lý tin nhắn trò chuyện từ ${message.author.tag}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`);

      try {
        // Gọi handler cho chức năng trò chuyện
        await handleMessage(message);
        logger.info('CHAT', `Đã xử lý tin nhắn trò chuyện thành công`);
      } catch (error) {
        logger.error('CHAT', `Lỗi khi xử lý tin nhắn trò chuyện:`, error);
      }
    } else if (hasEveryoneOrRoleMention) {
      // Ghi log khi bỏ qua tin nhắn có mention @everyone hoặc @role
      logger.debug('CHAT', `Bỏ qua tin nhắn có mention @everyone hoặc @role từ ${message.author.tag}`);
    }
  }

  // Lưu ý: Chức năng monitor được xử lý hoàn toàn riêng biệt trong messageMonitor.js
  // và được khởi tạo trong events/ready.js
  // messageMonitor sẽ đọc tất cả tin nhắn KHÔNG tag bot (tin nhắn tag bot được xử lý ở trên)
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
