require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, Collection } = require('discord.js');
const { handleMessage } = require('./handlers/messageHandler');
const { handleCommand, loadCommands } = require('./handlers/commandHandler');
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

// Khi client sẵn sàng, chạy code này
client.once(Events.ClientReady, async () => {
  console.log(`Đăng nhập với tên ${client.user.tag} (Luna)`);
  console.log('Bot đang trực tuyến và sẵn sàng giúp đỡ!');
  
  // Tải các lệnh khi khởi động
  const commandCount = loadCommands(client);
  console.log(`Bot đã sẵn sàng với ${commandCount} lệnh!`);
  
  // Kiểm tra kết nối với X.AI API
  console.log('Đang kiểm tra kết nối với X.AI API...');
  const connected = await grokClient.testConnection();
});

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
