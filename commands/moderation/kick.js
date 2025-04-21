const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const NeuralNetworks = require('../../services/NeuralNetworks.js');
const { logModAction } = require('../../utils/modUtils.js');
const { sendModLog, createModActionEmbed } = require('../../utils/modLogUtils.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick một thành viên khỏi server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Thành viên cần kick')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Lý do kick')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    // Kiểm tra quyền
    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({
        content: 'Bạn không có quyền kick thành viên!',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'Không có lý do được cung cấp';

    // Kiểm tra xem có thể kick thành viên không
    if (!targetMember) {
      return interaction.reply({
        content: 'Không thể tìm thấy thành viên này trong server.',
        ephemeral: true
      });
    }

    if (!targetMember.kickable) {
      return interaction.reply({
        content: 'Tôi không thể kick thành viên này. Có thể họ có quyền cao hơn tôi hoặc bạn.',
        ephemeral: true
      });
    }

    // Tạo thông báo AI về việc kick
    await interaction.deferReply();

    try {
      // Sử dụng NeuralNetworks để tạo thông báo
      const prompt = `Tạo một thông báo ngắn gọn, chuyên nghiệp nhưng hơi hài hước về việc kick thành viên ${targetUser.username} khỏi server với lý do: "${reason}". Thông báo nên có giọng điệu của một admin nghiêm túc nhưng thân thiện, không quá 3 câu. Không cần thêm emoji.`;

      const aiResponse = await NeuralNetworks.getCompletion(prompt);

      // Tạo embed thông báo
      const kickEmbed = new EmbedBuilder()
        .setColor(0xFF5555)
        .setTitle(`🥾 Thành viên đã bị kick`)
        .setDescription(aiResponse)
        .addFields(
          { name: 'Thành viên', value: `${targetUser.tag}`, inline: true },
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Lý do', value: reason, inline: false }
        )
        .setFooter({ text: `Kicked by ${interaction.user.tag}` })
        .setTimestamp();

      // Kick thành viên
      await targetMember.kick(reason);

      // Ghi nhật ký hành động
      await logModAction({
        guildId: interaction.guild.id,
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        action: 'kick',
        reason: reason
      });

      // Gửi thông báo
      await interaction.editReply({ embeds: [kickEmbed] });

      // Gửi log đến kênh log moderation
      const logEmbed = createModActionEmbed({
        title: `👢 Thành viên đã bị kick`,
        description: `${targetUser.tag} đã bị kick khỏi server.`,
        color: 0xFF5555,
        fields: [
          { name: 'Thành viên', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Người kick', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
          { name: 'Lý do', value: reason, inline: false },
          { name: 'Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        ],
        footer: `Server: ${interaction.guild.name}`
      });

      await sendModLog(interaction.guild, logEmbed, true);

      // Gửi DM cho người bị kick (nếu có thể)
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFF5555)
          .setTitle(`Bạn đã bị kick khỏi ${interaction.guild.name}`)
          .setDescription(`**Lý do:** ${reason}`)
          .setFooter({ text: `Bạn có thể tham gia lại sau khi xem xét lại hành vi của mình.` })
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log(`Không thể gửi DM cho ${targetUser.tag}`);
      }

    } catch (error) {
      console.error('Lỗi khi kick thành viên:', error);
      await interaction.editReply({
        content: `Đã xảy ra lỗi khi kick ${targetUser.tag}: ${error.message}`,
        ephemeral: true
      });
    }
  },
};
