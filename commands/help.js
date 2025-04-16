const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Hiển thị các lệnh có sẵn và cách sử dụng chúng'),
  
  async execute(interaction) {
    const helpEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Trợ giúp Lệnh Bot')
      .setDescription('Đây là các lệnh có sẵn:')
      .addFields(
        { name: '/reset', value: 'Đặt lại cuộc trò chuyện của bạn với bot' },
        { name: '/image', value: 'Tạo hình ảnh từ mô tả văn bản' },
        { name: '/help', value: 'Hiển thị tin nhắn trợ giúp này' }
      )
      .setFooter({ text: 'Bạn cũng có thể nhắc đến bot để bắt đầu cuộc trò chuyện' });
    
    await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  },
};
