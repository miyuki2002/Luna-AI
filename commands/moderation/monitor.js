const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const NeuralNetworks = require('../../services/NeuralNetworks.js');
const mongoClient = require('../../services/mongoClient.js');

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

Trả lời ngắn gọn theo định dạng:
VI_PHẠM: Có/Không
QUY_TẮC_VI_PHẠM: [Số thứ tự quy tắc hoặc "Không có"]
MỨC_ĐỘ: Thấp/Trung bình/Cao/Không có
DẤU_HIỆU_GIẢ_MẠO: Có/Không
ĐỀ_XUẤT: Không cần hành động/Cảnh báo/Xóa tin nhắn/Mute/Kick/Ban
LÝ_DO: [Giải thích ngắn gọn]`;

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
  
  // Đăng ký sự kiện messageCreate để giám sát tin nhắn
  setupMessageMonitoring(interaction.client, promptTemplate, interaction.guild.id, rulesList);
  
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
  
  // Hủy đăng ký sự kiện messageCreate
  disableMessageMonitoring(interaction.client, interaction.guild.id);
  
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

/**
 * Thiết lập giám sát tin nhắn
 */
function setupMessageMonitoring(client, promptTemplate, guildId, rules) {
  // Lưu thông tin giám sát vào client để sử dụng trong sự kiện messageCreate
  if (!client.monitorSettings) {
    client.monitorSettings = new Map();
  }
  
  client.monitorSettings.set(guildId, {
    enabled: true,
    promptTemplate,
    rules
  });
  
  // Đảm bảo rằng sự kiện messageCreate chỉ được đăng ký một lần
  if (!client.monitoringSetup) {
    client.on('messageCreate', async (message) => {
      // Bỏ qua tin nhắn từ bot và tin nhắn không phải từ guild
      if (message.author.bot || !message.guild) return;
      
      // Kiểm tra xem guild có bật giám sát không
      const settings = client.monitorSettings.get(message.guild.id);
      if (!settings || !settings.enabled) return;
      
      try {
        // Phân tích tin nhắn bằng NeuralNetworks
        await analyzeMessage(message, settings.promptTemplate);
      } catch (error) {
        console.error('Lỗi khi phân tích tin nhắn:', error);
      }
    });
    
    client.monitoringSetup = true;
    console.log('Đã thiết lập giám sát tin nhắn');
  }
}

/**
 * Hủy giám sát tin nhắn cho một guild cụ thể
 */
function disableMessageMonitoring(client, guildId) {
  if (client.monitorSettings) {
    const settings = client.monitorSettings.get(guildId);
    if (settings) {
      settings.enabled = false;
      client.monitorSettings.set(guildId, settings);
      console.log(`Đã tắt giám sát tin nhắn cho guild ${guildId}`);
    }
  }
}

/**
 * Phân tích tin nhắn bằng NeuralNetworks
 */
async function analyzeMessage(message, promptTemplate) {
  try {
    const db = mongoClient.getDb();
    
    // Thay thế placeholder trong template
    const prompt = promptTemplate.replace('{{message}}', message.content);
    
    // Gọi NeuralNetworks để phân tích
    const analysis = await NeuralNetworks.getCompletion(prompt);
    
    // Phân tích kết quả
    const results = parseAnalysisResults(analysis);
    
    // Lưu kết quả vào cơ sở dữ liệu
    const logEntry = {
      guildId: message.guild.id,
      channelId: message.channel.id,
      messageId: message.id,
      userId: message.author.id,
      message: message.content,
      timestamp: new Date(),
      isViolation: results.isViolation,
      violatedRule: results.violatedRule,
      severity: results.severity,
      isFakeAccount: results.isFakeAccount,
      recommendation: results.recommendation,
      reason: results.reason,
      rawAnalysis: analysis
    };
    
    await db.collection('monitor_logs').insertOne(logEntry);
    
    // Nếu phát hiện vi phạm, thông báo cho các kênh mod
    if (results.isViolation) {
      await handleViolation(message, results);
    }
    
  } catch (error) {
    console.error('Lỗi khi phân tích tin nhắn:', error);
  }
}

/**
 * Phân tích kết quả từ NeuralNetworks
 */
function parseAnalysisResults(analysis) {
  // Mặc định không vi phạm
  const defaultResults = {
    isViolation: false,
    violatedRule: 'Không có',
    severity: 'Không có',
    isFakeAccount: false,
    recommendation: 'Không cần hành động',
    reason: 'Không có vi phạm'
  };
  
  try {
    // Tìm các trường trong phân tích
    const violationMatch = analysis.match(/VI_PHẠM:\s*(Có|Không)/i);
    const ruleMatch = analysis.match(/QUY_TẮC_VI_PHẠM:\s*(.+?)(?=\n|$)/i);
    const severityMatch = analysis.match(/MỨC_ĐỘ:\s*(Thấp|Trung bình|Cao|Không có)/i);
    const fakeMatch = analysis.match(/DẤU_HIỆU_GIẢ_MẠO:\s*(Có|Không)/i);
    const recommendationMatch = analysis.match(/ĐỀ_XUẤT:\s*(.+?)(?=\n|$)/i);
    const reasonMatch = analysis.match(/LÝ_DO:\s*(.+?)(?=\n|$)/i);
    
    // Xác định có vi phạm không
    const isViolation = violationMatch && violationMatch[1].toLowerCase() === 'có';
    
    // Nếu không vi phạm, trả về kết quả mặc định
    if (!isViolation) return defaultResults;
    
    // Trả về kết quả phân tích
    return {
      isViolation,
      violatedRule: ruleMatch ? ruleMatch[1].trim() : 'Không xác định',
      severity: severityMatch ? severityMatch[1].trim() : 'Không xác định',
      isFakeAccount: fakeMatch && fakeMatch[1].toLowerCase() === 'có',
      recommendation: recommendationMatch ? recommendationMatch[1].trim() : 'Không xác định',
      reason: reasonMatch ? reasonMatch[1].trim() : 'Không có lý do cụ thể'
    };
  } catch (error) {
    console.error('Lỗi khi phân tích kết quả:', error);
    return defaultResults;
  }
}

/**
 * Xử lý vi phạm
 */
async function handleViolation(message, results) {
  try {
    // Tạo embed thông báo vi phạm
    const violationEmbed = new EmbedBuilder()
      .setColor(
        results.severity === 'Cao' ? 0xFF0000 :
        results.severity === 'Trung bình' ? 0xFFA500 : 0xFFFF00
      )
      .setTitle(`🚨 Phát hiện vi phạm ${results.isFakeAccount ? '(Có dấu hiệu tài khoản giả mạo)' : ''}`)
      .setDescription(`Bot đã phát hiện một tin nhắn vi phạm quy tắc server.`)
      .addFields(
        { name: 'Người dùng', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
        { name: 'Kênh', value: `<#${message.channel.id}>`, inline: true },
        { name: 'Thời gian', value: `<t:${Math.floor(message.createdTimestamp / 1000)}:F>`, inline: true },
        { name: 'Quy tắc vi phạm', value: results.violatedRule, inline: true },
        { name: 'Mức độ', value: results.severity, inline: true },
        { name: 'Đề xuất', value: results.recommendation, inline: true },
        { name: 'Lý do', value: results.reason },
        { name: 'Nội dung tin nhắn', value: message.content.length > 1024 ? message.content.substring(0, 1021) + '...' : message.content }
      )
      .setFooter({ text: `Message ID: ${message.id}` })
      .setTimestamp();
    
    // Thêm nút hành động (trong phiên bản tương lai)
    
    // Tìm kênh mod-logs hoặc mod-chat để gửi thông báo
    const modChannel = message.guild.channels.cache.find(
      channel => channel.name.includes('mod-logs') || 
                channel.name.includes('mod-chat') || 
                channel.name.includes('admin') ||
                channel.name.includes('bot-logs')
    );
    
    if (modChannel && modChannel.isTextBased()) {
      await modChannel.send({ embeds: [violationEmbed] });
    }
    
    // Thực hiện hành động tự động dựa trên đề xuất (nếu cần)
    if (results.severity === 'Cao' && results.recommendation.includes('Xóa tin nhắn')) {
      try {
        await message.delete();
        console.log(`Đã xóa tin nhắn vi phạm từ ${message.author.tag}`);
      } catch (error) {
        console.error('Không thể xóa tin nhắn:', error);
      }
    }
    
  } catch (error) {
    console.error('Lỗi khi xử lý vi phạm:', error);
  }
}
