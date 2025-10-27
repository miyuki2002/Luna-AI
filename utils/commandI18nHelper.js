const { translate } = require('./i18n.js');

/**
 * Helper class để áp dụng i18n cho commands
 */
class CommandI18nHelper {
  /**
   * Tạo SlashCommandBuilder với i18n
   * @param {string} commandName - Tên command
   * @param {string} descriptionKey - Key mô tả trong i18n
   * @param {Array} options - Mảng options
   * @returns {SlashCommandBuilder} - SlashCommandBuilder đã được i18n
   */
  static createSlashCommand(commandName, descriptionKey, options = []) {
    const { SlashCommandBuilder } = require('discord.js');
    
    const command = new SlashCommandBuilder()
      .setName(commandName)
      .setDescription(translate('en', descriptionKey));

    // Thêm options
    for (const option of options) {
      switch (option.type) {
        case 'user':
          command.addUserOption(opt =>
            opt.setName(option.name)
              .setDescription(translate('en', option.descriptionKey))
              .setRequired(option.required || false)
          );
          break;
        case 'string':
          command.addStringOption(opt =>
            opt.setName(option.name)
              .setDescription(translate('en', option.descriptionKey))
              .setRequired(option.required || false)
          );
          break;
        case 'integer':
          command.addIntegerOption(opt => {
            const integerOpt = opt.setName(option.name)
              .setDescription(translate('en', option.descriptionKey))
              .setRequired(option.required || false);
            
            if (option.minValue !== undefined) {
              integerOpt.setMinValue(option.minValue);
            }
            if (option.maxValue !== undefined) {
              integerOpt.setMaxValue(option.maxValue);
            }
            
            return integerOpt;
          });
          break;
        case 'boolean':
          command.addBooleanOption(opt =>
            opt.setName(option.name)
              .setDescription(translate('en', option.descriptionKey))
              .setRequired(option.required || false)
          );
          break;
        case 'channel':
          command.addChannelOption(opt =>
            opt.setName(option.name)
              .setDescription(translate('en', option.descriptionKey))
              .setRequired(option.required || false)
          );
          break;
        case 'role':
          command.addRoleOption(opt =>
            opt.setName(option.name)
              .setDescription(translate('en', option.descriptionKey))
              .setRequired(option.required || false)
          );
          break;
      }
    }

    // Thêm permissions nếu có
    if (options.permissions) {
      command.setDefaultMemberPermissions(options.permissions);
    }

    return command;
  }

  /**
   * Tạo embed với i18n
   * @param {Object} interaction - Discord interaction
   * @param {string} embedKey - Key embed trong i18n
   * @param {Object} variables - Biến để thay thế
   * @returns {EmbedBuilder} - Embed đã được i18n
   */
  static createEmbed(interaction, embedKey, variables = {}) {
    const { EmbedBuilder } = require('discord.js');
    const userLocale = this.getUserLocale(interaction);
    
    const embed = new EmbedBuilder();
    
    // Set title
    const title = translate(userLocale, `${embedKey}.title`, variables);
    if (title && title !== `${embedKey}.title`) {
      embed.setTitle(title);
    }

    // Set description
    const description = translate(userLocale, `${embedKey}.description`, variables);
    if (description && description !== `${embedKey}.description`) {
      embed.setDescription(description);
    }

    // Set color
    const color = translate(userLocale, `${embedKey}.color`, variables);
    if (color && color !== `${embedKey}.color`) {
      embed.setColor(parseInt(color.replace('#', ''), 16));
    }

    // Set fields
    const fields = translate(userLocale, `${embedKey}.fields`, variables);
    if (fields && typeof fields === 'object') {
      for (const [fieldName, fieldValue] of Object.entries(fields)) {
        embed.addFields({
          name: fieldValue.name || fieldName,
          value: fieldValue.value || fieldValue,
          inline: fieldValue.inline || false
        });
      }
    }

    // Set footer
    const footer = translate(userLocale, `${embedKey}.footer`, variables);
    if (footer && footer !== `${embedKey}.footer`) {
      embed.setFooter({ text: footer });
    }

    // Set timestamp
    const timestamp = translate(userLocale, `${embedKey}.timestamp`, variables);
    if (timestamp === 'true' || timestamp === true) {
      embed.setTimestamp();
    }

    return embed;
  }

  /**
   * Lấy error message với i18n
   * @param {Object} interaction - Discord interaction
   * @param {string} errorKey - Key error trong i18n
   * @param {Object} variables - Biến để thay thế
   * @returns {string} - Error message đã được i18n
   */
  static getErrorMessage(interaction, errorKey, variables = {}) {
    const userLocale = this.getUserLocale(interaction);
    return translate(userLocale, errorKey, variables);
  }

  /**
   * Lấy success message với i18n
   * @param {Object} interaction - Discord interaction
   * @param {string} successKey - Key success trong i18n
   * @param {Object} variables - Biến để thay thế
   * @returns {string} - Success message đã được i18n
   */
  static getSuccessMessage(interaction, successKey, variables = {}) {
    const userLocale = this.getUserLocale(interaction);
    return translate(userLocale, successKey, variables);
  }

  /**
   * Lấy locale của user
   * @param {Object} interaction - Discord interaction
   * @returns {string} - Locale của user
   */
  static getUserLocale(interaction) {
    return interaction.locale || 
           interaction.guildLocale || 
           interaction.user?.locale || 
           'en';
  }

  /**
   * Tạo reply với i18n
   * @param {Object} interaction - Discord interaction
   * @param {string} messageKey - Key message trong i18n
   * @param {Object} variables - Biến để thay thế
   * @param {Object} options - Options cho reply
   * @returns {Promise} - Reply với i18n
   */
  static async reply(interaction, messageKey, variables = {}, options = {}) {
    const userLocale = this.getUserLocale(interaction);
    const message = translate(userLocale, messageKey, variables);
    
    return await interaction.reply({
      content: message,
      ...options
    });
  }

  /**
   * Tạo editReply với i18n
   * @param {Object} interaction - Discord interaction
   * @param {string} messageKey - Key message trong i18n
   * @param {Object} variables - Biến để thay thế
   * @param {Object} options - Options cho editReply
   * @returns {Promise} - EditReply với i18n
   */
  static async editReply(interaction, messageKey, variables = {}, options = {}) {
    const userLocale = this.getUserLocale(interaction);
    const message = translate(userLocale, messageKey, variables);
    
    return await interaction.editReply({
      content: message,
      ...options
    });
  }

  /**
   * Tạo followUp với i18n
   * @param {Object} interaction - Discord interaction
   * @param {string} messageKey - Key message trong i18n
   * @param {Object} variables - Biến để thay thế
   * @param {Object} options - Options cho followUp
   * @returns {Promise} - FollowUp với i18n
   */
  static async followUp(interaction, messageKey, variables = {}, options = {}) {
    const userLocale = this.getUserLocale(interaction);
    const message = translate(userLocale, messageKey, variables);
    
    return await interaction.followUp({
      content: message,
      ...options
    });
  }
}

module.exports = CommandI18nHelper;
