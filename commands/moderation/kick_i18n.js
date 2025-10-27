const { PermissionFlagsBits } = require('discord.js');
const CommandI18nHelper = require('../../utils/commandI18nHelper.js');
const { logModAction } = require('../../utils/modUtils.js');
const { sendModLog, createModActionEmbed } = require('../../utils/modLogUtils.js');
const { handlePermissionError } = require('../../utils/permissionUtils');
const logger = require('../../utils/logger.js');

module.exports = {
  data: CommandI18nHelper.createSlashCommand('kick_i18n', 'commands.kick.description', [
    {
      type: 'user',
      name: 'user',
      descriptionKey: 'commands.kick.options.user',
      required: true
    },
    {
      type: 'string',
      name: 'reason',
      descriptionKey: 'commands.kick.options.reason',
      required: false
    }
  ], {
    permissions: PermissionFlagsBits.KickMembers
  }),

  async execute(interaction) {
    // Check permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return CommandI18nHelper.reply(
        interaction, 
        'commands.kick.errors.noPermission', 
        {}, 
        { ephemeral: true }
      );
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 
                   CommandI18nHelper.getSuccessMessage(interaction, 'commands.kick.defaultReason');

    if (targetMember && !targetMember.kickable) {
      return CommandI18nHelper.reply(
        interaction, 
        'commands.kick.errors.cannotKick', 
        {}, 
        { ephemeral: true }
      );
    }

    await interaction.deferReply();

    try {
      // Create success embed using helper
      const kickEmbed = CommandI18nHelper.createEmbed(
        interaction, 
        'commands.kick.embeds.success', 
        {
          user: targetUser.tag,
          reason: reason,
          moderator: interaction.user.tag
        }
      );

      // Kick the user
      await targetMember.kick(reason);

      // Log the action
      await logModAction({
        guildId: interaction.guild.id,
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        action: 'kick',
        reason: reason
      });

      try {
        await interaction.editReply({ embeds: [kickEmbed] });
      } catch (error) {
        if (error.code === 50013 || error.message.includes('permission')) {
          await handlePermissionError(interaction, 'embedLinks', interaction.user.username, 'editReply');
        } else {
          throw error;
        }
      }

      // Create mod log embed using helper
      const logEmbed = createModActionEmbed({
        title: CommandI18nHelper.getSuccessMessage(interaction, 'commands.kick.embeds.success.title'),
        description: CommandI18nHelper.getSuccessMessage(interaction, 'commands.kick.embeds.success.description', { 
          user: targetUser.tag 
        }),
        color: 0xFFA500,
        fields: [
          { 
            name: CommandI18nHelper.getSuccessMessage(interaction, 'commands.kick.embeds.success.fields.user'), 
            value: `${targetUser.tag}`, 
            inline: true 
          },
          { 
            name: CommandI18nHelper.getSuccessMessage(interaction, 'commands.kick.embeds.success.fields.userId'), 
            value: targetUser.id, 
            inline: true 
          },
          { 
            name: CommandI18nHelper.getSuccessMessage(interaction, 'commands.kick.embeds.success.fields.moderator'), 
            value: `${interaction.user.tag} (<@${interaction.user.id}>)`, 
            inline: true 
          },
          { 
            name: CommandI18nHelper.getSuccessMessage(interaction, 'commands.kick.embeds.success.fields.reason'), 
            value: reason, 
            inline: false 
          },
          { 
            name: CommandI18nHelper.getSuccessMessage(interaction, 'commands.kick.embeds.success.fields.date'), 
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`, 
            inline: false 
          }
        ],
        footer: CommandI18nHelper.getSuccessMessage(interaction, 'commands.kick.embeds.success.footerServer', { 
          server: interaction.guild.name 
        })
      });

      await sendModLog(interaction.guild, logEmbed, true);

    } catch (error) {
      logger.error('MODERATION', CommandI18nHelper.getErrorMessage(interaction, 'commands.kick.errors.general', { 
        user: targetUser.tag,
        error: error.message 
      }));
      
      await CommandI18nHelper.editReply(
        interaction, 
        'commands.kick.errors.general', 
        { 
          user: targetUser.tag,
          error: error.message 
        }, 
        { ephemeral: true }
      );
    }
  },
};
