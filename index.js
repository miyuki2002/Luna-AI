require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { handleMessage } = require('./handlers/messageHandler');
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

// Khi client sẵn sàng, chạy code này
client.once(Events.ClientReady, async () => {
  console.log(`Đăng nhập với tên ${client.user.tag} (Luna)`);
  console.log('Bot đang trực tuyến và sẵn sàng giúp đỡ!');
  
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

// Đăng nhập vào Discord bằng token của ứng dụng
client.login(process.env.DISCORD_TOKEN);
