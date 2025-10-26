const { SlashCommandBuilder } = require('@discordjs/builders');
const { handleProfileCommand } = require('../../utils/profileCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Hiển thị XP hiện tại, cấp độ, xếp hạng và các thông tin khác của người dùng')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('Người dùng mà bạn muốn xem hồ sơ')
        .setRequired(false)),
    
  async execute(interaction) {
    await interaction.reply({
      content: '🚧 **Lệnh profile tạm thời bị vô hiệu hóa!**\n\nTính năng profile và achievements đang được bảo trì. XP vẫn được tính bình thường! 💖',
      ephemeral: true
    });
  }
};
