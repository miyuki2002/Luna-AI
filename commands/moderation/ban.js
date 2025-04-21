const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const NeuralNetworks = require('../../services/NeuralNetworks.js');
const { logModAction } = require('../../utils/modUtils.js');

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
    // Kiểm tra quyền
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

    // Kiểm tra xem có thể ban thành viên không
    if (targetMember && !targetMember.bannable) {
      return interaction.reply({
        content: 'Tôi không thể ban thành viên này. Có thể họ có quyền cao hơn tôi hoặc bạn.',
        ephemeral: true
      });
    }

    // Tạo thông báo AI về việc ban
    await interaction.deferReply();

    try {
      // Sử dụng NeuralNetworks để tạo thông báo
      const prompt = `Tạo một thông báo nghiêm túc nhưng có chút hài hước về việc ban thành viên ${targetUser.username} khỏi server với lý do: "${reason}". Thông báo nên có giọng điệu của một admin công bằng nhưng cứng rắn, không quá 3 câu. Có thể thêm 1-2 emoji phù hợp.`;

      const aiResponse = await NeuralNetworks.getCompletion(prompt);

      // Tạo embed thông báo
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

      // Ban thành viên
      await interaction.guild.members.ban(targetUser, {
        deleteMessageDays: deleteMessageDays,
        reason: `${reason} - Ban bởi ${interaction.user.tag}`
      });

      // Ghi nhật ký hành động
      await logModAction({
        guildId: interaction.guild.id,
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        action: 'ban',
        reason: reason
      });

      // Gửi thông báo
      await interaction.editReply({ embeds: [banEmbed] });

      // Gửi DM cho người bị ban (nếu có thể)
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle(`Bạn đã bị ban khỏi ${interaction.guild.name}`)
          .setDescription(`**Lý do:** ${reason}`)
          .setFooter({ text: `Nếu bạn cho rằng đây là sự nhầm lẫn, hãy liên hệ với ban quản trị server.` })
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log(`Không thể gửi DM cho ${targetUser.tag}`);
      }

    } catch (error) {
      console.error('Lỗi khi ban thành viên:', error);
      await interaction.editReply({
        content: `Đã xảy ra lỗi khi ban ${targetUser.tag}: ${error.message}`,
        ephemeral: true
      });
    }
  },
};
