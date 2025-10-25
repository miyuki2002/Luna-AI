/**
 * Cấu hình hệ thống ghi log
 * File này cho phép điều chỉnh cài đặt logger từ một nơi tập trung
 */

// Cấu hình mặc định cho logger
const defaultConfig = {
  enabled: true, // Bật/tắt toàn bộ log
  level: "info", // Mức độ log mặc định: debug, info, warn, error
  showTimestamp: true, // Hiển thị thời gian
  fileLogging: {
    // Cấu hình ghi log vào file
    enabled: true, // Bật/tắt ghi log vào file
    directory: "logs", // Thư mục chứa file log
    filename: "console.txt", // Tên file log mặc định
    rotateOnStartup: true, // Đổi tên file log cũ khi khởi động
    keepOldLogs: true, // Giữ lại các file log cũ
  },
  categories: {
    // Bật/tắt log theo danh mục
    MONITOR: true, // Hệ thống giám sát tin nhắn
    NEURAL: true, // Hệ thống AI/NeuralNetworks
    COMMAND: true, // Xử lý lệnh
    DATABASE: true, // Thao tác cơ sở dữ liệu
    SYSTEM: true, // Thông tin hệ thống
    CHAT: true, // Chức năng trò chuyện
    API: true, // Gọi API
    CONVERSATION_SERVICE: true, // Conversation service logs
    PROVIDERS: true, // API providers logs
    AI_CORE: true, // AI Core logs
    INIT_SYSTEM: true, // Init system logs
    DEBUG: false, // Debug logs (tắt mặc định để tránh spam)
  },
};

// Cấu hình hiện tại (có thể được thay đổi trong quá trình chạy)
let currentConfig = { ...defaultConfig };

/**
 * Lấy cấu hình hiện tại
 * @returns {Object} - Cấu hình hiện tại
 */
function getConfig() {
  return { ...currentConfig };
}

/**
 * Cập nhật cấu hình
 * @param {Object} newConfig - Cấu hình mới
 * @returns {Object} - Cấu hình sau khi cập nhật
 */
function updateConfig(newConfig) {
  currentConfig = { ...currentConfig, ...newConfig };

  // Cập nhật categories nếu có
  if (newConfig.categories) {
    currentConfig.categories = {
      ...currentConfig.categories,
      ...newConfig.categories,
    };
  }

  return getConfig();
}

/**
 * Cập nhật cấu hình ghi log vào file
 * @param {Object} fileConfig - Cấu hình ghi file mới
 * @returns {Object} - Cấu hình sau khi cập nhật
 */
function updateFileLogging(fileConfig) {
  if (fileConfig) {
    currentConfig.fileLogging = { ...currentConfig.fileLogging, ...fileConfig };
  }
  return getConfig();
}

/**
 * Bật/tắt log
 * @param {boolean} enabled - Trạng thái bật/tắt
 * @returns {Object} - Cấu hình sau khi cập nhật
 */
function setEnabled(enabled) {
  return updateConfig({ enabled: !!enabled });
}

/**
 * Đặt mức độ log
 * @param {string} level - Mức độ log (debug, info, warn, error)
 * @returns {Object} - Cấu hình sau khi cập nhật
 */
function setLevel(level) {
  if (["debug", "info", "warn", "error"].includes(level)) {
    return updateConfig({ level });
  }
  return getConfig();
}

/**
 * Bật/tắt log cho một danh mục
 * @param {string} category - Danh mục log
 * @param {boolean} enabled - Trạng thái bật/tắt
 * @returns {Object} - Cấu hình sau khi cập nhật
 */
function setCategoryEnabled(category, enabled) {
  if (currentConfig.categories.hasOwnProperty(category)) {
    const categories = { ...currentConfig.categories };
    categories[category] = !!enabled;
    return updateConfig({ categories });
  }
  return getConfig();
}

/**
 * Khôi phục cấu hình mặc định
 * @returns {Object} - Cấu hình mặc định
 */
function resetToDefault() {
  currentConfig = { ...defaultConfig };
  return getConfig();
}

module.exports = {
  getConfig,
  updateConfig,
  setEnabled,
  setLevel,
  setCategoryEnabled,
  resetToDefault,
  updateFileLogging,
};
