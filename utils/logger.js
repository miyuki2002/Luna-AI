/**
 * Hệ thống ghi log tập trung
 * Cho phép bật/tắt log và phân loại log theo mức độ
 */

// Cấu hình mặc định
const config = {
  enabled: true,         // Bật/tắt toàn bộ log
  level: 'info',         // Mức độ log mặc định: debug, info, warn, error
  showTimestamp: true,   // Hiển thị thời gian
  categories: {          // Bật/tắt log theo danh mục
    MONITOR: true,
    NEURAL: true,
    COMMAND: true,
    DATABASE: true,
    SYSTEM: true,
    CHAT: true,
    API: true
  }
};

// Mức độ log và màu sắc tương ứng
const LOG_LEVELS = {
  debug: { priority: 0, color: '\x1b[36m' },  // Cyan
  info: { priority: 1, color: '\x1b[32m' },   // Green
  warn: { priority: 2, color: '\x1b[33m' },   // Yellow
  error: { priority: 3, color: '\x1b[31m' }   // Red
};

// Reset màu
const RESET_COLOR = '\x1b[0m';

/**
 * Ghi log với định dạng và màu sắc
 * @param {string} category - Danh mục log (MONITOR, NEURAL, COMMAND, ...)
 * @param {string} level - Mức độ log (debug, info, warn, error)
 * @param {string} message - Nội dung log
 * @param {...any} args - Các tham số bổ sung
 */
function log(category, level, message, ...args) {
  // Kiểm tra xem log có được bật không
  if (!config.enabled) return;
  
  // Kiểm tra danh mục có được bật không
  if (category && !config.categories[category]) return;
  
  // Kiểm tra mức độ log
  const currentLevelPriority = LOG_LEVELS[config.level]?.priority || 1;
  const messageLevelPriority = LOG_LEVELS[level]?.priority || 1;
  
  if (messageLevelPriority < currentLevelPriority) return;
  
  // Tạo timestamp nếu cần
  const timestamp = config.showTimestamp ? `[${new Date().toISOString()}] ` : '';
  
  // Tạo prefix với màu sắc
  const levelColor = LOG_LEVELS[level]?.color || '';
  const categoryStr = category ? `[${category}] ` : '';
  const prefix = `${timestamp}${levelColor}${level.toUpperCase()}${RESET_COLOR} ${categoryStr}`;
  
  // Ghi log với console tương ứng
  switch (level) {
    case 'error':
      console.error(prefix, message, ...args);
      break;
    case 'warn':
      console.warn(prefix, message, ...args);
      break;
    case 'debug':
      console.debug(prefix, message, ...args);
      break;
    case 'info':
    default:
      console.log(prefix, message, ...args);
      break;
  }
}

/**
 * Ghi log debug
 * @param {string} category - Danh mục log
 * @param {string} message - Nội dung log
 * @param {...any} args - Các tham số bổ sung
 */
function debug(category, message, ...args) {
  log(category, 'debug', message, ...args);
}

/**
 * Ghi log info
 * @param {string} category - Danh mục log
 * @param {string} message - Nội dung log
 * @param {...any} args - Các tham số bổ sung
 */
function info(category, message, ...args) {
  log(category, 'info', message, ...args);
}

/**
 * Ghi log warning
 * @param {string} category - Danh mục log
 * @param {string} message - Nội dung log
 * @param {...any} args - Các tham số bổ sung
 */
function warn(category, message, ...args) {
  log(category, 'warn', message, ...args);
}

/**
 * Ghi log error
 * @param {string} category - Danh mục log
 * @param {string} message - Nội dung log
 * @param {...any} args - Các tham số bổ sung
 */
function error(category, message, ...args) {
  log(category, 'error', message, ...args);
}

/**
 * Bật/tắt log
 * @param {boolean} enabled - Trạng thái bật/tắt
 */
function setEnabled(enabled) {
  config.enabled = !!enabled;
  info('SYSTEM', `Logging ${config.enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Đặt mức độ log
 * @param {string} level - Mức độ log (debug, info, warn, error)
 */
function setLevel(level) {
  if (LOG_LEVELS[level]) {
    config.level = level;
    info('SYSTEM', `Log level set to ${level}`);
  } else {
    warn('SYSTEM', `Invalid log level: ${level}. Using default: ${config.level}`);
  }
}

/**
 * Bật/tắt log cho một danh mục
 * @param {string} category - Danh mục log
 * @param {boolean} enabled - Trạng thái bật/tắt
 */
function setCategoryEnabled(category, enabled) {
  if (config.categories.hasOwnProperty(category)) {
    config.categories[category] = !!enabled;
    info('SYSTEM', `Logging for category ${category} ${config.categories[category] ? 'enabled' : 'disabled'}`);
  } else {
    warn('SYSTEM', `Invalid category: ${category}`);
  }
}

/**
 * Lấy cấu hình hiện tại
 * @returns {Object} - Cấu hình hiện tại
 */
function getConfig() {
  return { ...config };
}

module.exports = {
  debug,
  info,
  warn,
  error,
  setEnabled,
  setLevel,
  setCategoryEnabled,
  getConfig
};
