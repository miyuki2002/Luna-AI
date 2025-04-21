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
    await handleProfileCommand(interaction);
  }
};
