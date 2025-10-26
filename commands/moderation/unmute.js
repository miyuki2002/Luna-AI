const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ConversationService = require('../../services/ConversationService.js');
const { logModAction } = require('../../utils/modUtils.js');
const { sendModLog, createModActionEmbed } = require('../../utils/modLogUtils.js');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute (bỏ timeout) một thành viên')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Thành viên cần unmute')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Lý do unmute')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({
        content: 'Bạn không có quyền unmute thành viên!',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'Không có lý do được cung cấp';

    if (!targetMember) {
      return interaction.reply({
        content: 'Không thể tìm thấy thành viên này trong server.',
        ephemeral: true
      });
    }

    if (!targetMember.moderatable) {
      return interaction.reply({
        content: 'Tôi không thể unmute thành viên này. Có thể họ có quyền cao hơn tôi.',
        ephemeral: true
      });
    }

    if (!targetMember.communicationDisabledUntil) {
      return interaction.reply({
        content: 'Thành viên này không bị mute.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      const prompts = require('../../config/prompts.js');
      const prompt = prompts.moderation.unmute
        .replace('${username}', targetUser.username)
        .replace('${reason}', reason);

      const aiResponse = await ConversationService.getCompletion(prompt);

      const unmuteEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(`🔊 Thành viên đã được unmute`)
        .setDescription(aiResponse)
        .addFields(
          { name: 'Thành viên', value: `${targetUser.tag}`, inline: true },
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Lý do', value: reason, inline: false }
        )
        .setFooter({ text: `Unmuted by ${interaction.user.tag}` })
        .setTimestamp();

      await targetMember.timeout(null, reason);

      await logModAction({
        guildId: interaction.guild.id,
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        action: 'unmute',
        reason: reason
      });

      await interaction.editReply({ embeds: [unmuteEmbed] });

      const logEmbed = createModActionEmbed({
        title: `🔊 Thành viên đã được unmute`,
        description: `${targetUser.tag} đã được unmute trong server.`,
        color: 0x00FF00,
        fields: [
          { name: 'Thành viên', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Người unmute', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
          { name: 'Lý do', value: reason, inline: false },
          { name: 'Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        ],
        footer: `Server: ${interaction.guild.name}`
      });

      await sendModLog(interaction.guild, logEmbed, true);

      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle(`Bạn đã được unmute trong ${interaction.guild.name}`)
          .setDescription(`**Lý do:** ${reason}\n\nBạn đã có thể gửi tin nhắn và tham gia voice chat trở lại.`)
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        logger.error('MODERATION', `Không thể gửi DM cho ${targetUser.tag}`);
      }

    } catch (error) {
      logger.error('MODERATION', 'Lỗi khi unmute thành viên:', error);
      await interaction.editReply({
        content: `Đã xảy ra lỗi khi unmute ${targetUser.tag}: ${error.message}`,
        ephemeral: true
      });
    }
  },
};
