const consentService = require('../services/consentService');
const logger = require('../utils/logger.js');

/**
 * Xử lý consent button interactions
 * @param {Object} interaction - Discord interaction
 */
async function handleConsentInteraction(interaction) {
  if (!interaction.isButton()) return;

  const { customId, user } = interaction;
  const userId = user.id;

  try {
    if (customId === 'consent_accept') {
      await consentService.handleConsentAccept(interaction, userId);
    } else if (customId === 'consent_decline') {
      await consentService.handleConsentDecline(interaction, userId);
    }
  } catch (error) {
    logger.error('CONSENT_HANDLER', `Lỗi khi xử lý consent interaction cho user ${userId}:`, error);
    
    try {
      await interaction.followUp({
        content: '❌ Có lỗi xảy ra khi xử lý yêu cầu của bạn. Vui lòng thử lại sau!',
        ephemeral: true
      });
    } catch (followUpError) {
      logger.error('CONSENT_HANDLER', 'Lỗi khi gửi follow-up message:', followUpError);
    }
  }
}

module.exports = {
  handleConsentInteraction
};
