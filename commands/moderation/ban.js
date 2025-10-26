const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ConversationService = require('../../services/ConversationService.js');
const { logModAction } = require('../../utils/modUtils.js');
const { sendModLog, createModActionEmbed } = require('../../utils/modLogUtils.js');
const { handlePermissionError } = require('../../utils/permissionUtils');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban một thành viên khỏi server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Thành viên cần ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Lý do ban')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('Số ngày xóa tin nhắn (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content: 'Bạn không có quyền ban thành viên!',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'Không có lý do được cung cấp';
    const deleteMessageDays = interaction.options.getInteger('days') || 1;

    if (targetMember && !targetMember.bannable) {
      return interaction.reply({
        content: 'Tôi không thể ban thành viên này. Có thể họ có quyền cao hơn tôi hoặc bạn.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      const prompts = require('../../config/prompts.js');
      const prompt = prompts.moderation.ban
        .replace('${username}', targetUser.username)
        .replace('${reason}', reason);

      const aiResponse = await ConversationService.getCompletion(prompt);

      const banEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(`🔨 Thành viên đã bị ban`)
        .setDescription(aiResponse)
        .addFields(
          { name: 'Thành viên', value: `${targetUser.tag}`, inline: true },
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Lý do', value: reason, inline: false },
          { name: 'Xóa tin nhắn', value: `${deleteMessageDays} ngày`, inline: true }
        )
        .setFooter({ text: `Banned by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.guild.members.ban(targetUser, {
        deleteMessageDays: deleteMessageDays,
        reason: `${reason} - Ban bởi ${interaction.user.tag}`
      });

      await logModAction({
        guildId: interaction.guild.id,
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        action: 'ban',
        reason: reason
      });

      try {
        await interaction.editReply({ embeds: [banEmbed] });
      } catch (error) {
        if (error.code === 50013 || error.message.includes('permission')) {
          await handlePermissionError(interaction, 'embedLinks', interaction.user.username, 'editReply');
        } else {
          throw error;
        }
      }

      const logEmbed = createModActionEmbed({
        title: `🔨 Thành viên đã bị ban`,
        description: `${targetUser.tag} đã bị ban khỏi server.`,
        color: 0xFF0000,
        fields: [
          { name: 'Thành viên', value: `${targetUser.tag}`, inline: true },
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Người ban', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
          { name: 'Lý do', value: reason, inline: false },
          { name: 'Xóa tin nhắn', value: `${deleteMessageDays} ngày`, inline: true },
          { name: 'Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        ],
        footer: `Server: ${interaction.guild.name}`
      });

      await sendModLog(interaction.guild, logEmbed, true);

      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle(`Bạn đã bị ban khỏi ${interaction.guild.name}`)
          .setDescription(`**Lý do:** ${reason}`)
          .setFooter({ text: `Nếu bạn cho rằng đây là sự nhầm lẫn, hãy liên hệ với ban quản trị server.` })
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        logger.error('MODERATION', `Không thể gửi DM cho ${targetUser.tag}`);
      }

    } catch (error) {
      logger.error('MODERATION', 'Lỗi khi ban thành viên:', error);
      await interaction.editReply({
        content: `Đã xảy ra lỗi khi ban ${targetUser.tag}: ${error.message}`,
        ephemeral: true
      });
    }
  },
};
