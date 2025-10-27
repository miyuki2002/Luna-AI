const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const mongoClient = require('../../services/mongoClient.js');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogchannel')
    .setDescription('Thiết lập kênh gửi log cho các lệnh moderation')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Kênh để gửi log moderation')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('monitor').setDescription('Áp dụng cho log giám sát chat').setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('modactions')
        .setDescription('Áp dụng cho log hành động moderation (mute/ban/kick)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'Bạn không có quyền thiết lập kênh log!',
        ephemeral: true,
      });
    }

    const logChannel = interaction.options.getChannel('channel');
    const monitorLogs = interaction.options.getBoolean('monitor') ?? true;
    const modActionLogs = interaction.options.getBoolean('modactions') ?? true;

    await interaction.deferReply();

    try {
      const db = mongoClient.getDb();

      try {
        await db.createCollection('mod_settings');
      } catch (error) {}

      const logSettings = {
        guildId: interaction.guild.id,
        logChannelId: logChannel.id,
        monitorLogs: monitorLogs,
        modActionLogs: modActionLogs,
        updatedAt: new Date(),
        updatedBy: interaction.user.id,
      };

      await db
        .collection('mod_settings')
        .updateOne({ guildId: interaction.guild.id }, { $set: logSettings }, { upsert: true });

      const settingsEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Đã thiết lập kênh log moderation')
        .setDescription(`Tất cả log moderation sẽ được gửi đến kênh ${logChannel}.`)
        .addFields(
          { name: 'Kênh log', value: `<#${logChannel.id}>`, inline: true },
          { name: 'Log giám sát chat', value: monitorLogs ? '✅ Bật' : '❌ Tắt', inline: true },
          { name: 'Log hành động mod', value: modActionLogs ? '✅ Bật' : '❌ Tắt', inline: true },
          { name: 'Người thiết lập', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setFooter({ text: `Server: ${interaction.guild.name}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [settingsEmbed] });

      const testEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🔔 Kiểm tra kênh log moderation')
        .setDescription(
          'Đây là tin nhắn kiểm tra để xác nhận kênh log moderation đã được thiết lập đúng.'
        )
        .addFields(
          { name: 'Trạng thái', value: '✅ Hoạt động', inline: true },
          { name: 'Thiết lập bởi', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setFooter({ text: `Server: ${interaction.guild.name}` })
        .setTimestamp();

      await logChannel.send({ embeds: [testEmbed] });
    } catch (error) {
      logger.error('MODERATION', 'Lỗi khi thiết lập kênh log:', error);
      await interaction.editReply({
        content: `Đã xảy ra lỗi khi thiết lập kênh log: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};
