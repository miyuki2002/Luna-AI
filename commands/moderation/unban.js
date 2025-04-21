const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const NeuralNetworks = require('../../services/NeuralNetworks.js');
const { logModAction } = require('../../utils/modUtils.js');
const { sendModLog, createModActionEmbed } = require('../../utils/modLogUtils.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban một người dùng khỏi server')
    .addStringOption(option =>
      option.setName('userid')
        .setDescription('ID của người dùng cần unban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Lý do unban')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    // Kiểm tra quyền
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content: 'Bạn không có quyền unban người dùng!',
        ephemeral: true
      });
    }

    const userId = interaction.options.getString('userid');
    const reason = interaction.options.getString('reason') || 'Không có lý do được cung cấp';

    // Kiểm tra xem ID có hợp lệ không
    if (!/^\d{17,19}$/.test(userId)) {
      return interaction.reply({
        content: 'ID người dùng không hợp lệ. ID phải là một chuỗi số từ 17-19 chữ số.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      // Kiểm tra xem người dùng có bị ban không
      const banList = await interaction.guild.bans.fetch();
      const bannedUser = banList.find(ban => ban.user.id === userId);

      if (!bannedUser) {
        return interaction.editReply({
          content: 'Người dùng này không bị ban từ server.',
          ephemeral: true
        });
      }

      // Lấy thông tin người dùng
      const user = bannedUser.user;

      // Sử dụng NeuralNetworks để tạo thông báo
      const prompt = `Tạo một thông báo ngắn gọn, tích cực về việc unban người dùng ${user.username} với lý do: "${reason}". Thông báo nên có giọng điệu của một admin công bằng và khoan dung, không quá 2 câu. Có thể thêm 1 emoji phù hợp.`;

      const aiResponse = await NeuralNetworks.getCompletion(prompt);

      // Tạo embed thông báo
      const unbanEmbed = new EmbedBuilder()
        .setColor(0x00FFFF)
        .setTitle(`🔓 Người dùng đã được unban`)
        .setDescription(aiResponse)
        .addFields(
          { name: 'Người dùng', value: `${user.tag}`, inline: true },
          { name: 'ID', value: user.id, inline: true },
          { name: 'Lý do', value: reason, inline: false }
        )
        .setFooter({ text: `Unbanned by ${interaction.user.tag}` })
        .setTimestamp();

      // Unban người dùng
      await interaction.guild.members.unban(user, reason);

      // Ghi nhật ký hành động
      await logModAction({
        guildId: interaction.guild.id,
        targetId: user.id,
        moderatorId: interaction.user.id,
        action: 'unban',
        reason: reason
      });

      // Gửi thông báo
      await interaction.editReply({ embeds: [unbanEmbed] });

      // Gửi log đến kênh log moderation
      const logEmbed = createModActionEmbed({
        title: `🔓 Người dùng đã được unban`,
        description: `${user.tag} đã được unban khỏi server.`,
        color: 0x00FFFF,
        fields: [
          { name: 'Người dùng', value: `${user.tag}`, inline: true },
          { name: 'ID', value: user.id, inline: true },
          { name: 'Người unban', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
          { name: 'Lý do', value: reason, inline: false },
          { name: 'Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        ],
        footer: `Server: ${interaction.guild.name}`
      });

      await sendModLog(interaction.guild, logEmbed, true);

    } catch (error) {
      console.error('Lỗi khi unban người dùng:', error);
      await interaction.editReply({
        content: `Đã xảy ra lỗi khi unban người dùng: ${error.message}`,
        ephemeral: true
      });
    }
  },
};
