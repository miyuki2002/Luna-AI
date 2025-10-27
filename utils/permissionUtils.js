const logger = require('./logger.js');

/**
 * Xử lý lỗi khi bot thiếu quyền và trả về tin nhắn text thay vì embed
 * @param {Object} interaction - Discord interaction object hoặc message object
 * @param {string} permission - Tên quyền bị thiếu (ví dụ: 'embedLinks', 'sendMessages')
 * @param {string} username - Tên user để hiển thị trong tin nhắn
 * @param {string} action - Hành động đang thực hiện (reply, editReply, followUp)
 * @returns {Promise<void>}
 */
async function handlePermissionError(interaction, permission, username, action = 'reply') {
  try {
    const errorMessage = `🚫 | ${username}, bot không có quyền \`${permission}\`! Vui lòng thêm quyền này cho bot hoặc liên hệ quản trị viên máy chủ để được hỗ trợ.`;
    
    switch (action) {
      case 'reply':
        if (interaction.reply) {
          await interaction.reply(errorMessage);
        } else if (interaction.channel) {
          await interaction.channel.send(errorMessage);
        }
        break;
        
      case 'editReply':
        if (interaction.editReply) {
          await interaction.editReply(errorMessage);
        } else if (interaction.edit) {
          await interaction.edit(errorMessage);
        }
        break;
        
      case 'followUp':
        if (interaction.followUp) {
          await interaction.followUp({ content: errorMessage });
        } else if (interaction.channel) {
          await interaction.channel.send(errorMessage);
        }
        break;
        
      case 'update':
        if (interaction.update) {
          await interaction.update({ content: errorMessage });
        } else if (interaction.editReply) {
          await interaction.editReply(errorMessage);
        } else if (interaction.reply) {
          await interaction.reply(errorMessage);
        } else if (interaction.channel) {
          await interaction.channel.send(errorMessage);
        }
        break;
        
      default:
        if (interaction.reply) {
          await interaction.reply(errorMessage);
        } else if (interaction.channel) {
          await interaction.channel.send(errorMessage);
        }
    }

    logger.warn('PERMISSION', `Bot thiếu quyền ${permission} trong guild ${interaction.guild?.id || 'DM'}`);
  } catch (error) {
    logger.error('PERMISSION', `Lỗi khi xử lý permission error:`, error);
  }
}

/**
 * Wrapper function để gửi embed với fallback khi thiếu quyền
 * @param {Object} interaction - Discord interaction object hoặc message object
 * @param {Object} embedData - Dữ liệu embed cần gửi
 * @param {string} username - Tên user
 * @param {string} permission - Quyền cần kiểm tra (mặc định: 'embedLinks')
 * @param {string} action - Hành động đang thực hiện (reply, editReply, followUp)
 * @returns {Promise<boolean>} - true nếu gửi thành công, false nếu thiếu quyền
 */
async function sendEmbedWithFallback(interaction, embedData, username, permission = 'embedLinks', action = 'reply') {
  try {
    // Thử gửi embed
    switch (action) {
      case 'reply':
        if (interaction.reply) {
          await interaction.reply(embedData);
        } else if (interaction.channel) {
          await interaction.channel.send(embedData);
        }
        break;
        
      case 'editReply':
        if (interaction.editReply) {
          await interaction.editReply(embedData);
        } else if (interaction.edit) {
          await interaction.edit(embedData);
        }
        break;
        
      case 'followUp':
        if (interaction.followUp) {
          await interaction.followUp(embedData);
        } else if (interaction.channel) {
          await interaction.channel.send(embedData);
        }
        break;
        
      case 'update':
        if (interaction.update) {
          await interaction.update(embedData);
        } else if (interaction.editReply) {
          await interaction.editReply(embedData);
        } else if (interaction.reply) {
          await interaction.reply(embedData);
        } else if (interaction.channel) {
          await interaction.channel.send(embedData);
        }
        break;
        
      default:
        if (interaction.reply) {
          await interaction.reply(embedData);
        } else if (interaction.channel) {
          await interaction.channel.send(embedData);
        }
    }
    
    return true;
  } catch (error) {
    // Nếu lỗi do thiếu quyền, gửi tin nhắn text thay thế
    if (error.code === 50013 || error.message.includes('permission')) {
      await handlePermissionError(interaction, permission, username, action);
      return false;
    }
    
    // Nếu lỗi khác, throw lại
    throw error;
  }
}

/**
 * Kiểm tra quyền của bot trong guild
 * @param {Object} interaction - Discord interaction object hoặc message object
 * @param {string} permission - Quyền cần kiểm tra
 * @returns {boolean} - true nếu có quyền, false nếu không
 */
function hasPermission(interaction, permission) {
  if (!interaction.guild) return true; // DM không cần kiểm tra quyền
  
  const botMember = interaction.guild.members.me;
  if (!botMember) return false;
  
  return botMember.permissions.has(permission);
}

module.exports = {
  handlePermissionError,
  sendEmbedWithFallback,
  hasPermission
};
