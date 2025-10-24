const fs = require("fs");
const path = require("path");

// Sử dụng cấu hình từ file cấu hình
const loggerConfig = require("../config/loggerConfig.js");

// Mức độ log và màu sắc tương ứng
const LOG_LEVELS = {
  debug: { priority: 0, color: "\x1b[36m" }, // Cyan
  info: { priority: 1, color: "\x1b[32m" }, // Green
  warn: { priority: 2, color: "\x1b[33m" }, // Yellow
  error: { priority: 3, color: "\x1b[31m" }, // Red
};

// Reset màu
const RESET_COLOR = "\x1b[0m";

// Biến lưu trữ writeStream cho file log
let logStream = null;

/**
 * Khởi tạo hệ thống ghi log vào file
 */
async function initializeFileLogging() {
  try {
    const config = loggerConfig.getConfig();
    if (!config.fileLogging.enabled) return;

    // Tạo thư mục logs nếu chưa tồn tại
    const logDir = path.join(process.cwd(), config.fileLogging.directory);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const currentLogFile = path.join(logDir, config.fileLogging.filename);

    // Nếu file log cũ tồn tại và cấu hình cho phép rotate
    if (fs.existsSync(currentLogFile) && config.fileLogging.rotateOnStartup) {
      const stats = fs.statSync(currentLogFile);
      const oldTimestamp = stats.mtime.toISOString().replace(/[:.]/g, "-");
      const oldLogFile = path.join(logDir, `console_${oldTimestamp}.old`);
      fs.renameSync(currentLogFile, oldLogFile);
      info("SYSTEM", `Đã đổi tên file log cũ thành: ${oldLogFile}`);
    }

    // Tạo writeStream để ghi log
    logStream = fs.createWriteStream(currentLogFile, { flags: "a" });

    // Ghi thông tin khởi động
    const startupMessage = `\nLUNA AI STARTUP LOG\nStartup Time: ${new Date().toISOString()}\nEnvironment: ${
      process.env.NODE_ENV || "development"
    }\n=========================\n\n`;
    logStream.write(startupMessage);

    // Xử lý khi process kết thúc
    process.on("exit", () => {
      if (logStream) {
        logStream.end("\nLUNA AI SHUTDOWN\n");
      }
    });

    process.on("SIGINT", () => {
      if (logStream) {
        logStream.end("\nLUNA AI INTERRUPTED\n");
      }
      process.exit();
    });

    info("SYSTEM", "Đã khởi tạo hệ thống ghi log vào file thành công");
  } catch (error) {
    console.error("Lỗi khi khởi tạo hệ thống ghi log vào file:", error.message);
  }
}

/**
 * Ghi log vào file
 * @param {string} level - Mức độ log
 * @param {string} message - Nội dung log
 */
function writeToFile(level, message) {
  if (!logStream) return;

  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}\n`;

  logStream.write(logEntry);
}

/**
 * Ghi log với định dạng và màu sắc
 * @param {string} category - Danh mục log (MONITOR, NEURAL, COMMAND, ...)
 * @param {string} level - Mức độ log (debug, info, warn, error)
 * @param {string} message - Nội dung log
 * @param {...any} args - Các tham số bổ sung
 */
function log(category, level, message, ...args) {
  // Lấy cấu hình hiện tại
  const config = loggerConfig.getConfig();

  // Kiểm tra xem log có được bật không
  if (!config.enabled) return;

  // Kiểm tra danh mục có được bật không
  if (category && !config.categories[category]) return;

  // Kiểm tra mức độ log
  const currentLevelPriority = LOG_LEVELS[config.level]?.priority || 1;
  const messageLevelPriority = LOG_LEVELS[level]?.priority || 1;

  if (messageLevelPriority < currentLevelPriority) return;

  // Tạo timestamp nếu cần
  const timestamp = config.showTimestamp
    ? `[${new Date().toISOString()}] `
    : "";

  // Tạo prefix với màu sắc
  const levelColor = LOG_LEVELS[level]?.color || "";
  const categoryStr = category ? `[${category}] ` : "";
  const prefix = `${timestamp}${levelColor}${level.toUpperCase()}${RESET_COLOR} ${categoryStr}`;

  // Chuẩn bị nội dung log
  const logContent = `${prefix}${message}`;

  // Ghi log với console tương ứng
  switch (level) {
    case "error":
      console.error(logContent, ...args);
      break;
    case "warn":
      console.warn(logContent, ...args);
      break;
    case "debug":
      console.debug(logContent, ...args);
      break;
    case "info":
    default:
      console.log(logContent, ...args);
      break;
  }

  // Ghi vào file nếu được bật
  if (config.fileLogging?.enabled && logStream) {
    const fileContent = `${categoryStr}${message}`;
    writeToFile(level, fileContent);
  }
}

/**
 * Ghi log debug
 * @param {string} category - Danh mục log
 * @param {string} message - Nội dung log
 * @param {...any} args - Các tham số bổ sung
 */
function debug(category, message, ...args) {
  log(category, "debug", message, ...args);
}

/**
 * Ghi log info
 * @param {string} category - Danh mục log
 * @param {string} message - Nội dung log
 * @param {...any} args - Các tham số bổ sung
 */
function info(category, message, ...args) {
  log(category, "info", message, ...args);
}

/**
 * Ghi log warning
 * @param {string} category - Danh mục log
 * @param {string} message - Nội dung log
 * @param {...any} args - Các tham số bổ sung
 */
function warn(category, message, ...args) {
  log(category, "warn", message, ...args);
}

/**
 * Ghi log error
 * @param {string} category - Danh mục log
 * @param {string} message - Nội dung log
 * @param {...any} args - Các tham số bổ sung
 */
function error(category, message, ...args) {
  log(category, "error", message, ...args);
}

/**
 * Bật/tắt log
 * @param {boolean} enabled - Trạng thái bật/tắt
 */
function setEnabled(enabled) {
  loggerConfig.setEnabled(enabled);
  info("SYSTEM", `Logging ${enabled ? "enabled" : "disabled"}`);
}

/**
 * Đặt mức độ log
 * @param {string} level - Mức độ log (debug, info, warn, error)
 */
function setLevel(level) {
  if (LOG_LEVELS[level]) {
    loggerConfig.setLevel(level);
    info("SYSTEM", `Log level set to ${level}`);
  } else {
    warn("SYSTEM", `Invalid log level: ${level}`);
  }
}

/**
 * Bật/tắt log cho một danh mục
 * @param {string} category - Danh mục log
 * @param {boolean} enabled - Trạng thái bật/tắt
 */
function setCategoryEnabled(category, enabled) {
  const result = loggerConfig.setCategoryEnabled(category, enabled);
  if (result.categories[category] === enabled) {
    info(
      "SYSTEM",
      `Logging for category ${category} ${enabled ? "enabled" : "disabled"}`
    );
  } else {
    warn("SYSTEM", `Invalid category: ${category}`);
  }
}

/**
 * Lấy cấu hình hiện tại
 * @returns {Object} - Cấu hình hiện tại
 */
function getConfig() {
  return loggerConfig.getConfig();
}

/**
 * Khôi phục cấu hình mặc định
 */
function resetConfig() {
  loggerConfig.resetToDefault();
  info("SYSTEM", "Logger configuration reset to default");
}

module.exports = {
  debug,
  info,
  warn,
  error,
  setEnabled,
  setLevel,
  setCategoryEnabled,
  getConfig,
  resetConfig,
  initializeFileLogging,
};
