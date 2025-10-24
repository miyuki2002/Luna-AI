const AICore = require("./AICore.js");
const mongoClient = require("./mongoClient.js");
const { handleViolation } = require("./violationHandler.js");
const logger = require("../utils/logger.js");

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
      logger.info(
        "MONITOR",
        "Hệ thống giám sát tin nhắn đã được khởi tạo trước đó"
      );
      return;
    }

    // Lưu tham chiếu đến client
    this.client = client;
    logger.info(
      "MONITOR",
      `Đang khởi tạo hệ thống giám sát tin nhắn với client ID: ${client.user.id}`
    );

    try {
      // Tải cài đặt giám sát từ cơ sở dữ liệu
      logger.info("MONITOR", "Đang tải cài đặt giám sát từ cơ sở dữ liệu...");
      await this.loadMonitorSettings();

      // Đăng ký sự kiện messageCreate riêng cho chức năng monitor
      // Sử dụng Events.MessageCreate thay vì 'messageCreate' để đồng bộ với cách đăng ký sự kiện trong index.js
      logger.info(
        "MONITOR",
        "Đang đăng ký sự kiện MessageCreate cho chức năng giám sát..."
      );
      const { Events } = require("discord.js");
      client.on(Events.MessageCreate, this.handleMessage.bind(this));
      logger.info("MONITOR", "Đã đăng ký sự kiện MessageCreate thành công");

      // Đánh dấu đã khởi tạo
      this.isInitialized = true;
      logger.info(
        "MONITOR",
        "Đã khởi tạo hệ thống giám sát tin nhắn thành công"
      );
      logger.info("MONITOR", `Bot ID: ${client.user.id}`);
      logger.info(
        "MONITOR",
        "Chức năng monitor sẽ đọc tất cả tin nhắn khi được bật"
      );
      logger.info(
        "MONITOR",
        "Chức năng monitor và trò chuyện sẽ hoạt động song song"
      );
    } catch (error) {
      logger.error(
        "MONITOR",
        "Lỗi khi khởi tạo hệ thống giám sát tin nhắn:",
        error
      );
    }
  }

  /**
   * Tải cài đặt giám sát từ cơ sở dữ liệu
   */
  async loadMonitorSettings() {
    try {
      logger.debug("MONITOR", "Đang kết nối đến cơ sở dữ liệu MongoDB...");
      const db = mongoClient.getDb();
      logger.debug(
        "MONITOR",
        "Đã kết nối đến cơ sở dữ liệu MongoDB thành công"
      );

      // Tạo collection nếu chưa tồn tại
      try {
        logger.debug("MONITOR", "Đang tạo các collection cần thiết...");
        await db.createCollection("monitor_settings");
        await db.createCollection("monitor_logs");
        logger.debug("MONITOR", "Đã tạo các collection cần thiết thành công");
      } catch (error) {
        // Bỏ qua lỗi nếu collection đã tồn tại
        logger.debug("MONITOR", "Các collection đã tồn tại, tiếp tục...");
      }

      // Lấy tất cả cài đặt giám sát
      logger.debug("MONITOR", "Đang tải cài đặt giám sát từ cơ sở dữ liệu...");
      const settings = await db
        .collection("monitor_settings")
        .find({ enabled: true })
        .toArray();
      logger.info(
        "MONITOR",
        `Tìm thấy ${settings.length} cài đặt giám sát đang bật`
      );

      // Lưu vào Map
      for (const setting of settings) {
        logger.debug(
          "MONITOR",
          `Đang tải cài đặt cho guild ${setting.guildId}...`
        );
        this.monitorSettings.set(setting.guildId, {
          enabled: true,
          promptTemplate: setting.promptTemplate,
          rules: setting.rules,
          ignoredChannels: setting.ignoredChannels || [],
          ignoredRoles: setting.ignoredRoles || [],
        });
        logger.debug(
          "MONITOR",
          `Đã tải cài đặt cho guild ${setting.guildId} thành công`
        );
        // logger.debug('MONITOR', `Số quy tắc: ${setting.rules.length}, Số kênh bỏ qua: ${(setting.ignoredChannels || []).length}, Số vai trò bỏ qua: ${(setting.ignoredRoles || []).length}`);
      }

      logger.info(
        "MONITOR",
        `Đã tải ${settings.length} cài đặt giám sát từ cơ sở dữ liệu thành công`
      );
    } catch (error) {
      logger.error("MONITOR", "Lỗi khi tải cài đặt giám sát:", error);
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
    if (
      member &&
      settings.ignoredRoles.some((roleId) => member.roles.cache.has(roleId))
    )
      return;

    // Kiểm tra xem tin nhắn có phải là lệnh không
    if (message.content.startsWith("/")) return;

    // Bỏ qua tin nhắn tag bot để tránh xung đột với chức năng trò chuyện
    // Chức năng trò chuyện sẽ được ưu tiên khi bot được tag
    if (this.client && message.mentions.has(this.client.user)) {
      logger.debug(
        "MONITOR",
        `Bỏ qua tin nhắn tag bot từ ${message.author.tag}`
      );
      return;
    }

    // Bỏ qua tin nhắn có mention @everyone hoặc @role
    if (message.mentions.everyone || message.mentions.roles.size > 0) {
      logger.debug(
        "MONITOR",
        `Bỏ qua tin nhắn có mention @everyone hoặc @role từ ${message.author.tag}`
      );
      return;
    }

    // Kiểm tra nội dung tin nhắn có chứa quy tắc cấm không
    if (settings && settings.rules) {
      // Kiểm tra trực tiếp nội dung tin nhắn có chứa quy tắc cấm không
      const lowerCaseContent = message.content.toLowerCase();
      const violatedRule = settings.rules.find((rule) => {
        const lowerCaseRule = rule.toLowerCase();
        if (
          lowerCaseRule.startsWith("không chat") ||
          lowerCaseRule.startsWith("không nói")
        ) {
          const bannedWord = lowerCaseRule
            .replace("không chat", "")
            .replace("không nói", "")
            .trim();
          return lowerCaseContent.includes(bannedWord);
        }
        return false;
      });

      if (violatedRule) {
        logger.warn(
          "MONITOR",
          `Phát hiện vi phạm trực tiếp: ${violatedRule} trong tin nhắn: "${message.content}"`
        );

        // Tạo kết quả vi phạm trực tiếp
        const directViolationResults = {
          isViolation: true,
          violatedRule: violatedRule,
          severity: "Trung bình",
          isFakeAccount: false,
          recommendation: "Cảnh báo",
          reason: `Tin nhắn chứa nội dung bị cấm: ${violatedRule}`,
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
          severity: "Trung bình",
          isFakeAccount: false,
          recommendation: "Cảnh báo",
          reason: `Tin nhắn chứa nội dung bị cấm: ${violatedRule}`,
          rawAnalysis:
            "VIOLATION: Có\nRULE: " +
            violatedRule +
            "\nSEVERITY: Trung bình\nFAKE: Không\nACTION: Cảnh báo\nREASON: Phát hiện trực tiếp bởi hệ thống",
        };

        db.collection("monitor_logs").insertOne(logEntry);

        // Xử lý vi phạm
        this.handleViolation(message, directViolationResults);
        return; // Dừng xử lý, không cần gọi API
      }
    }

    // Kiểm tra xem tin nhắn có phải là tin nhắn cảnh báo từ bot không
    if (this.client && this.client.user) {
      if (message.content.startsWith(`<@${this.client.user.id}> **CẢNH BÁO`))
        return;
      if (message.content.startsWith(`<@${this.client.user.id}> **Lưu ý`))
        return;
    } else if (
      message.content.includes("**CẢNH BÁO") ||
      message.content.includes("**Lưu ý")
    ) {
      // Nếu không có client.user, kiểm tra bằng cách khác
      return;
    }

    // Ghi log để debug chi tiết hơn
    logger.debug(
      "MONITOR",
      `Đang phân tích tin nhắn từ ${
        message.author.tag
      }: ${message.content.substring(0, 50)}${
        message.content.length > 50 ? "..." : ""
      }`
    );
    logger.debug(
      "MONITOR",
      `Guild ID: ${message.guild.id}, Channel ID: ${message.channel.id}`
    );
    logger.debug(
      "MONITOR",
      `Trạng thái giám sát: ${settings.enabled ? "Đang bật" : "Đã tắt"}`
    );
    logger.debug("MONITOR", `Quy tắc giám sát: ${settings.rules.join(", ")}`);
    logger.debug(
      "MONITOR",
      `Số kênh bỏ qua: ${settings.ignoredChannels.length}, Số vai trò bỏ qua: ${settings.ignoredRoles.length}`
    );

    try {
      // Phân tích tin nhắn bằng NeuralNetworks
      await this.analyzeMessage(message, settings.promptTemplate);
    } catch (error) {
      logger.error("MONITOR", "Lỗi khi phân tích tin nhắn:", error);
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
      logger.debug(
        "MONITOR",
        `Đang phân tích tin nhắn: "${message.content.substring(0, 50)}${
          message.content.length > 50 ? "..." : ""
        }"`
      );
      logger.debug(
        "MONITOR",
        `Quy tắc: ${this.monitorSettings
          .get(message.guild.id)
          .rules.join(", ")}`
      );

      // Thay thế placeholder trong template
      const prompt = promptTemplate.replace("{{message}}", message.content);

      // Gọi NeuralNetworks để phân tích sử dụng phương thức riêng cho giám sát
      const analysis = await AICore.getMonitoringAnalysis(prompt);

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
        rawAnalysis: analysis,
      };

      await db.collection("monitor_logs").insertOne(logEntry);

      // Nếu phát hiện vi phạm, thông báo cho các kênh mod
      if (results.isViolation) {
        logger.warn("MONITOR", `Đã phát hiện vi phạm! Xử lý vi phạm...`);
        await this.handleViolation(message, results);
      } else {
        logger.debug("MONITOR", `Không phát hiện vi phạm.`);
      }
    } catch (error) {
      logger.error("MONITOR", "Lỗi khi phân tích tin nhắn:", error);
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
      violatedRule: "Không có",
      severity: "Không có",
      isFakeAccount: false,
      recommendation: "Không cần hành động",
      reason: "Không có vi phạm",
    };

    try {
      // Ghi log phân tích để debug
      logger.debug(
        "MONITOR",
        `Phân tích kết quả: ${analysis.substring(0, 100)}${
          analysis.length > 100 ? "..." : ""
        }`
      );

      // Tìm các trường trong phân tích (sử dụng tiếng Anh)
      const violationMatch = analysis.match(/VIOLATION:\s*(Có|Không)/i);
      const ruleMatch = analysis.match(/RULE:\s*(.+?)(?=\n|$)/i);
      const severityMatch = analysis.match(
        /SEVERITY:\s*(Thấp|Trung bình|Cao|Không có)/i
      );
      const fakeMatch = analysis.match(/FAKE:\s*(Có|Không)/i);
      const recommendationMatch = analysis.match(/ACTION:\s*(.+?)(?=\n|$)/i);
      const reasonMatch = analysis.match(/REASON:\s*(.+?)(?=\n|$)/i);

      // Sử dụng kết quả tìm được (uu tiên tiếng Anh)
      const finalViolationMatch = violationMatch;
      const finalRuleMatch = ruleMatch;
      const finalSeverityMatch = severityMatch;
      const finalFakeMatch = fakeMatch;
      const finalRecommendationMatch = recommendationMatch;
      const finalReasonMatch = reasonMatch;

      // Ghi log các trường đã tìm thấy
      logger.debug(
        "MONITOR",
        `Vi phạm: ${
          finalViolationMatch ? finalViolationMatch[1] : "Không tìm thấy"
        }`
      );
      logger.debug(
        "MONITOR",
        `Quy tắc vi phạm: ${
          finalRuleMatch ? finalRuleMatch[1] : "Không tìm thấy"
        }`
      );
      logger.debug(
        "MONITOR",
        `Mức độ: ${
          finalSeverityMatch ? finalSeverityMatch[1] : "Không tìm thấy"
        }`
      );
      logger.debug(
        "MONITOR",
        `Dấu hiệu giả mạo: ${
          finalFakeMatch ? finalFakeMatch[1] : "Không tìm thấy"
        }`
      );

      // Xác định có vi phạm không
      const isViolation =
        finalViolationMatch && finalViolationMatch[1].toLowerCase() === "có";

      // Nếu không vi phạm, trả về kết quả mặc định
      if (!isViolation) {
        logger.debug(
          "MONITOR",
          `Không phát hiện vi phạm, trả về kết quả mặc định`
        );
        return defaultResults;
      }

      // Trả về kết quả phân tích
      const results = {
        isViolation,
        violatedRule: finalRuleMatch
          ? finalRuleMatch[1].trim()
          : "Không xác định",
        severity: finalSeverityMatch
          ? finalSeverityMatch[1].trim()
          : "Không xác định",
        isFakeAccount:
          finalFakeMatch && finalFakeMatch[1].toLowerCase() === "có",
        recommendation: finalRecommendationMatch
          ? finalRecommendationMatch[1].trim()
          : "Không xác định",
        reason: finalReasonMatch
          ? finalReasonMatch[1].trim()
          : "Không có lý do cụ thể",
      };

      logger.warn(
        "MONITOR",
        `Phát hiện vi phạm! Mức độ: ${results.severity}, Quy tắc: ${results.violatedRule}`
      );
      return results;
    } catch (error) {
      logger.error("MONITOR", "Lỗi khi phân tích kết quả:", error);
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
      ignoredRoles: settings.ignoredRoles || [],
    };

    // Lưu danh sách quy tắc và hành động tương ứng
    if (settings.ruleActions) {
      monitorConfig.ruleActions = settings.ruleActions;
      // Tạo danh sách rules để tương thích ngược
      monitorConfig.rules = settings.ruleActions.map((item) => item.rule);
    } else if (settings.rules) {
      monitorConfig.rules = settings.rules;
      // Tạo ruleActions mặc định nếu chỉ có rules
      monitorConfig.ruleActions = settings.rules.map((rule) => ({
        rule,
        action: "warn", // Mặc định là cảnh báo
      }));
    }

    this.monitorSettings.set(guildId, monitorConfig);

    logger.info("MONITOR", `Đã bật giám sát cho guild ${guildId}`);
    logger.info(
      "MONITOR",
      `Bot sẽ đọc tất cả tin nhắn trong guild ${guildId} để kiểm tra vi phạm`
    );

    // Hiển thị quy tắc và hành động
    if (monitorConfig.ruleActions) {
      logger.info("MONITOR", "Quy tắc giám sát và hành động:");
      monitorConfig.ruleActions.forEach((item, index) => {
        logger.info("MONITOR", `${index + 1}. ${item.rule} (${item.action})`);
      });
    } else {
      logger.info(
        "MONITOR",
        `Quy tắc giám sát: ${monitorConfig.rules.join(", ")}`
      );
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
      logger.info("MONITOR", `Đã tắt giám sát cho guild ${guildId}`);
      logger.info(
        "MONITOR",
        `Bot sẽ không còn đọc tất cả tin nhắn trong guild ${guildId}`
      );
      logger.info(
        "MONITOR",
        `Chức năng trò chuyện khi được tag vẫn hoạt động bình thường`
      );
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
