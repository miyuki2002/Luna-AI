const mongoClient = require("../services/mongoClient.js");

/**
 * Lưu hành động moderation vào cơ sở dữ liệu
 * @param {Object} options - Các tùy chọn
 * @param {string} options.guildId - ID của server
 * @param {string} options.targetId - ID của thành viên bị xử lý
 * @param {string} options.moderatorId - ID của người thực hiện hành động
 * @param {string} options.action - Loại hành động (ban, kick, mute, warn, ...)
 * @param {string} options.reason - Lý do thực hiện hành động
 * @param {number} options.duration - Thời gian (cho mute, tính bằng phút)
 * @param {number} options.count - Số lượng (cho clearwarnings)
 * @returns {Promise<Object>} - Dữ liệu đã lưu
 */
async function logModAction(options) {
  try {
    const db = mongoClient.getDb();

    // Tạo collection log nếu chưa tồn tại
    try {
      await db.createCollection("modlog");
    } catch (error) {
      // Bỏ qua lỗi nếu collection đã tồn tại
    }

    // Chuẩn bị dữ liệu cơ bản
    const logData = {
      guildId: options.guildId,
      targetId: options.targetId,
      moderatorId: options.moderatorId,
      action: options.action,
      reason: options.reason || "Không có lý do",
      timestamp: Date.now(),
    };

    // Thêm các thông tin tùy chọn
    if (options.duration) {
      logData.duration = options.duration;
    }

    if (options.count) {
      logData.count = options.count;
    }

    // Lưu vào DB
    const result = await db.collection("modlog").insertOne(logData);

    return { ...logData, _id: result.insertedId };
  } catch (error) {
    console.error("Lỗi khi lưu hành động moderation:", error);
    throw error;
  }
}

/**
 * Lấy danh sách hành động moderation
 * @param {Object} options - Các tùy chọn
 * @param {string} options.guildId - ID của server
 * @param {string} options.targetId - ID của thành viên (tùy chọn)
 * @param {string} options.action - Loại hành động (tùy chọn)
 * @param {number} options.limit - Số lượng kết quả tối đa
 * @returns {Promise<Array>} - Danh sách hành động
 */
async function getModLogs(options) {
  try {
    const db = mongoClient.getDb();

    // Tạo bộ lọc
    const filter = { guildId: options.guildId };

    if (options.targetId) {
      filter.targetId = options.targetId;
    }

    if (options.action) {
      filter.action = options.action;
    }

    // Truy vấn và sắp xếp kết quả
    const logs = await db
      .collection("modlog")
      .find(filter, { projection: { _id: 0, guildId: 1, targetId: 1, moderatorId: 1, action: 1, reason: 1, timestamp: 1, duration: 1, count: 1 } })
      .sort({ timestamp: -1 })
      .limit(options.limit || 10)
      .toArray();

    return logs;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách hành động moderation:", error);
    throw error;
  }
}

/**
 * Định dạng thời gian từ phút sang chuỗi dễ đọc
 * @param {number} minutes - Số phút
 * @returns {string} - Chuỗi thời gian đã định dạng
 */
function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes} phút`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} giờ${mins > 0 ? ` ${mins} phút` : ""}`;
  } else {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return `${days} ngày${hours > 0 ? ` ${hours} giờ` : ""}`;
  }
}

module.exports = {
  logModAction,
  getModLogs,
  formatDuration,
};
