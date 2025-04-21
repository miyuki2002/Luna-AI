const { EmbedBuilder } = require('discord.js');
const mongoClient = require('./mongoClient.js');
const modUtils = require('../utils/modUtils.js');

/**
 * Xử lý vi phạm từ hệ thống giám sát
 * @param {Discord.Message} message - Tin nhắn vi phạm
 * @param {Object} results - Kết quả phân tích
 * @returns {Promise<void>}
 */
async function handleViolation(message, results) {
  try {
    // Lấy cài đặt giám sát cho guild từ cơ sở dữ liệu
    const db = mongoClient.getDb();
    const settings = await db.collection('monitor_settings').findOne({ guildId: message.guild.id });
    if (!settings || !settings.enabled) return;
    
    // Xác định hành động cần thực hiện dựa trên quy tắc vi phạm và mức độ nghiêm trọng
    let actionToTake = 'warn'; // Mặc định là cảnh báo
    
    // Kiểm tra cài đặt hành động tự động cho quy tắc cụ thể
    if (settings.ruleActions && settings.ruleActions[results.violatedRule]) {
      actionToTake = settings.ruleActions[results.violatedRule];
    } 
    // Nếu không có cài đặt cụ thể cho quy tắc, sử dụng mức độ nghiêm trọng
    else if (results.severity) {
      if (results.severity === 'Cao') {
        actionToTake = 'mute';
      } else if (results.severity === 'Rất cao') {
        actionToTake = 'kick';
      } else if (results.severity === 'Nghiêm trọng') {
        actionToTake = 'ban';
      }
    }
    
    // Nếu phát hiện tài khoản giả mạo, nâng cấp hành động
    if (results.isFakeAccount) {
      if (actionToTake === 'warn') actionToTake = 'mute';
      else if (actionToTake === 'mute') actionToTake = 'kick';
    }
    
    // Tạo embed thông báo vi phạm cho kênh log
    const violationEmbed = new EmbedBuilder()
      .setColor(
        results.severity === 'Cao' || results.severity === 'Rất cao' || results.severity === 'Nghiêm trọng' ? 0xFF0000 :
        results.severity === 'Trung bình' ? 0xFFA500 : 0xFFFF00
      )
      .setTitle(`🚨 Phát hiện vi phạm ${results.isFakeAccount ? '(Có dấu hiệu tài khoản giả mạo)' : ''}`)
      .setDescription(`Bot đã phát hiện một tin nhắn vi phạm quy tắc server.`)
      .addFields(
        { name: 'Người dùng', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
        { name: 'Kênh', value: `<#${message.channel.id}>`, inline: true },
        { name: 'Thời gian', value: `<t:${Math.floor(message.createdTimestamp / 1000)}:F>`, inline: true },
        { name: 'Quy tắc vi phạm', value: results.violatedRule, inline: true },
        { name: 'Mức độ', value: results.severity, inline: true },
        { name: 'Hành động', value: actionToTake, inline: true },
        { name: 'Lý do', value: results.reason },
        { name: 'Nội dung tin nhắn', value: message.content.length > 1024 ? message.content.substring(0, 1021) + '...' : message.content }
      )
      .setTimestamp();
    
    // Tìm kênh log
    let logChannel = null;
    
    // Kiểm tra cài đặt kênh log từ cơ sở dữ liệu
    const logSettings = await db.collection('mod_settings').findOne({ guildId: message.guild.id });
    
    if (logSettings && logSettings.logChannelId) {
      try {
        logChannel = await message.guild.channels.fetch(logSettings.logChannelId);
      } catch (error) {
        console.error(`Không thể tìm thấy kênh log ${logSettings.logChannelId}:`, error);
      }
    }
    
    // Nếu không có kênh log được cài đặt, tìm kênh mặc định
    if (!logChannel) {
      logChannel = message.guild.channels.cache.find(
        channel => channel.name.includes('mod-logs') ||
                  channel.name.includes('mod-chat') ||
                  channel.name.includes('admin') ||
                  channel.name.includes('bot-logs')
      );
    }

    // Gửi thông báo đến kênh log
    if (logChannel && logChannel.isTextBased()) {
      await logChannel.send({ embeds: [violationEmbed] });
    }

    // Tạo tin nhắn cảnh báo trực tiếp cho người vi phạm
    let warningMessage = `<@${message.author.id}> `;

    // Tạo nội dung cảnh báo dựa trên hành động và mức độ nghiêm trọng
    const actionEmoji = {
      'warn': '⚠️',
      'mute': '🔇',
      'kick': '👢',
      'ban': '🚫'
    };

    if (actionToTake === 'mute') {
      warningMessage += `${actionEmoji.mute} **CẢNH BÁO NGHIÊM TRỌNG**: ${results.reason}. `;
      warningMessage += `Vi phạm quy tắc: ${results.violatedRule}. `;
      warningMessage += `Bạn đã bị tạm thời mute trong 10 phút.`;
    } else if (actionToTake === 'kick') {
      warningMessage += `${actionEmoji.kick} **CẢNH BÁO NGHIÊM TRỌNG**: ${results.reason}. `;
      warningMessage += `Vi phạm quy tắc: ${results.violatedRule}. `;
      warningMessage += `Bạn sẽ bị kick khỏi server.`;
    } else if (actionToTake === 'ban') {
      warningMessage += `${actionEmoji.ban} **CẢNH BÁO NGHIÊM TRỌNG**: ${results.reason}. `;
      warningMessage += `Vi phạm quy tắc: ${results.violatedRule}. `;
      warningMessage += `Bạn sẽ bị ban vĩnh viễn khỏi server.`;
    } else {
      warningMessage += `${actionEmoji.warn} **CẢNH BÁO**: ${results.reason}. `;
      warningMessage += `Vi phạm quy tắc: ${results.violatedRule}. `;
      warningMessage += `Vui lòng tuân thủ quy tắc của server.`;
    }

    // Gửi cảnh báo trực tiếp vào kênh
    try {
      await message.channel.send(warningMessage);
    } catch (error) {
      console.error('Không thể gửi cảnh báo trực tiếp:', error);
    }

    // Thực hiện hành động tự động dựa trên actionToTake
    try {
      // Luôn xóa tin nhắn vi phạm nếu hành động là mute, kick hoặc ban
      if (actionToTake !== 'warn') {
        try {
          await message.delete();
          console.log(`Đã xóa tin nhắn vi phạm từ ${message.author.tag}`);
        } catch (error) {
          console.error('Không thể xóa tin nhắn:', error);
        }
      }
      
      // Thực hiện hành động tương ứng
      if (actionToTake === 'mute') {
        // Mute người dùng (timeout)
        const muteDuration = 10 * 60 * 1000; // 10 phút
        await message.member.timeout(muteDuration, `Vi phạm quy tắc: ${results.violatedRule}`);
        console.log(`Đã mute ${message.author.tag} trong 10 phút vì vi phạm quy tắc`);
        
        // Lưu hành động vào cơ sở dữ liệu
        await modUtils.logModAction({
          guildId: message.guild.id,
          targetId: message.author.id,
          moderatorId: message.client.user.id,
          action: 'mute',
          reason: `Vi phạm quy tắc: ${results.violatedRule}`,
          duration: 10 // 10 phút
        });
      } else if (actionToTake === 'kick') {
        // Kick người dùng
        await message.member.kick(`Vi phạm quy tắc: ${results.violatedRule}`);
        console.log(`Đã kick ${message.author.tag} vì vi phạm quy tắc`);
        
        // Lưu hành động vào cơ sở dữ liệu
        await modUtils.logModAction({
          guildId: message.guild.id,
          targetId: message.author.id,
          moderatorId: message.client.user.id,
          action: 'kick',
          reason: `Vi phạm quy tắc: ${results.violatedRule}`
        });
      } else if (actionToTake === 'ban') {
        // Ban người dùng
        await message.member.ban({
          reason: `Vi phạm quy tắc: ${results.violatedRule}`,
          deleteMessageSeconds: 86400 // Xóa tin nhắn trong 24 giờ
        });
        console.log(`Đã ban ${message.author.tag} vì vi phạm quy tắc`);
        
        // Lưu hành động vào cơ sở dữ liệu
        await modUtils.logModAction({
          guildId: message.guild.id,
          targetId: message.author.id,
          moderatorId: message.client.user.id,
          action: 'ban',
          reason: `Vi phạm quy tắc: ${results.violatedRule}`
        });
      } else {
        // Cảnh báo
        await modUtils.logModAction({
          guildId: message.guild.id,
          targetId: message.author.id,
          moderatorId: message.client.user.id,
          action: 'warn',
          reason: `Vi phạm quy tắc: ${results.violatedRule}`
        });
      }
    } catch (error) {
      console.error(`Lỗi khi thực hiện hành động ${actionToTake}:`, error);
    }
  } catch (error) {
    console.error('Lỗi khi xử lý vi phạm:', error);
  }
}

module.exports = { handleViolation };
