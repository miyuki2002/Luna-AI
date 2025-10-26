const { EmbedBuilder } = require("discord.js");
const mongoClient = require("../services/mongoClient.js");
const logger = require("./logger.js");

/**
 * Gửi log moderation đến kênh log đã cấu hình
 * @param {Discord.Guild} guild - Guild nơi hành động diễn ra
 * @param {EmbedBuilder} embed - Embed chứa thông tin log
 * @param {boolean} isModAction - Có phải là hành động moderation không (mute/ban/kick)
 * @returns {Promise<Discord.Message|null>} - Tin nhắn đã gửi hoặc null nếu không thể gửi
 */
async function sendModLog(guild, embed, isModAction = true) {
  try {
    const db = mongoClient.getDb();

    const logSettings = await db.collection("mod_settings").findOne({
      guildId: guild.id,
    });

    let logChannel = null;

    if (logSettings && logSettings.logChannelId) {
      const shouldLog = isModAction
        ? logSettings.modActionLogs !== false
        : logSettings.monitorLogs !== false;

      if (shouldLog) {
        try {
          logChannel = await guild.channels.fetch(logSettings.logChannelId);
        } catch (error) {
          logger.error(
            "COMMAND",
            `Không thể tìm thấy kênh log ${logSettings.logChannelId}:`,
            error
          );
        }
      }
    }

    if (!logChannel) {
      logChannel = guild.channels.cache.find(
        (channel) =>
          channel.name.includes("mod-logs") ||
          channel.name.includes("mod-chat") ||
          channel.name.includes("admin") ||
          channel.name.includes("bot-logs")
      );
    }

    if (logChannel && logChannel.isTextBased()) {
      return await logChannel.send({ embeds: [embed] });
    }

    return null;
  } catch (error) {
    logger.error("COMMAND", "Lỗi khi gửi log moderation:", error);
    return null;
  }
}

/**
 * @param {Object} options - Các tùy chọn
 * @param {string} options.title - Tiêu đề của embed
 * @param {string} options.description - Mô tả của embed
 * @param {number} options.color - Màu của embed
 * @param {Array} options.fields - Các trường thông tin
 * @param {string} options.footer - Chân trang
 * @returns {EmbedBuilder} - Embed đã tạo
 */
function createModActionEmbed(options) {
  const embed = new EmbedBuilder()
    .setColor(options.color || 0x3498db)
    .setTitle(options.title || "Hành động Moderation")
    .setDescription(options.description || "")
    .setTimestamp();

  if (options.fields && Array.isArray(options.fields)) {
    for (const field of options.fields) {
      embed.addFields(field);
    }
  }

  if (options.footer) {
    embed.setFooter({ text: options.footer });
  }

  return embed;
}

/**
 * Lấy kênh log moderation đã cấu hình
 * @param {Discord.Guild} guild - Guild cần lấy kênh log
 * @param {boolean} isModAction - Có phải là hành động moderation không
 * @returns {Promise<Discord.TextChannel|null>} - Kênh log hoặc null nếu không tìm thấy
 */
async function getModLogChannel(guild, isModAction = true) {
  try {
    const db = mongoClient.getDb();

    const logSettings = await db.collection("mod_settings").findOne({
      guildId: guild.id,
    });

    let logChannel = null;

    if (logSettings && logSettings.logChannelId) {
      const shouldLog = isModAction
        ? logSettings.modActionLogs !== false
        : logSettings.monitorLogs !== false;

      if (shouldLog) {
        try {
          logChannel = await guild.channels.fetch(logSettings.logChannelId);
          if (logChannel && logChannel.isTextBased()) {
            return logChannel;
          }
        } catch (error) {
          logger.error(
            "COMMAND",
            `Không thể tìm thấy kênh log ${logSettings.logChannelId}:`,
            error
          );
        }
      }
    }

    logChannel = guild.channels.cache.find(
      (channel) =>
        channel.name.includes("mod-logs") ||
        channel.name.includes("mod-chat") ||
        channel.name.includes("admin") ||
        channel.name.includes("bot-logs")
    );

    if (logChannel && logChannel.isTextBased()) {
      return logChannel;
    }

    return null;
  } catch (error) {
    logger.error("COMMAND", "Lỗi khi lấy kênh log moderation:", error);
    return null;
  }
}

module.exports = {
  sendModLog,
  createModActionEmbed,
  getModLogChannel,
};
