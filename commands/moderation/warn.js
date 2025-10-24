const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ConversationService = require('../../services/ConversationService.js');
const mongoClient = require('../../services/mongoClient.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Cảnh cáo một thành viên')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('Thành viên cần cảnh cáo')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('Lý do cảnh cáo')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    // Kiểm tra quyền
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ 
        content: 'Bạn không có quyền cảnh cáo thành viên!', 
        ephemeral: true 
      });
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');

    // Kiểm tra xem có thể cảnh cáo thành viên không
    if (!targetMember) {
      return interaction.reply({
        content: 'Không thể tìm thấy thành viên này trong server.',
        ephemeral: true
      });
    }

    // Không cho phép cảnh cáo bot hoặc người có quyền cao hơn
    if (targetUser.bot) {
      return interaction.reply({
        content: 'Không thể cảnh cáo bot.',
        ephemeral: true
      });
    }

    if (targetMember.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({
        content: 'Bạn không thể cảnh cáo người có vai trò cao hơn hoặc ngang bằng bạn.',
        ephemeral: true
      });
    }

    await interaction.deferReply();
    
    try {
      const db = mongoClient.getDb();
      
      // Lưu cảnh cáo vào cơ sở dữ liệu
      const warnData = {
        userId: targetUser.id,
        guildId: interaction.guild.id,
        moderatorId: interaction.user.id,
        reason: reason,
        timestamp: Date.now()
      };
      
      await db.collection('warnings').insertOne(warnData);
      
      // Đếm số lần cảnh cáo của thành viên
      const warningCount = await db.collection('warnings').countDocuments({
        userId: targetUser.id,
        guildId: interaction.guild.id
      });
      
      // Sử dụng NeuralNetworks để tạo thông báo
      const prompt = `Tạo một thông báo cảnh cáo nghiêm túc nhưng không quá gay gắt cho thành viên ${targetUser.username} với lý do: "${reason}". Đây là lần cảnh cáo thứ ${warningCount} của họ. Thông báo nên có giọng điệu của một mod nghiêm túc nhưng công bằng, không quá 3 câu. Có thể thêm 1 emoji phù hợp.`;
      
      const aiResponse = await ConversationService.getCompletion(prompt);
      
      // Tạo embed thông báo
      const warnEmbed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle(`⚠️ Thành viên đã bị cảnh cáo`)
        .setDescription(aiResponse)
        .addFields(
          { name: 'Thành viên', value: `${targetUser.tag}`, inline: true },
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Số lần cảnh cáo', value: `${warningCount}`, inline: true },
          { name: 'Lý do', value: reason, inline: false }
        )
        .setFooter({ text: `Warned by ${interaction.user.tag}` })
        .setTimestamp();

      // Gửi thông báo
      await interaction.editReply({ embeds: [warnEmbed] });
      
      // Gửi DM cho người bị cảnh cáo (nếu có thể)
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFFFF00)
          .setTitle(`Bạn đã bị cảnh cáo trong ${interaction.guild.name}`)
          .setDescription(`**Lý do:** ${reason}\n**Số lần cảnh cáo:** ${warningCount}`)
          .setFooter({ text: `Nếu bạn tiếp tục vi phạm quy tắc, bạn có thể bị mute hoặc ban.` })
          .setTimestamp();
          
        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log(`Không thể gửi DM cho ${targetUser.tag}`);
      }
      
      // Tự động xử phạt nếu số lần cảnh cáo vượt quá ngưỡng
      if (warningCount >= 3 && warningCount < 5) {
        // Mute 1 giờ sau 3 lần cảnh cáo
        try {
          await targetMember.timeout(60 * 60 * 1000, `Tự động mute sau ${warningCount} lần cảnh cáo`);
          
          const autoMuteEmbed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle(`🔇 Thành viên đã bị tự động mute`)
            .setDescription(`${targetUser.tag} đã bị tự động mute trong 1 giờ sau ${warningCount} lần cảnh cáo.`)
            .setFooter({ text: `Hệ thống tự động` })
            .setTimestamp();
            
          await interaction.followUp({ embeds: [autoMuteEmbed] });
        } catch (error) {
          console.error('Không thể tự động mute thành viên:', error);
        }
      } else if (warningCount >= 5) {
        // Kick sau 5 lần cảnh cáo
        try {
          await targetMember.kick(`Tự động kick sau ${warningCount} lần cảnh cáo`);
          
          const autoKickEmbed = new EmbedBuilder()
            .setColor(0xFF5555)
            .setTitle(`👢 Thành viên đã bị tự động kick`)
            .setDescription(`${targetUser.tag} đã bị tự động kick sau ${warningCount} lần cảnh cáo.`)
            .setFooter({ text: `Hệ thống tự động` })
            .setTimestamp();
            
          await interaction.followUp({ embeds: [autoKickEmbed] });
        } catch (error) {
          console.error('Không thể tự động kick thành viên:', error);
        }
      }
      
    } catch (error) {
      console.error('Lỗi khi cảnh cáo thành viên:', error);
      await interaction.editReply({ 
        content: `Đã xảy ra lỗi khi cảnh cáo ${targetUser.tag}: ${error.message}`, 
        ephemeral: true 
      });
    }
  },
};
