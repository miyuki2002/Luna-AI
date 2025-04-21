const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const NeuralNetworks = require('../../services/NeuralNetworks.js');
const mongoClient = require('../../services/mongoClient.js');
const messageMonitor = require('../../services/messageMonitor.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monitor')
    .setDescription('Bật/tắt chế độ giám sát chat tự động')
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Bật chế độ giám sát chat tự động')
        .addStringOption(option =>
          option.setName('rules')
            .setDescription('Các quy tắc cần giám sát (phân cách bằng dấu phẩy)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Tắt chế độ giám sát chat tự động'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Xem trạng thái giám sát hiện tại'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('logs')
        .setDescription('Xem nhật ký vi phạm')
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Số lượng vi phạm hiển thị (mặc định: 10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    // Kiểm tra quyền
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({
        content: 'Bạn không có quyền sử dụng lệnh này!',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    await interaction.deferReply();

    try {
      const db = mongoClient.getDb();

      // Tạo collection monitor_settings nếu chưa tồn tại
      try {
        await db.createCollection('monitor_settings');
        await db.createCollection('monitor_logs');
      } catch (error) {
        // Bỏ qua lỗi nếu collection đã tồn tại
      }

      switch (subcommand) {
        case 'enable':
          await handleEnableMonitor(interaction, db);
          break;
        case 'disable':
          await handleDisableMonitor(interaction, db);
          break;
        case 'status':
          await handleMonitorStatus(interaction, db);
          break;
        case 'logs':
          await handleMonitorLogs(interaction, db);
          break;
      }
    } catch (error) {
      console.error('Lỗi khi thực hiện lệnh monitor:', error);
      await interaction.editReply({
        content: `Đã xảy ra lỗi khi thực hiện lệnh: ${error.message}`,
        ephemeral: true
      });
    }
  },
};

/**
 * Xử lý bật chế độ giám sát
 */
async function handleEnableMonitor(interaction, db) {
  const rules = interaction.options.getString('rules');
  const rulesList = rules.split(',').map(rule => rule.trim());

  // Tạo prompt mẫu để kiểm tra vi phạm
  const promptTemplate = `Đánh giá tin nhắn sau đây và xác định xem nó có vi phạm bất kỳ quy tắc nào trong số các quy tắc sau không:
${rulesList.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}

Tin nhắn: "{{message}}"

Phân tích chi tiết:
1. Tin nhắn có vi phạm quy tắc nào không? Nếu có, chỉ rõ quy tắc nào.
2. Mức độ nghiêm trọng của vi phạm (nếu có): Thấp, Trung bình, Cao
3. Tin nhắn có dấu hiệu của tài khoản giả mạo/bot không? Nếu có, giải thích lý do.
4. Đề xuất hành động: Không cần hành động, Cảnh báo, Xóa tin nhắn, Mute, Kick, Ban

Trả lời ngắn gọn theo định dạng chính xác sau:
VIOLATION: Có/Không
RULE: [Số thứ tự quy tắc hoặc "Không có"]
SEVERITY: Thấp/Trung bình/Cao/Không có
FAKE: Có/Không
ACTION: Không cần hành động/Cảnh báo/Xóa tin nhắn/Mute/Kick/Ban
REASON: [Giải thích ngắn gọn]`;

  // Lưu cài đặt giám sát vào cơ sở dữ liệu
  const monitorSettings = {
    guildId: interaction.guild.id,
    enabled: true,
    rules: rulesList,
    promptTemplate: promptTemplate,
    enabledAt: new Date(),
    enabledBy: interaction.user.id,
    ignoredChannels: [],
    ignoredRoles: []
  };

  await db.collection('monitor_settings').updateOne(
    { guildId: interaction.guild.id },
    { $set: monitorSettings },
    { upsert: true }
  );

  // Tạo embed thông báo
  const enableEmbed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('🔍 Đã bật chế độ giám sát chat tự động')
    .setDescription('Bot sẽ giám sát tất cả tin nhắn trong server để phát hiện vi phạm quy tắc và tài khoản giả mạo.')
    .addFields(
      { name: 'Quy tắc giám sát', value: rulesList.map((rule, index) => `${index + 1}. ${rule}`).join('\n') },
      { name: 'Người bật', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
    )
    .setFooter({ text: 'Sử dụng /monitor disable để tắt chế độ giám sát' })
    .setTimestamp();

  // Bật giám sát tin nhắn sử dụng messageMonitor service
  messageMonitor.enableMonitoring(interaction.guild.id, {
    promptTemplate,
    rules: rulesList,
    ignoredChannels: [],
    ignoredRoles: []
  });

  await interaction.editReply({ embeds: [enableEmbed] });
}

/**
 * Xử lý tắt chế độ giám sát
 */
async function handleDisableMonitor(interaction, db) {
  // Kiểm tra xem chế độ giám sát có đang bật không
  const monitorSettings = await db.collection('monitor_settings').findOne({ guildId: interaction.guild.id });

  if (!monitorSettings || !monitorSettings.enabled) {
    return interaction.editReply({
      content: 'Chế độ giám sát chat tự động chưa được bật cho server này.',
      ephemeral: true
    });
  }

  // Tắt chế độ giám sát
  await db.collection('monitor_settings').updateOne(
    { guildId: interaction.guild.id },
    {
      $set: {
        enabled: false,
        disabledAt: new Date(),
        disabledBy: interaction.user.id
      }
    }
  );

  // Tạo embed thông báo
  const disableEmbed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('🚫 Đã tắt chế độ giám sát chat tự động')
    .setDescription('Bot sẽ không còn giám sát tin nhắn trong server.')
    .addFields(
      { name: 'Người tắt', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
    )
    .setFooter({ text: 'Sử dụng /monitor enable để bật lại chế độ giám sát' })
    .setTimestamp();

  // Tắt giám sát tin nhắn sử dụng messageMonitor service
  messageMonitor.disableMonitoring(interaction.guild.id);

  await interaction.editReply({ embeds: [disableEmbed] });
}

/**
 * Xử lý xem trạng thái giám sát
 */
async function handleMonitorStatus(interaction, db) {
  // Lấy cài đặt giám sát từ cơ sở dữ liệu
  const monitorSettings = await db.collection('monitor_settings').findOne({ guildId: interaction.guild.id });

  if (!monitorSettings) {
    return interaction.editReply({
      content: 'Chế độ giám sát chat tự động chưa được thiết lập cho server này.',
      ephemeral: true
    });
  }

  // Đếm số lượng vi phạm đã phát hiện
  const violationCount = await db.collection('monitor_logs').countDocuments({
    guildId: interaction.guild.id,
    isViolation: true
  });

  // Tạo embed thông báo
  const statusEmbed = new EmbedBuilder()
    .setColor(monitorSettings.enabled ? 0x00FF00 : 0xFF0000)
    .setTitle(`📊 Trạng thái giám sát chat tự động: ${monitorSettings.enabled ? 'Đang bật' : 'Đã tắt'}`)
    .setDescription(monitorSettings.enabled
      ? 'Bot đang giám sát tất cả tin nhắn trong server để phát hiện vi phạm quy tắc và tài khoản giả mạo.'
      : 'Bot hiện không giám sát tin nhắn trong server.')
    .addFields(
      { name: 'Quy tắc giám sát', value: monitorSettings.rules.map((rule, index) => `${index + 1}. ${rule}`).join('\n') },
      { name: 'Vi phạm đã phát hiện', value: `${violationCount}`, inline: true },
      { name: 'Trạng thái', value: monitorSettings.enabled ? '✅ Đang hoạt động' : '❌ Đã tắt', inline: true }
    )
    .setFooter({ text: `Cập nhật lần cuối: ${new Date().toLocaleString('vi-VN')}` })
    .setTimestamp();

  if (monitorSettings.enabled) {
    statusEmbed.addFields(
      { name: 'Người bật', value: `<@${monitorSettings.enabledBy}>`, inline: true },
      { name: 'Thời gian bật', value: `<t:${Math.floor(new Date(monitorSettings.enabledAt).getTime() / 1000)}:R>`, inline: true }
    );
  } else if (monitorSettings.disabledAt) {
    statusEmbed.addFields(
      { name: 'Người tắt', value: `<@${monitorSettings.disabledBy}>`, inline: true },
      { name: 'Thời gian tắt', value: `<t:${Math.floor(new Date(monitorSettings.disabledAt).getTime() / 1000)}:R>`, inline: true }
    );
  }

  await interaction.editReply({ embeds: [statusEmbed] });
}

/**
 * Xử lý xem nhật ký vi phạm
 */
async function handleMonitorLogs(interaction, db) {
  const limit = interaction.options.getInteger('limit') || 10;

  // Lấy danh sách vi phạm từ cơ sở dữ liệu
  const violations = await db.collection('monitor_logs')
    .find({
      guildId: interaction.guild.id,
      isViolation: true
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();

  if (violations.length === 0) {
    return interaction.editReply({
      content: 'Chưa phát hiện vi phạm nào trong server này.',
      ephemeral: false
    });
  }

  // Tạo embed thông báo
  const logsEmbed = new EmbedBuilder()
    .setColor(0xFF9900)
    .setTitle(`📋 Nhật ký vi phạm (${violations.length} gần nhất)`)
    .setDescription('Danh sách các vi phạm đã được phát hiện bởi hệ thống giám sát tự động.')
    .setFooter({ text: `Server: ${interaction.guild.name}` })
    .setTimestamp();

  // Thêm các vi phạm vào embed
  for (const violation of violations) {
    const date = new Date(violation.timestamp).toLocaleDateString('vi-VN');
    const time = new Date(violation.timestamp).toLocaleTimeString('vi-VN');

    // Lấy thông tin người vi phạm
    let user = 'Không rõ';
    try {
      const userObj = await interaction.client.users.fetch(violation.userId);
      user = userObj.tag;
    } catch (error) {
      user = `Không rõ (ID: ${violation.userId})`;
    }

    // Định dạng mức độ vi phạm
    const severityColors = {
      'Thấp': '🟢',
      'Trung bình': '🟡',
      'Cao': '🔴'
    };

    const severityIcon = severityColors[violation.severity] || '⚪';

    logsEmbed.addFields({
      name: `${severityIcon} Vi phạm - ${date} ${time}`,
      value: `**Người dùng:** ${user}\n**Quy tắc vi phạm:** ${violation.violatedRule}\n**Mức độ:** ${violation.severity}\n**Đề xuất:** ${violation.recommendation}\n**Lý do:** ${violation.reason}\n**Tin nhắn:** ${violation.message.substring(0, 100)}${violation.message.length > 100 ? '...' : ''}`
    });
  }

  await interaction.editReply({ embeds: [logsEmbed] });
}


