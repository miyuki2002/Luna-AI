const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const mongoClient = require('../../services/mongoClient.js');
const { getModLogChannel } = require('../../utils/modLogUtils.js');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logchannel')
    .setDescription('Xem cài đặt kênh log hiện tại')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ 
        content: 'Bạn không có quyền xem cài đặt kênh log!', 
        ephemeral: true 
      });
    }

    await interaction.deferReply();
    
    try {
      const db = mongoClient.getDb();
      
      const logSettings = await db.collection('mod_settings').findOne({ 
        guildId: interaction.guild.id 
      });
      
      const modActionLogChannel = await getModLogChannel(interaction.guild, true);
      const monitorLogChannel = await getModLogChannel(interaction.guild, false);
      
      if (!logSettings) {
        const defaultLogEmbed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('📋 Cài đặt kênh log')
          .setDescription('Chưa có kênh log nào được cài đặt. Bot sẽ tự động tìm kênh phù hợp để gửi log.')
          .addFields(
            { name: 'Kênh log hành động moderation', value: modActionLogChannel ? `<#${modActionLogChannel.id}>` : 'Không tìm thấy kênh phù hợp', inline: true },
            { name: 'Kênh log giám sát chat', value: monitorLogChannel ? `<#${monitorLogChannel.id}>` : 'Không tìm thấy kênh phù hợp', inline: true },
            { name: 'Cách cài đặt', value: 'Sử dụng lệnh `/setlogchannel` để cài đặt kênh log cụ thể.', inline: false }
          )
          .setFooter({ text: `Server: ${interaction.guild.name}` })
          .setTimestamp();
        
        return interaction.editReply({ embeds: [defaultLogEmbed] });
      }
      
      let logChannel;
      try {
        logChannel = await interaction.guild.channels.fetch(logSettings.logChannelId);
      } catch (error) {
        logger.error('MODERATION', `Không thể tìm thấy kênh log ${logSettings.logChannelId}:`, error);
      }
      
      const logEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('📋 Cài đặt kênh log')
        .setDescription(logChannel 
          ? `Kênh log hiện tại: <#${logChannel.id}>`
          : 'Kênh log đã cài đặt không còn tồn tại. Vui lòng cài đặt lại.')
        .addFields(
          { name: 'Log hành động moderation', value: logSettings.modActionLogs !== false ? '✅ Bật' : '❌ Tắt', inline: true },
          { name: 'Log giám sát chat', value: logSettings.monitorLogs !== false ? '✅ Bật' : '❌ Tắt', inline: true }
        )
        .setFooter({ text: `Server: ${interaction.guild.name}` })
        .setTimestamp();
      
      if (logSettings.updatedBy) {
        logEmbed.addFields(
          { name: 'Người cài đặt', value: `<@${logSettings.updatedBy}>`, inline: true },
          { name: 'Thời gian cài đặt', value: logSettings.updatedAt 
            ? `<t:${Math.floor(new Date(logSettings.updatedAt).getTime() / 1000)}:R>` 
            : 'Không rõ', 
            inline: true 
          }
        );
      }
      
      logEmbed.addFields({
        name: 'Cách cài đặt lại',
        value: 'Sử dụng lệnh `/setlogchannel` để thay đổi kênh log hoặc cài đặt lại.',
        inline: false
      });
      
      await interaction.editReply({ embeds: [logEmbed] });
      
    } catch (error) {
      logger.error('MODERATION', 'Lỗi khi xem cài đặt kênh log:', error);
      await interaction.editReply({ 
        content: `Đã xảy ra lỗi khi xem cài đặt kênh log: ${error.message}`, 
        ephemeral: true 
      });
    }
  },
};
