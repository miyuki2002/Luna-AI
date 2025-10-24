const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ConversationService = require('../../services/ConversationService.js');
const { logModAction, formatDuration } = require('../../utils/modUtils.js');
const { sendModLog, createModActionEmbed } = require('../../utils/modLogUtils.js');

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
        .setMaxValue(40320)) // Tối đa 28 ngày (40320 phút)
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Lý do mute')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    // Kiểm tra quyền
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

    // Kiểm tra xem có thể mute thành viên không
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

    // Tạo thông báo AI về việc mute
    await interaction.deferReply();

    try {
      // Chuyển đổi thời gian từ phút sang mili giây
      const durationMs = duration * 60 * 1000;

      // Tính thời gian kết thúc mute
      const endTime = new Date(Date.now() + durationMs);

      // Format thời gian mute để hiển thị
      const formattedDuration = formatDuration(duration);

      // Sử dụng NeuralNetworks để tạo thông báo
      const prompt = `Tạo một thông báo ngắn gọn, chuyên nghiệp nhưng hơi hài hước về việc mute (timeout) thành viên ${targetUser.username} trong ${formattedDuration} với lý do: "${reason}". Thông báo nên có giọng điệu của một mod nghiêm túc nhưng thân thiện, không quá 3 câu. Có thể thêm 1 emoji phù hợp.`;

      const aiResponse = await ConversationService.getCompletion(prompt);

      // Tạo embed thông báo
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

      // Mute thành viên (timeout)
      await targetMember.timeout(durationMs, reason);

      // Ghi nhật ký hành động
      await logModAction({
        guildId: interaction.guild.id,
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        action: 'mute',
        reason: reason,
        duration: duration
      });

      // Gửi thông báo
      await interaction.editReply({ embeds: [muteEmbed] });

      // Gửi log đến kênh log moderation
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

      // Gửi DM cho người bị mute (nếu có thể)
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle(`Bạn đã bị mute trong ${interaction.guild.name}`)
          .setDescription(`**Lý do:** ${reason}\n**Thời gian:** ${formattedDuration}\n**Kết thúc lúc:** <t:${Math.floor(endTime.getTime() / 1000)}:F>`)
          .setFooter({ text: `Trong thời gian mute, bạn không thể gửi tin nhắn hoặc tham gia voice chat.` })
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log(`Không thể gửi DM cho ${targetUser.tag}`);
      }

    } catch (error) {
      console.error('Lỗi khi mute thành viên:', error);
      await interaction.editReply({
        content: `Đã xảy ra lỗi khi mute ${targetUser.tag}: ${error.message}`,
        ephemeral: true
      });
    }
  },
};
