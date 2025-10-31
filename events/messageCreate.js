const { Events } = require("discord.js");
const { handleMentionMessage } = require("../handlers/messageHandler");
const logger = require("../utils/logger.js");

function setupMessageCreateEvent(client) {
  client.on(Events.MessageCreate, async (message) => {
    try {
      await handleMentionMessage(message, client);
    } catch (error) {
      logger.error("MESSAGE_EVENT", "Lỗi khi xử lý tin nhắn:", error);
    }
  });

  logger.info("EVENTS", "Đã đăng ký event: MessageCreate");
}

module.exports = { setupMessageCreateEvent };
