const { EmbedBuilder } = require('discord.js');
const NeuralNetworks = require('./NeuralNetworks.js');
const mongoClient = require('./mongoClient.js');

class MessageMonitor {
  constructor() {
    this.monitorSettings = new Map();
    this.isInitialized = false;
  }

  /**
   * Khởi tạo hệ thống giám sát tin nhắn
   * @param {Discord.Client} client - Discord client
   */
  async initialize(client) {
    if (this.isInitialized) return;

    this.client = client;

    try {
      // Tải cài đặt giám sát từ cơ sở dữ liệu
      await this.loadMonitorSettings();

      // Đăng ký sự kiện messageCreate
      client.on('messageCreate', this.handleMessage.bind(this));

      this.isInitialized = true;
      console.log('Đã khởi tạo hệ thống giám sát tin nhắn');
    } catch (error) {
      console.error('Lỗi khi khởi tạo hệ thống giám sát tin nhắn:', error);
    }
  }

  /**
   * Tải cài đặt giám sát từ cơ sở dữ liệu
   */
  async loadMonitorSettings() {
    try {
      const db = mongoClient.getDb();

      // Tạo collection nếu chưa tồn tại
      try {
        await db.createCollection('monitor_settings');
        await db.createCollection('monitor_logs');
      } catch (error) {
        // Bỏ qua lỗi nếu collection đã tồn tại
      }

      // Lấy tất cả cài đặt giám sát
      const settings = await db.collection('monitor_settings').find({ enabled: true }).toArray();

      // Lưu vào Map
      for (const setting of settings) {
        this.monitorSettings.set(setting.guildId, {
          enabled: true,
          promptTemplate: setting.promptTemplate,
          rules: setting.rules,
          ignoredChannels: setting.ignoredChannels || [],
          ignoredRoles: setting.ignoredRoles || []
        });
      }

      console.log(`Đã tải ${settings.length} cài đặt giám sát từ cơ sở dữ liệu`);
    } catch (error) {
      console.error('Lỗi khi tải cài đặt giám sát:', error);
    }
  }

  /**
   * Xử lý tin nhắn mới
   * @param {Discord.Message} message - Tin nhắn cần xử lý
   */
  async handleMessage(message) {
    // Bỏ qua tin nhắn từ bot và tin nhắn không phải từ guild
    if (message.author.bot || !message.guild) return;

    // Kiểm tra xem guild có bật giám sát không
    const settings = this.monitorSettings.get(message.guild.id);
    if (!settings || !settings.enabled) return;

    // Kiểm tra xem kênh có bị bỏ qua không
    if (settings.ignoredChannels.includes(message.channel.id)) return;

    // Kiểm tra xem người dùng có vai trò được bỏ qua không
    const member = message.member;
    if (member && settings.ignoredRoles.some(roleId => member.roles.cache.has(roleId))) return;

    try {
      // Phân tích tin nhắn bằng NeuralNetworks
      await this.analyzeMessage(message, settings.promptTemplate);
    } catch (error) {
      console.error('Lỗi khi phân tích tin nhắn:', error);
    }
  }

  /**
   * Phân tích tin nhắn bằng NeuralNetworks
   * @param {Discord.Message} message - Tin nhắn cần phân tích
   * @param {string} promptTemplate - Mẫu prompt để phân tích
   */
  async analyzeMessage(message, promptTemplate) {
    try {
      const db = mongoClient.getDb();

      // Bỏ qua tin nhắn quá ngắn
      if (message.content.length < 5) return;

      // Thay thế placeholder trong template
      const prompt = promptTemplate.replace('{{message}}', message.content);

      // Gọi NeuralNetworks để phân tích
      const analysis = await NeuralNetworks.getCompletion(prompt);

      // Phân tích kết quả
      const results = this.parseAnalysisResults(analysis);

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
        await this.handleViolation(message, results);
      }

    } catch (error) {
      console.error('Lỗi khi phân tích tin nhắn:', error);
    }
  }

  /**
   * Phân tích kết quả từ NeuralNetworks
   * @param {string} analysis - Kết quả phân tích từ NeuralNetworks
   * @returns {Object} - Kết quả đã phân tích
   */
  parseAnalysisResults(analysis) {
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
   * @param {Discord.Message} message - Tin nhắn vi phạm
   * @param {Object} results - Kết quả phân tích
   */
  async handleViolation(message, results) {
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

      // Kiểm tra cài đặt kênh log từ cơ sở dữ liệu
      const db = mongoClient.getDb();
      const logSettings = await db.collection('mod_settings').findOne({
        guildId: message.guild.id
      });

      let logChannel = null;

      // Nếu có cài đặt kênh log và monitorLogs được bật
      if (logSettings && logSettings.logChannelId && logSettings.monitorLogs !== false) {
        try {
          logChannel = await message.guild.channels.fetch(logSettings.logChannelId);
        } catch (error) {
          console.error(`Không thể tìm thấy kênh log ${logSettings.logChannelId}:`, error);
        }
      }

      // Nếu không có kênh log được cài đặt, tìm kênh mặc định
      if (!logChannel) {
        logChannel = message.guild.channels.cache.find(
          channel => channel.name.includes('mod-logs') ||
                    channel.name.includes('mod-chat') ||
                    channel.name.includes('admin') ||
                    channel.name.includes('bot-logs')
        );
      }

      // Gửi thông báo đến kênh log
      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({ embeds: [violationEmbed] });
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

  /**
   * Bật giám sát cho một guild
   * @param {string} guildId - ID của guild
   * @param {Object} settings - Cài đặt giám sát
   */
  enableMonitoring(guildId, settings) {
    this.monitorSettings.set(guildId, {
      enabled: true,
      promptTemplate: settings.promptTemplate,
      rules: settings.rules,
      ignoredChannels: settings.ignoredChannels || [],
      ignoredRoles: settings.ignoredRoles || []
    });

    console.log(`Đã bật giám sát cho guild ${guildId}`);
  }

  /**
   * Tắt giám sát cho một guild
   * @param {string} guildId - ID của guild
   */
  disableMonitoring(guildId) {
    const settings = this.monitorSettings.get(guildId);
    if (settings) {
      settings.enabled = false;
      this.monitorSettings.set(guildId, settings);
      console.log(`Đã tắt giám sát cho guild ${guildId}`);
    }
  }

  /**
   * Kiểm tra trạng thái giám sát của một guild
   * @param {string} guildId - ID của guild
   * @returns {Object|null} - Cài đặt giám sát hoặc null nếu không có
   */
  getMonitoringStatus(guildId) {
    return this.monitorSettings.get(guildId) || null;
  }
}

// Tạo và xuất instance duy nhất
const messageMonitor = new MessageMonitor();
module.exports = messageMonitor;
