const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ProfileDB = require('./profiledb');
const logger = require('../utils/logger.js');

class ConsentService {
  constructor() {
  }

  /**
   * Kiểm tra xem user đã đồng ý sử dụng dịch vụ chưa
   * @param {string} userId - ID của user
   * @returns {Promise<boolean>}
   */
  async hasUserConsented(userId) {
    try {
      const profile = await ProfileDB.getProfile(userId);
      if (!profile || !profile.data) {
        return false;
      }
      return profile.data.consent === true;
    } catch (error) {
      logger.error('CONSENT', `Lỗi khi kiểm tra consent cho user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Tạo embed consent cho user mới
   * @param {Object} user - Discord user object
   * @returns {Object} - Embed và components
   */
  createConsentEmbed(user) {
    const embed = new EmbedBuilder()
      .setTitle('🎉 Chào mừng bạn đến với Luna AI!')
      .setDescription(
        `Xin chào **${user.username}**! 👋\n\n` +
        `Mình là **Luna**, AI assistant thông minh và dễ thương! ✨\n\n` +
        `**Để sử dụng dịch vụ, bạn cần đồng ý với các điều khoản sau:**\n\n` +
        `📝 **Dữ liệu được thu thập:**\n` +
        `> - Tin nhắn trò chuyện (để cải thiện chất lượng phản hồi)\n` +
        `> - Thông tin cơ bản (username, ID)\n` +
        `> - Dữ liệu XP và level (để tính điểm kinh nghiệm)\n\n` +
        `🔒 **Cam kết bảo mật:**\n` +
        `> - Dữ liệu được mã hóa và bảo mật\n` +
        `> - Không chia sẻ với bên thứ ba\n` +
        `> - Có thể xóa dữ liệu bất cứ lúc nào\n\n` +
        `**Bạn có đồng ý sử dụng dịch vụ Luna AI không?** 💖`
      )
      .setColor(0x5865F2)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
      .setFooter({ 
        text: 'Luna AI • Developed by s4ory', 
        iconURL: 'https://raw.githubusercontent.com/miyuki2002/Luna-AI/refs/heads/main/assets/luna-avatar.png' 
      })
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('consent_accept')
          .setLabel('Chấp thuận')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('consent_decline')
          .setLabel('Từ chối')
          .setStyle(ButtonStyle.Danger)
      );

    return { embeds: [embed], components: [row] };
  }

  /**
   * Gửi embed consent với fallback khi thiếu quyền
   * @param {Object} interaction - Discord interaction object
   * @param {Object} user - Discord user object
   * @returns {Promise<boolean>} - true nếu gửi thành công, false nếu thiếu quyền
   */
  async sendConsentEmbed(interaction, user) {
    const embedData = this.createConsentEmbed(user);
    return await this.sendEmbedWithFallback(interaction, embedData, user.username, 'embedLinks');
  }

  /**
   * Xử lý khi user chấp thuận
   * @param {Object} interaction - Discord interaction
   * @param {string} userId - ID của user
   * @returns {Promise<void>}
   */
  async handleConsentAccept(interaction, userId) {
    try {
      await this.updateUserConsent(userId, true);

      const embed = new EmbedBuilder()
        .setTitle('🎉 Cảm ơn bạn đã tin tưởng Luna!')
        .setDescription(
          `**${interaction.user.username}** đã chấp thuận sử dụng dịch vụ của Luna AI!\n\n` +
          `## **Bây giờ bạn có thể:**\n` +
          `> - Trò chuyện với Luna bằng cách tag @Luna\n` +
          `> - Sử dụng các lệnh AI như \`/think\`, \`/image\`\n` +
          `> - Nhận XP và level up khi hoạt động\n` +
          `> - Tận hưởng trải nghiệm AI thông minh!\n\n` +
          `**Chúc bạn có những trải nghiệm tuyệt vời với Luna!**`
        )
        .setColor(0x00FF00)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .setTimestamp();

      const embedData = { embeds: [embed], components: [] };
      
      const success = await this.sendEmbedWithFallback(interaction, embedData, interaction.user.username, 'embedLinks');
      
      if (success) {
        logger.info('CONSENT', `User ${interaction.user.tag} (${userId}) đã chấp thuận sử dụng dịch vụ`);
      }

    } catch (error) {
      logger.error('CONSENT', `Lỗi khi xử lý consent accept cho user ${userId}:`, error);
      await this.handlePermissionError(interaction, 'sendMessages', interaction.user.username);
    }
  }

