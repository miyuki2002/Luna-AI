const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const NeuralNetworks = require('../../services/NeuralNetworks.js');
const { logModAction } = require('../../utils/modUtils.js');
const { sendModLog, createModActionEmbed } = require('../../utils/modLogUtils.js');

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
    // Kiểm tra quyền
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({
        content: 'Bạn không có quyền unmute thành viên!',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'Không có lý do được cung cấp';

    // Kiểm tra xem có thể unmute thành viên không
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

    // Kiểm tra xem thành viên có đang bị mute không
    if (!targetMember.communicationDisabledUntil) {
      return interaction.reply({
        content: 'Thành viên này không bị mute.',
        ephemeral: true
      });
    }

    // Tạo thông báo AI về việc unmute
    await interaction.deferReply();

    try {
      // Sử dụng NeuralNetworks để tạo thông báo
      const prompt = `Tạo một thông báo ngắn gọn, tích cực về việc unmute (bỏ timeout) thành viên ${targetUser.username} với lý do: "${reason}". Thông báo nên có giọng điệu của một mod thân thiện, không quá 2 câu. Có thể thêm 1 emoji phù hợp.`;

      const aiResponse = await NeuralNetworks.getCompletion(prompt);

      // Tạo embed thông báo
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

      // Unmute thành viên (xóa timeout)
      await targetMember.timeout(null, reason);

      // Ghi nhật ký hành động
      await logModAction({
        guildId: interaction.guild.id,
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        action: 'unmute',
        reason: reason
      });

      // Gửi thông báo
      await interaction.editReply({ embeds: [unmuteEmbed] });

      // Gửi log đến kênh log moderation
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

      // Gửi DM cho người được unmute (nếu có thể)
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle(`Bạn đã được unmute trong ${interaction.guild.name}`)
          .setDescription(`**Lý do:** ${reason}\n\nBạn đã có thể gửi tin nhắn và tham gia voice chat trở lại.`)
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log(`Không thể gửi DM cho ${targetUser.tag}`);
      }

    } catch (error) {
      console.error('Lỗi khi unmute thành viên:', error);
      await interaction.editReply({
        content: `Đã xảy ra lỗi khi unmute ${targetUser.tag}: ${error.message}`,
        ephemeral: true
      });
    }
  },
};
