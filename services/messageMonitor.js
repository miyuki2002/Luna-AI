const NeuralNetworks = require('./NeuralNetworks.js');
const mongoClient = require('./mongoClient.js');
const { handleViolation } = require('./violationHandler.js');
const logger = require('../utils/logger.js');

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
    if (this.isInitialized) {
      console.log('Hệ thống giám sát tin nhắn đã được khởi tạo trước đó');
      return;
    }

    // Lưu tham chiếu đến client
    this.client = client;
    console.log(`[MONITOR] Đang khởi tạo hệ thống giám sát tin nhắn với client ID: ${client.user.id}`);

    try {
      // Tải cài đặt giám sát từ cơ sở dữ liệu
      console.log('[MONITOR] Đang tải cài đặt giám sát từ cơ sở dữ liệu...');
      await this.loadMonitorSettings();

      // Đăng ký sự kiện messageCreate riêng cho chức năng monitor
      // Sử dụng Events.MessageCreate thay vì 'messageCreate' để đồng bộ với cách đăng ký sự kiện trong index.js
      console.log('[MONITOR] Đang đăng ký sự kiện MessageCreate cho chức năng giám sát...');
      const { Events } = require('discord.js');
      client.on(Events.MessageCreate, this.handleMessage.bind(this));
      console.log('[MONITOR] Đã đăng ký sự kiện MessageCreate thành công');

      // Đánh dấu đã khởi tạo
      this.isInitialized = true;
      console.log('✅ Đã khởi tạo hệ thống giám sát tin nhắn thành công');
      console.log(`🔑 Bot ID: ${client.user.id}`);
      console.log('📝 Chức năng monitor sẽ đọc tất cả tin nhắn khi được bật');
      console.log('🔔 Chức năng monitor và trò chuyện sẽ hoạt động song song');
    } catch (error) {
      console.error('❌ Lỗi khi khởi tạo hệ thống giám sát tin nhắn:', error);
    }
  }

  /**
   * Tải cài đặt giám sát từ cơ sở dữ liệu
   */
  async loadMonitorSettings() {
    try {
      console.log('[MONITOR] Đang kết nối đến cơ sở dữ liệu MongoDB...');
      const db = mongoClient.getDb();
      console.log('[MONITOR] Đã kết nối đến cơ sở dữ liệu MongoDB thành công');

      // Tạo collection nếu chưa tồn tại
      try {
        console.log('[MONITOR] Đang tạo các collection cần thiết...');
        await db.createCollection('monitor_settings');
        await db.createCollection('monitor_logs');
        console.log('[MONITOR] Đã tạo các collection cần thiết thành công');
      } catch (error) {
        // Bỏ qua lỗi nếu collection đã tồn tại
        console.log('[MONITOR] Các collection đã tồn tại, tiếp tục...');
      }

      // Lấy tất cả cài đặt giám sát
      console.log('[MONITOR] Đang tải cài đặt giám sát từ cơ sở dữ liệu...');
      const settings = await db.collection('monitor_settings').find({ enabled: true }).toArray();
      console.log(`[MONITOR] Tìm thấy ${settings.length} cài đặt giám sát đang bật`);

      // Lưu vào Map
      for (const setting of settings) {
        console.log(`[MONITOR] Đang tải cài đặt cho guild ${setting.guildId}...`);
        this.monitorSettings.set(setting.guildId, {
          enabled: true,
          promptTemplate: setting.promptTemplate,
          rules: setting.rules,
          ignoredChannels: setting.ignoredChannels || [],
          ignoredRoles: setting.ignoredRoles || []
        });
        console.log(`[MONITOR] Đã tải cài đặt cho guild ${setting.guildId} thành công`);
        console.log(`[MONITOR] Số quy tắc: ${setting.rules.length}, Số kênh bỏ qua: ${(setting.ignoredChannels || []).length}, Số vai trò bỏ qua: ${(setting.ignoredRoles || []).length}`);
      }

      console.log(`✅ Đã tải ${settings.length} cài đặt giám sát từ cơ sở dữ liệu thành công`);
    } catch (error) {
      console.error('❌ Lỗi khi tải cài đặt giám sát:', error);
    }
  }

  /**
   * Xử lý tin nhắn mới cho chức năng monitor
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

    // Kiểm tra xem tin nhắn có phải là lệnh không
    if (message.content.startsWith('/')) return;

    // Bỏ qua tin nhắn tag bot để tránh xung đột với chức năng trò chuyện
    // Chức năng trò chuyện sẽ được ưu tiên khi bot được tag
    if (this.client && message.mentions.has(this.client.user)) {
      console.log(`[MONITOR] Bỏ qua tin nhắn tag bot từ ${message.author.tag}`);
      return;
    }

    // Kiểm tra nội dung tin nhắn có chứa quy tắc cấm không
    if (settings && settings.rules) {
      // Kiểm tra trực tiếp nội dung tin nhắn có chứa quy tắc cấm không
      const lowerCaseContent = message.content.toLowerCase();
      const violatedRule = settings.rules.find(rule => {
        const lowerCaseRule = rule.toLowerCase();
        if (lowerCaseRule.startsWith('không chat') || lowerCaseRule.startsWith('không nói')) {
          const bannedWord = lowerCaseRule.replace('không chat', '').replace('không nói', '').trim();
          return lowerCaseContent.includes(bannedWord);
        }
        return false;
      });

      if (violatedRule) {
        console.log(`[MONITOR] Phát hiện vi phạm trực tiếp: ${violatedRule} trong tin nhắn: "${message.content}"`);

        // Tạo kết quả vi phạm trực tiếp
        const directViolationResults = {
          isViolation: true,
          violatedRule: violatedRule,
          severity: 'Trung bình',
          isFakeAccount: false,
          recommendation: 'Cảnh báo',
          reason: `Tin nhắn chứa nội dung bị cấm: ${violatedRule}`
        };

        // Lưu kết quả vào cơ sở dữ liệu
        const db = mongoClient.getDb();
        const logEntry = {
          guildId: message.guild.id,
          channelId: message.channel.id,
          messageId: message.id,
          userId: message.author.id,
          message: message.content,
          timestamp: new Date(),
          isViolation: true,
          violatedRule: violatedRule,
          severity: 'Trung bình',
          isFakeAccount: false,
          recommendation: 'Cảnh báo',
          reason: `Tin nhắn chứa nội dung bị cấm: ${violatedRule}`,
          rawAnalysis: 'VIOLATION: Có\nRULE: ' + violatedRule + '\nSEVERITY: Trung bình\nFAKE: Không\nACTION: Cảnh báo\nREASON: Phát hiện trực tiếp bởi hệ thống'
        };

        db.collection('monitor_logs').insertOne(logEntry);

        // Xử lý vi phạm
        this.handleViolation(message, directViolationResults);
        return; // Dừng xử lý, không cần gọi API
      }
    }

    // Kiểm tra xem tin nhắn có phải là tin nhắn cảnh báo từ bot không
    if (this.client && this.client.user) {
      if (message.content.startsWith(`<@${this.client.user.id}> **CẢNH BÁO`)) return;
      if (message.content.startsWith(`<@${this.client.user.id}> **Lưu ý`)) return;
    } else if (message.content.includes('**CẢNH BÁO') || message.content.includes('**Lưu ý')) {
      // Nếu không có client.user, kiểm tra bằng cách khác
      return;
    }

    // Ghi log để debug chi tiết hơn
    console.log(`[MONITOR] Đang phân tích tin nhắn từ ${message.author.tag}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`);
    console.log(`[MONITOR] Guild ID: ${message.guild.id}, Channel ID: ${message.channel.id}`);
    console.log(`[MONITOR] Trạng thái giám sát: ${settings.enabled ? 'Đang bật' : 'Đã tắt'}`);
    console.log(`[MONITOR] Quy tắc giám sát: ${settings.rules.join(', ')}`);
    console.log(`[MONITOR] Số kênh bỏ qua: ${settings.ignoredChannels.length}, Số vai trò bỏ qua: ${settings.ignoredRoles.length}`);

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

      // Ghi log tin nhắn để debug
      console.log(`[MONITOR-ANALYZE] Đang phân tích tin nhắn: "${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}"`);
      console.log(`[MONITOR-ANALYZE] Quy tắc: ${this.monitorSettings.get(message.guild.id).rules.join(', ')}`);

      // Thay thế placeholder trong template
      const prompt = promptTemplate.replace('{{message}}', message.content);

      // Gọi NeuralNetworks để phân tích sử dụng phương thức riêng cho giám sát
      const analysis = await NeuralNetworks.getMonitoringAnalysis(prompt);

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
        console.log(`[MONITOR-ANALYZE] Đã phát hiện vi phạm! Xử lý vi phạm...`);
        await this.handleViolation(message, results);
      } else {
        console.log(`[MONITOR-ANALYZE] Không phát hiện vi phạm.`);
      }

    } catch (error) {
      console.error('[MONITOR-ANALYZE] Lỗi khi phân tích tin nhắn:', error);
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
      // Ghi log phân tích để debug
      console.log(`[MONITOR-PARSE] Phân tích kết quả: ${analysis.substring(0, 100)}${analysis.length > 100 ? '...' : ''}`);

      // Tìm các trường trong phân tích (sử dụng tiếng Anh)
      const violationMatch = analysis.match(/VIOLATION:\s*(Có|Không)/i);
      const ruleMatch = analysis.match(/RULE:\s*(.+?)(?=\n|$)/i);
      const severityMatch = analysis.match(/SEVERITY:\s*(Thấp|Trung bình|Cao|Không có)/i);
      const fakeMatch = analysis.match(/FAKE:\s*(Có|Không)/i);
      const recommendationMatch = analysis.match(/ACTION:\s*(.+?)(?=\n|$)/i);
      const reasonMatch = analysis.match(/REASON:\s*(.+?)(?=\n|$)/i);

      // Thử tìm các trường trong phân tích (sử dụng tiếng Việt - cho trường hợp cũ)
      const oldViolationMatch = !violationMatch ? analysis.match(/VI_PHẠM:\s*(Có|Không)/i) : null;
      const oldRuleMatch = !ruleMatch ? analysis.match(/QUY_TẮC_VI_PHẠM:\s*(.+?)(?=\n|$)/i) : null;
      const oldSeverityMatch = !severityMatch ? analysis.match(/MỨC_ĐỘ:\s*(Thấp|Trung bình|Cao|Không có)/i) : null;
      const oldFakeMatch = !fakeMatch ? analysis.match(/DẤU_HIỆU_GIẢ_MẠO:\s*(Có|Không)/i) : null;
      const oldRecommendationMatch = !recommendationMatch ? analysis.match(/ĐỀ_XUẤT:\s*(.+?)(?=\n|$)/i) : null;
      const oldReasonMatch = !reasonMatch ? analysis.match(/LÝ_DO:\s*(.+?)(?=\n|$)/i) : null;

      // Sử dụng kết quả tìm được (uu tiên tiếng Anh)
      const finalViolationMatch = violationMatch || oldViolationMatch;
      const finalRuleMatch = ruleMatch || oldRuleMatch;
      const finalSeverityMatch = severityMatch || oldSeverityMatch;
      const finalFakeMatch = fakeMatch || oldFakeMatch;
      const finalRecommendationMatch = recommendationMatch || oldRecommendationMatch;
      const finalReasonMatch = reasonMatch || oldReasonMatch;

      // Ghi log các trường đã tìm thấy
      console.log(`[MONITOR-PARSE] Vi phạm: ${finalViolationMatch ? finalViolationMatch[1] : 'Không tìm thấy'}`);
      console.log(`[MONITOR-PARSE] Quy tắc vi phạm: ${finalRuleMatch ? finalRuleMatch[1] : 'Không tìm thấy'}`);
      console.log(`[MONITOR-PARSE] Mức độ: ${finalSeverityMatch ? finalSeverityMatch[1] : 'Không tìm thấy'}`);
      console.log(`[MONITOR-PARSE] Dấu hiệu giả mạo: ${finalFakeMatch ? finalFakeMatch[1] : 'Không tìm thấy'}`);

      // Xác định có vi phạm không
      const isViolation = finalViolationMatch && finalViolationMatch[1].toLowerCase() === 'có';

      // Nếu không vi phạm, trả về kết quả mặc định
      if (!isViolation) {
        console.log(`[MONITOR-PARSE] Không phát hiện vi phạm, trả về kết quả mặc định`);
        return defaultResults;
      }

      // Trả về kết quả phân tích
      const results = {
        isViolation,
        violatedRule: finalRuleMatch ? finalRuleMatch[1].trim() : 'Không xác định',
        severity: finalSeverityMatch ? finalSeverityMatch[1].trim() : 'Không xác định',
        isFakeAccount: finalFakeMatch && finalFakeMatch[1].toLowerCase() === 'có',
        recommendation: finalRecommendationMatch ? finalRecommendationMatch[1].trim() : 'Không xác định',
        reason: finalReasonMatch ? finalReasonMatch[1].trim() : 'Không có lý do cụ thể'
      };

      console.log(`[MONITOR-PARSE] Phát hiện vi phạm! Mức độ: ${results.severity}, Quy tắc: ${results.violatedRule}`);
      return results;
    } catch (error) {
      console.error('[MONITOR-PARSE] Lỗi khi phân tích kết quả:', error);
      return defaultResults;
    }
  }

  /**
   * Xử lý vi phạm
   * @param {Discord.Message} message - Tin nhắn vi phạm
   * @param {Object} results - Kết quả phân tích
   */
  async handleViolation(message, results) {
    // Gọi hàm xử lý vi phạm từ module riêng biệt
    return handleViolation(message, results);
  }

  /**
   * Bật giám sát cho một guild
   * @param {string} guildId - ID của guild
   * @param {Object} settings - Cài đặt giám sát
   */
  enableMonitoring(guildId, settings) {
    // Lưu cài đặt giám sát
    const monitorConfig = {
      enabled: true,
      promptTemplate: settings.promptTemplate,
      ignoredChannels: settings.ignoredChannels || [],
      ignoredRoles: settings.ignoredRoles || []
    };

    // Lưu danh sách quy tắc và hành động tương ứng
    if (settings.ruleActions) {
      monitorConfig.ruleActions = settings.ruleActions;
      // Tạo danh sách rules để tương thích ngược
      monitorConfig.rules = settings.ruleActions.map(item => item.rule);
    } else if (settings.rules) {
      monitorConfig.rules = settings.rules;
      // Tạo ruleActions mặc định nếu chỉ có rules
      monitorConfig.ruleActions = settings.rules.map(rule => ({
        rule,
        action: 'warn' // Mặc định là cảnh báo
      }));
    }

    this.monitorSettings.set(guildId, monitorConfig);

    console.log(`Đã bật giám sát cho guild ${guildId}`);
    console.log(`Bot sẽ đọc tất cả tin nhắn trong guild ${guildId} để kiểm tra vi phạm`);

    // Hiển thị quy tắc và hành động
    if (monitorConfig.ruleActions) {
      console.log('Quy tắc giám sát và hành động:');
      monitorConfig.ruleActions.forEach((item, index) => {
        console.log(`${index + 1}. ${item.rule} (${item.action})`);
      });
    } else {
      console.log(`Quy tắc giám sát: ${monitorConfig.rules.join(', ')}`);
    }
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
      console.log(`Bot sẽ không còn đọc tất cả tin nhắn trong guild ${guildId}`);
      console.log(`Chức năng trò chuyện khi được tag vẫn hoạt động bình thường`);
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