  /**
   * Xử lý khi user từ chối
   * @param {Object} interaction - Discord interaction
   * @param {string} userId - ID của user
   * @returns {Promise<void>}
   */
  async handleConsentDecline(interaction, userId) {
    try {
      const embed = new EmbedBuilder()
        .setTitle('😢 Luna hiểu và tôn trọng quyết định của bạn!')
        .setDescription(
          `**${interaction.user.username}** đã từ chối sử dụng dịch vụ Luna AI.\n\n` +
          `🔒 **Dữ liệu của bạn:**\n` +
          `> - Không được lưu trữ trong hệ thống\n` +
          `> - Hoàn toàn bảo mật và riêng tư\n\n` +
          `💖 **Luna vẫn sẵn sàng giúp đỡ bạn:**\n` +
          `> - Bạn có thể thay đổi quyết định bất cứ lúc nào\n` +
          `> - Chỉ cần tag @Luna hoặc sử dụng lệnh để bắt đầu lại\n\n` +
          `**Cảm ơn bạn đã dành thời gian!**`
        )
        .setColor(0xFF0000)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .setTimestamp();

      const embedData = { embeds: [embed], components: [] };
      
      const success = await this.sendEmbedWithFallback(interaction, embedData, interaction.user.username, 'embedLinks');
      
      if (success) {
        logger.info('CONSENT', `User ${interaction.user.tag} (${userId}) đã từ chối sử dụng dịch vụ`);
      }

    } catch (error) {
      logger.error('CONSENT', `Lỗi khi xử lý consent decline cho user ${userId}:`, error);
      await this.handlePermissionError(interaction, 'sendMessages', interaction.user.username);
    }
  }

  /**
   * Cập nhật consent của user trong database
   * @param {string} userId - ID của user
   * @param {boolean} consented - Trạng thái consent
   * @returns {Promise<void>}
   */
  async updateUserConsent(userId, consented) {
    try {
      const profileCollection = await ProfileDB.getProfileCollection();
      await profileCollection.updateOne(
        { _id: userId },
        { 
          $set: { 
            'data.consent': consented,
            'data.consentDate': new Date(),
            'data.consentVersion': '1.0'
          } 
        },
        { upsert: true }
      );
    } catch (error) {
      logger.error('CONSENT', `Lỗi khi cập nhật consent cho user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * @param {Object} interaction - Discord interaction object
   * @param {string} permission - Tên quyền bị thiếu (ví dụ: 'embedLinks', 'sendMessages')
   * @param {string} username - Tên user để hiển thị trong tin nhắn
   * @returns {Promise<void>}
   */
  async handlePermissionError(interaction, permission, username) {
    try {
      const errorMessage = `🚫 | ${username}, bot không có quyền \`${permission}\`! Vui lòng thêm quyền này cho bot hoặc liên hệ quản trị viên máy chủ để được hỗ trợ.`;
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: errorMessage,
          ephemeral: false
        });
      } else {
        await interaction.reply({
          content: errorMessage,
          ephemeral: false
        });
      }

      logger.warn('PERMISSION', `Bot thiếu quyền ${permission} trong guild ${interaction.guild?.id || 'DM'}`);
    } catch (error) {
      logger.error('PERMISSION', `Lỗi khi xử lý permission error:`, error);
    }
  }

  /**
   * Kiểm tra quyền của bot trong guild
   * @param {Object} interaction - Discord interaction object
   * @param {string} permission - Quyền cần kiểm tra
   * @returns {boolean} - true nếu có quyền, false nếu không
   */
  hasPermission(interaction, permission) {
    if (!interaction.guild) return true;
    
    const botMember = interaction.guild.members.me;
    if (!botMember) return false;
    
    return botMember.permissions.has(permission);
  }

  /**
   * Wrapper function để xử lý embed với fallback về text khi thiếu quyền
   * @param {Object} interaction - Discord interaction object
   * @param {Object} embedData - Dữ liệu embed cần gửi
   * @param {string} username - Tên user
   * @param {string} permission - Quyền cần kiểm tra (mặc định: 'embedLinks')
   * @returns {Promise<boolean>} - true nếu gửi thành công, false nếu thiếu quyền
   */
  async sendEmbedWithFallback(interaction, embedData, username, permission = 'embedLinks') {
    try {
      if (!this.hasPermission(interaction, permission)) {
        await this.handlePermissionError(interaction, permission, username);
        return false;
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(embedData);
      } else {
        await interaction.reply(embedData);
      }
      
      return true;
    } catch (error) {
      if (error.code === 50013 || error.message.includes('permission')) {
        await this.handlePermissionError(interaction, permission, username);
        return false;
      }
      
      throw error;
    }
  }

}

module.exports = new ConsentService();
