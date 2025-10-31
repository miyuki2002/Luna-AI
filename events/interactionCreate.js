const { Events } = require("discord.js");
const { handleCommand } = require("../handlers/commandHandler");
const { handleConsentInteraction } = require("../handlers/consentHandler");
const { handleResetdbInteraction } = require("../handlers/resetdbHandler");
const logger = require("../utils/logger.js");

function setupInteractionCreateEvent(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction, client);
      } else if (interaction.isButton()) {
        if (interaction.customId.startsWith('consent_')) {
          await handleConsentInteraction(interaction);
        } else if (interaction.customId.startsWith('resetdb_') || interaction.customId.startsWith('resetuser_')) {
          await handleResetdbInteraction(interaction);
        }
      }
    } catch (error) {
      logger.error("INTERACTION_EVENT", "Lỗi khi xử lý interaction:", error);
    }
  });

  logger.info("EVENTS", "Đã đăng ký event: InteractionCreate");
}

module.exports = { setupInteractionCreateEvent };
