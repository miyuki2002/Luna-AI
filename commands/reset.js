const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Đặt lại cuộc trò chuyện với bot'),
  
  async execute(interaction) {
    // Tại đây bạn sẽ đặt lại trạng thái cuộc trò chuyện cho người dùng
    // Đây chỉ là một triển khai giả định
    await interaction.reply({ content: 'Cuộc trò chuyện đã được đặt lại!', ephemeral: true });
  },
};
