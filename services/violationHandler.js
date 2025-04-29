const { EmbedBuilder } = require('discord.js');
const mongoClient = require('./mongoClient.js');
const modUtils = require('../utils/modUtils.js');
const logger = require('../utils/logger.js');

/**
 * Xử lý vi phạm từ hệ thống giám sát
 * @param {Discord.Message} message - Tin nhắn vi phạm
 * @param {Object} results - Kết quả phân tích
 * @returns {Promise<void>}
 */
async function handleViolation(message, results) {
  try {
    const db = mongoClient.getDb();
    const settings = await db.collection('monitor_settings').findOne({ guildId: message.guild.id });
    if (!settings || !settings.enabled) return;

    let actionToTake = 'warn'; // Mặc định là cảnh báo

    // Xác định hành động dựa trên quy tắc vi phạm hoặc mức độ nghiêm trọng
    if (settings.ruleActions && settings.ruleActions[results.violatedRule]) {
      actionToTake = settings.ruleActions[results.violatedRule];
    }
    else if (results.severity) {
      if (results.severity === 'Cao') {
        actionToTake = 'mute';
      } else if (results.severity === 'Rất cao') {
        actionToTake = 'kick';
      } else if (results.severity === 'Nghiêm trọng') {
        actionToTake = 'ban';
      }
    }

    // Nâng cao mức xử phạt nếu phát hiện tài khoản giả mạo
    if (results.isFakeAccount) {
      if (actionToTake === 'warn') actionToTake = 'mute';
      else if (actionToTake === 'mute') actionToTake = 'kick';
    }

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

    // Tìm kênh log phù hợp
    let logChannel = null;

    const logSettings = await db.collection('mod_settings').findOne({ guildId: message.guild.id });

    if (logSettings && logSettings.logChannelId) {
      try {
        logChannel = await message.guild.channels.fetch(logSettings.logChannelId);
      } catch (error) {
        logger.error('MONITOR', `Không thể tìm thấy kênh log ${logSettings.logChannelId}:`, error);
      }
    }

    // Tìm kênh log mặc định nếu không có kênh được cài đặt
    if (!logChannel) {
      logChannel = message.guild.channels.cache.find(
        channel => channel.name.includes('mod-logs') ||
                  channel.name.includes('mod-chat') ||
                  channel.name.includes('admin') ||
                  channel.name.includes('bot-logs')
      );
    }

    if (logChannel && logChannel.isTextBased()) {
      await logChannel.send({ embeds: [violationEmbed] });
    }

    // Tạo tin nhắn cảnh báo trực tiếp cho người vi phạm
    let warningMessage = `<@${message.author.id}> `;

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

    try {
      await message.channel.send(warningMessage);
    } catch (error) {
      logger.error('MONITOR', 'Không thể gửi cảnh báo trực tiếp:', error);
    }

    try {
      // Xóa tin nhắn vi phạm nếu có hành động nghiêm trọng
      if (actionToTake !== 'warn') {
        try {
          await message.delete();
          logger.info('MONITOR', `Đã xóa tin nhắn vi phạm từ ${message.author.tag}`);
        } catch (error) {
          logger.error('MONITOR', 'Không thể xóa tin nhắn:', error);
        }
      }

      // Thực hiện hành động trên người vi phạm
      if (actionToTake === 'mute') {
        const muteDuration = 10 * 60 * 1000; // 10 phút
        await message.member.timeout(muteDuration, `Vi phạm quy tắc: ${results.violatedRule}`);
        logger.info('MONITOR', `Đã mute ${message.author.tag} trong 10 phút vì vi phạm quy tắc`);

        // Lưu hành động vào log hệ thống
        await modUtils.logModAction({
          guildId: message.guild.id,
          targetId: message.author.id,
          moderatorId: message.client.user.id,
          action: 'mute',
          reason: `Vi phạm quy tắc: ${results.violatedRule}`,
          duration: 10
        });
      } else if (actionToTake === 'kick') {
        await message.member.kick(`Vi phạm quy tắc: ${results.violatedRule}`);
        logger.info('MONITOR', `Đã kick ${message.author.tag} vì vi phạm quy tắc`);

        await modUtils.logModAction({
          guildId: message.guild.id,
          targetId: message.author.id,
          moderatorId: message.client.user.id,
          action: 'kick',
          reason: `Vi phạm quy tắc: ${results.violatedRule}`
        });
      } else if (actionToTake === 'ban') {
        await message.member.ban({
          reason: `Vi phạm quy tắc: ${results.violatedRule}`,
          deleteMessageSeconds: 86400 // Xóa tin nhắn trong 24 giờ
        });
        logger.info('MONITOR', `Đã ban ${message.author.tag} vì vi phạm quy tắc`);

        await modUtils.logModAction({
          guildId: message.guild.id,
          targetId: message.author.id,
          moderatorId: message.client.user.id,
          action: 'ban',
          reason: `Vi phạm quy tắc: ${results.violatedRule}`
        });
      } else {
        await modUtils.logModAction({
          guildId: message.guild.id,
          targetId: message.author.id,
          moderatorId: message.client.user.id,
          action: 'warn',
          reason: `Vi phạm quy tắc: ${results.violatedRule}`
        });
      }
    } catch (error) {
      logger.error('MONITOR', `Lỗi khi thực hiện hành động ${actionToTake}:`, error);
    }
  } catch (error) {
    logger.error('MONITOR', 'Lỗi khi xử lý vi phạm:', error);
  }
}

module.exports = { handleViolation };
