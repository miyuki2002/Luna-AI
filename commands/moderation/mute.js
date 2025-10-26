const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ConversationService = require('../../services/ConversationService.js');
const { logModAction, formatDuration } = require('../../utils/modUtils.js');
const { sendModLog, createModActionEmbed } = require('../../utils/modLogUtils.js');
const { handlePermissionError } = require('../../utils/permissionUtils');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute (timeout) một thành viên')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Thành viên cần mute')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Thời gian mute (phút)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Lý do mute')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({
        content: 'Bạn không có quyền mute thành viên!',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const duration = interaction.options.getInteger('duration'); // Thời gian tính bằng phút
    const reason = interaction.options.getString('reason') || 'Không có lý do được cung cấp';

    if (!targetMember) {
      return interaction.reply({
        content: 'Không thể tìm thấy thành viên này trong server.',
        ephemeral: true
      });
    }

    if (!targetMember.moderatable) {
      return interaction.reply({
        content: 'Tôi không thể mute thành viên này. Có thể họ có quyền cao hơn tôi hoặc bạn.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      const durationMs = duration * 60 * 1000;

      const endTime = new Date(Date.now() + durationMs);

      const formattedDuration = formatDuration(duration);

      const prompts = require('../../config/prompts.js');
      const prompt = prompts.moderation.mute
        .replace('${username}', targetUser.username)
        .replace('${duration}', formattedDuration)
        .replace('${reason}', reason);

      const aiResponse = await ConversationService.getCompletion(prompt);

      const muteEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle(`🔇 Thành viên đã bị mute`)
        .setDescription(aiResponse)
        .addFields(
          { name: 'Thành viên', value: `${targetUser.tag}`, inline: true },
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Thời gian', value: formattedDuration, inline: true },
          { name: 'Kết thúc lúc', value: `<t:${Math.floor(endTime.getTime() / 1000)}:F>`, inline: true },
          { name: 'Lý do', value: reason, inline: false }
        )
        .setFooter({ text: `Muted by ${interaction.user.tag}` })
        .setTimestamp();

      await targetMember.timeout(durationMs, reason);

      await logModAction({
        guildId: interaction.guild.id,
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        action: 'mute',
        reason: reason,
        duration: duration
      });

      try {
        await interaction.editReply({ embeds: [muteEmbed] });
      } catch (error) {
        if (error.code === 50013 || error.message.includes('permission')) {
          await handlePermissionError(interaction, 'embedLinks', interaction.user.username, 'editReply');
        } else {
          throw error;
        }
      }

      const logEmbed = createModActionEmbed({
        title: `🔇 Thành viên đã bị mute`,
        description: `${targetUser.tag} đã bị mute trong ${formattedDuration}.`,
        color: 0xFFA500,
        fields: [
          { name: 'Thành viên', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Người mute', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
          { name: 'Thời gian mute', value: formattedDuration, inline: true },
          { name: 'Kết thúc lúc', value: `<t:${Math.floor(endTime.getTime() / 1000)}:F>`, inline: true },
          { name: 'Lý do', value: reason, inline: false }
        ],
        footer: `Server: ${interaction.guild.name}`
      });

      await sendModLog(interaction.guild, logEmbed, true);

      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle(`Bạn đã bị mute trong ${interaction.guild.name}`)
          .setDescription(`**Lý do:** ${reason}\n**Thời gian:** ${formattedDuration}\n**Kết thúc lúc:** <t:${Math.floor(endTime.getTime() / 1000)}:F>`)
          .setFooter({ text: `Trong thời gian mute, bạn không thể gửi tin nhắn hoặc tham gia voice chat.` })
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        logger.error('MODERATION', `Không thể gửi DM cho ${targetUser.tag}`);
      }

    } catch (error) {
      logger.error('MODERATION', 'Lỗi khi mute thành viên:', error);
      await interaction.editReply({
        content: `Đã xảy ra lỗi khi mute ${targetUser.tag}: ${error.message}`,
        ephemeral: true
      });
    }
  },
};
