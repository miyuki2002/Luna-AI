const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { translate } = require('../../utils/i18n.js');
const ConversationService = require('../../services/ConversationService.js');
const { logModAction } = require('../../utils/modUtils.js');
const { sendModLog, createModActionEmbed } = require('../../utils/modLogUtils.js');
const { handlePermissionError } = require('../../utils/permissionUtils.js');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Cấm một người dùng khỏi server')
    .addUserOption(option =>
      option.setName('user').setDescription('Người dùng cần cấm').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Lý do cấm').setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('days')
        .setDescription('Số ngày tin nhắn cần xóa (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userLocale = interaction.locale || interaction.guildLocale || 'en';

    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content: translate(userLocale, 'commands.ban.errors.noPermission'),
        ephemeral: true,
      });
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const reason =
      interaction.options.getString('reason') ||
      translate(userLocale, 'commands.ban.defaultReason');
    const deleteMessageDays = interaction.options.getInteger('days') || 1;

    if (targetMember && !targetMember.bannable) {
      return interaction.reply({
        content: translate(userLocale, 'commands.ban.errors.cannotBan'),
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      const prompts = require('../../config/prompts.js');
      const prompt = prompts.moderation.ban
        .replace('${username}', targetUser.username)
        .replace('${reason}', reason);

      const aiResponse = await ConversationService.getCompletion(prompt);

      // Create success embed using i18n
      const banEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(translate(userLocale, 'commands.ban.embeds.success.title'))
        .setDescription(aiResponse)
        .addFields(
          {
            name: translate(userLocale, 'commands.ban.embeds.success.fields.reason'),
            value: reason,
            inline: true,
          },
          {
            name: translate(userLocale, 'commands.ban.embeds.success.fields.deleteMessages'),
            value: `${deleteMessageDays} ${translate(
              userLocale,
              'commands.ban.embeds.success.fields.days'
            )}`,
            inline: true,
          },
          {
            name: translate(userLocale, 'commands.ban.embeds.success.fields.moderator'),
            value: interaction.user.tag,
            inline: true,
          }
        )
        .setFooter({
          text: translate(userLocale, 'commands.ban.embeds.success.footer', {
            moderator: interaction.user.tag,
          }),
        })
        .setTimestamp();

      // Ban the user
      await interaction.guild.members.ban(targetUser, {
        deleteMessageDays: deleteMessageDays,
        reason: `${reason} - ${translate(userLocale, 'commands.ban.banReason', {
          moderator: interaction.user.tag,
        })}`,
      });

      // Log the action
      await logModAction({
        guildId: interaction.guild.id,
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        action: 'ban',
        reason: reason,
      });

      try {
        await interaction.editReply({ embeds: [banEmbed] });
      } catch (error) {
        if (error.code === 50013 || error.message.includes('permission')) {
          await handlePermissionError(
            interaction,
            'embedLinks',
            interaction.user.username,
            'editReply'
          );
        } else {
          throw error;
        }
      }

      // Create mod log embed using i18n
      const logEmbed = createModActionEmbed({
        title: translate(userLocale, 'commands.ban.embeds.success.title'),
        description: translate(userLocale, 'commands.ban.embeds.success.description', {
          user: targetUser.tag,
        }),
        color: 0xff0000,
        fields: [
          {
            name: translate(userLocale, 'commands.ban.embeds.success.fields.user'),
            value: `${targetUser.tag}`,
            inline: true,
          },
          {
            name: translate(userLocale, 'commands.ban.embeds.success.fields.userId'),
            value: targetUser.id,
            inline: true,
          },
          {
            name: translate(userLocale, 'commands.ban.embeds.success.fields.moderator'),
            value: `${interaction.user.tag} (<@${interaction.user.id}>)`,
            inline: true,
          },
          {
            name: translate(userLocale, 'commands.ban.embeds.success.fields.reason'),
            value: reason,
            inline: false,
          },
          {
            name: translate(userLocale, 'commands.ban.embeds.success.fields.deleteMessages'),
            value: `${deleteMessageDays} ${translate(
              userLocale,
              'commands.ban.embeds.success.fields.days'
            )}`,
            inline: true,
          },
          {
            name: translate(userLocale, 'commands.ban.embeds.success.fields.date'),
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: false,
          },
        ],
        footer: translate(userLocale, 'commands.ban.embeds.success.footerServer', {
          server: interaction.guild.name,
        }),
      });

      await sendModLog(interaction.guild, logEmbed, true);

      // Send DM to banned user using i18n
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle(
            translate(userLocale, 'commands.ban.dm.title', {
              server: interaction.guild.name,
            })
          )
          .setDescription(
            translate(userLocale, 'commands.ban.dm.description', {
              reason: reason,
            })
          )
          .setFooter({
            text: translate(userLocale, 'commands.ban.dm.footer'),
          })
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        logger.error(
          'MODERATION',
          translate(userLocale, 'commands.ban.dm.error', {
            user: targetUser.tag,
          })
        );
      }
    } catch (error) {
      logger.error(
        'MODERATION',
        translate(userLocale, 'commands.ban.errors.general', {
          user: targetUser.tag,
          error: error.message,
        })
      );
      await interaction.editReply({
        content: translate(userLocale, 'commands.ban.errors.general', {
          user: targetUser.tag,
          error: error.message,
        }),
        ephemeral: true,
      });
    }
  },
};
