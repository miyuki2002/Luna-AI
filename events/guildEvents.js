const { Events } = require("discord.js");
const { handleGuildJoin, handleGuildLeave } = require("../handlers/guildHandler");
const logger = require("../utils/logger.js");

function setupGuildEvents(client) {

  client.on(Events.GuildCreate, async (guild) => {
    try {
      logger.info('GUILD_EVENT', `Bot tham gia guild mới: ${guild.name} (${guild.id})`);
      await handleGuildJoin(guild, null);
    } catch (error) {
      logger.error('GUILD_EVENT', `Lỗi khi xử lý GuildCreate cho ${guild.name}:`, error);
    }
  });

  client.on(Events.GuildDelete, async (guild) => {
    try {
      logger.info('GUILD_EVENT', `Bot rời khỏi guild: ${guild.name} (${guild.id})`);
      await handleGuildLeave(guild);
    } catch (error) {
      logger.error('GUILD_EVENT', `Lỗi khi xử lý GuildDelete cho ${guild.name}:`, error);
    }
  });

  logger.info("EVENTS", "Đã đăng ký events: GuildCreate, GuildDelete");
}

module.exports = { setupGuildEvents };
