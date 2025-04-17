const { AttachmentBuilder } = require('discord.js');
const storageDB = require('../services/storagedb');

/**
 * Xử lý lệnh hiển thị profile
 * @param {Object} interaction - Tương tác Discord
 */
async function handleProfileCommand(interaction) {
  try {
    // Defer reply để có thời gian tạo hình ảnh
    await interaction.deferReply();
    
    // Lấy thông tin người dùng từ tương tác
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;
    
    // Tạo hình ảnh profile card
    const cardBuffer = await storageDB.generateProfileCard(userId);
    
    // Tạo attachment từ buffer
    const attachment = new AttachmentBuilder(cardBuffer, { name: 'profile.png' });
    
    // Phản hồi với hình ảnh
    await interaction.editReply({
      content: `Profile của ${targetUser.username}:`,
      files: [attachment]
    });
  } catch (error) {
    console.error('Lỗi khi xử lý lệnh profile:', error);
    
    // Trả về thông báo lỗi
    if (interaction.deferred) {
      await interaction.editReply({ 
        content: 'Đã xảy ra lỗi khi tạo profile card. Vui lòng thử lại sau.' 
      });
    } else {
      await interaction.reply({ 
        content: 'Đã xảy ra lỗi khi tạo profile card. Vui lòng thử lại sau.',
        ephemeral: true 
      });
    }
  }
}

module.exports = { handleProfileCommand };
