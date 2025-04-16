const grokClient = require('../services/grokClient');

function handleReady(client, loadCommands) {
  client.once('ready', async () => {
    console.log('\x1b[36m%s\x1b[0m', `
    ██╗     ██╗   ██╗███╗   ██╗ █████╗ 
    ██║     ██║   ██║████╗  ██║██╔══██╗
    ██║     ██║   ██║██╔██╗ ██║███████║
    ██║     ██║   ██║██║╚██╗██║██╔══██║
    ███████╗╚██████╔╝██║ ╚████║██║  ██║
    ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝
    `);

    // Tải các lệnh khi khởi động
    const commandCount = loadCommands(client);
    console.log('\x1b[32m%s\x1b[0m', `Đã tải tổng cộng ${commandCount} lệnh!`);
    
    // Kiểm tra kết nối với X.AI API
    const connected = await grokClient.testConnection();
    
    // Set bot presence
    client.user.setPresence({ 
      activities: [{ name: 'Helping users | @Luna', type: 4 }],
      status: 'online'
    });
  });
}

module.exports = { handleReady };
