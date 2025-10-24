const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const mongoClient = require('../../services/mongoClient.js');
const ConversationService = require('../../services/ConversationService.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Xóa cảnh cáo của một thành viên')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('Thành viên cần xóa cảnh cáo')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('type')
        .setDescription('Loại xóa cảnh cáo')
        .setRequired(true)
        .addChoices(
          { name: 'Tất cả', value: 'all' },
          { name: 'Mới nhất', value: 'latest' }
        ))
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('Lý do xóa cảnh cáo')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    // Kiểm tra quyền
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ 
        content: 'Bạn không có quyền xóa cảnh cáo của thành viên!', 
        ephemeral: true 
      });
    }

    const targetUser = interaction.options.getUser('user');
    const type = interaction.options.getString('type');
    const reason = interaction.options.getString('reason') || 'Không có lý do được cung cấp';

    await interaction.deferReply();
    
    try {
      const db = mongoClient.getDb();
      
      // Kiểm tra xem thành viên có cảnh cáo không
      const warningCount = await db.collection('warnings').countDocuments({
        userId: targetUser.id,
        guildId: interaction.guild.id
      });
      
      if (warningCount === 0) {
        return interaction.editReply({
          content: `${targetUser.tag} không có cảnh cáo nào trong server này.`,
          ephemeral: false
        });
      }
      
      let deletedCount = 0;
      
      if (type === 'all') {
        // Xóa tất cả cảnh cáo
        const result = await db.collection('warnings').deleteMany({
          userId: targetUser.id,
          guildId: interaction.guild.id
        });
        
        deletedCount = result.deletedCount;
      } else if (type === 'latest') {
        // Xóa cảnh cáo mới nhất
        const latestWarning = await db.collection('warnings')
          .findOne({
            userId: targetUser.id,
            guildId: interaction.guild.id
          }, {
            sort: { timestamp: -1 }
          });
          
        if (latestWarning) {
          await db.collection('warnings').deleteOne({ _id: latestWarning._id });
          deletedCount = 1;
        }
      }
      
      // Sử dụng NeuralNetworks để tạo thông báo
      const prompt = `Tạo một thông báo ngắn gọn, tích cực về việc xóa ${type === 'all' ? 'tất cả' : 'cảnh cáo mới nhất'} của thành viên ${targetUser.username} với lý do: "${reason}". Đã xóa ${deletedCount} cảnh cáo. Thông báo nên có giọng điệu của một mod công bằng và khoan dung, không quá 2 câu. Có thể thêm 1 emoji phù hợp.`;
      
      const aiResponse = await ConversationService.getCompletion(prompt);
      
      // Tạo embed thông báo
      const clearEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(`🧹 Đã xóa cảnh cáo`)
        .setDescription(aiResponse)
        .addFields(
          { name: 'Thành viên', value: `${targetUser.tag}`, inline: true },
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Số cảnh cáo đã xóa', value: `${deletedCount}`, inline: true },
          { name: 'Loại xóa', value: type === 'all' ? 'Tất cả' : 'Mới nhất', inline: true },
          { name: 'Lý do', value: reason, inline: false }
        )
        .setFooter({ text: `Cleared by ${interaction.user.tag}` })
        .setTimestamp();

      // Gửi thông báo
      await interaction.editReply({ embeds: [clearEmbed] });
      
      // Gửi DM cho người được xóa cảnh cáo (nếu có thể)
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle(`Cảnh cáo của bạn đã được xóa trong ${interaction.guild.name}`)
          .setDescription(`**Loại xóa:** ${type === 'all' ? 'Tất cả cảnh cáo' : 'Cảnh cáo mới nhất'}\n**Số cảnh cáo đã xóa:** ${deletedCount}\n**Lý do:** ${reason}`)
          .setFooter({ text: `Xóa bởi ${interaction.user.tag}` })
          .setTimestamp();
          
        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log(`Không thể gửi DM cho ${targetUser.tag}`);
      }
      
    } catch (error) {
      console.error('Lỗi khi xóa cảnh cáo của thành viên:', error);
      await interaction.editReply({ 
        content: `Đã xảy ra lỗi khi xóa cảnh cáo của ${targetUser.tag}: ${error.message}`, 
        ephemeral: true 
      });
    }
  },
};
