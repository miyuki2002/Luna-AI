const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const mongoClient = require('../../services/mongoClient.js');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Xem danh sách cảnh cáo của một thành viên')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('Thành viên cần xem cảnh cáo')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ 
        content: 'Bạn không có quyền xem cảnh cáo của thành viên!', 
        ephemeral: true 
      });
    }

    const targetUser = interaction.options.getUser('user');

    await interaction.deferReply();
    
    try {
      const db = mongoClient.getDb();
      
      const warnings = await db.collection('warnings')
        .find({
          userId: targetUser.id,
          guildId: interaction.guild.id
        })
        .sort({ timestamp: -1 })
        .toArray();
      
      if (warnings.length === 0) {
        return interaction.editReply({
          content: `${targetUser.tag} không có cảnh cáo nào trong server này.`,
          ephemeral: false
        });
      }
      
      const warningsEmbed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle(`⚠️ Danh sách cảnh cáo của ${targetUser.tag}`)
        .setDescription(`Tổng số cảnh cáo: ${warnings.length}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `ID: ${targetUser.id}` })
        .setTimestamp();

      const recentWarnings = warnings.slice(0, 10);
      
      recentWarnings.forEach((warning, index) => {
        const moderator = interaction.guild.members.cache.get(warning.moderatorId);
        const moderatorName = moderator ? moderator.user.tag : 'Không rõ';
        const date = new Date(warning.timestamp).toLocaleDateString('vi-VN');
        const time = new Date(warning.timestamp).toLocaleTimeString('vi-VN');
        
        warningsEmbed.addFields({
          name: `Cảnh cáo #${index + 1} - ${date} ${time}`,
          value: `**Lý do:** ${warning.reason}\n**Người cảnh cáo:** ${moderatorName}`
        });
      });
      
      if (warnings.length > 10) {
        warningsEmbed.addFields({
          name: 'Lưu ý',
          value: `Chỉ hiển thị 10/${warnings.length} cảnh cáo gần nhất.`
        });
      }

      await interaction.editReply({ embeds: [warningsEmbed] });
      
    } catch (error) {
      logger.error('MODERATION', 'Lỗi khi xem cảnh cáo của thành viên:', error);
      await interaction.editReply({ 
        content: `Đã xảy ra lỗi khi xem cảnh cáo của ${targetUser.tag}: ${error.message}`, 
        ephemeral: true 
      });
    }
  },
};
