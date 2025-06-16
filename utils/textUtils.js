module.exports = {
  /**
   * Tạo tóm tắt ngắn gọn từ nội dung tin nhắn
   * @param {string} content - Nội dung tin nhắn
   * @param {string} role - Vai trò (user/assistant)
   * @returns {string} - Tóm tắt tin nhắn
   */
  createMessageSummary(content, role) {
    if (!content || content.length < 5) return null;

    const prefix = role === "user" ? "Người dùng đã hỏi: " : "Tôi đã trả lời: ";
    const summary = prefix + content;

    return summary.length > 100 ? summary.substring(0, 100) + "..." : summary;
  },

  /**
   * Trích xuất từ khóa từ prompt
   * @param {string} prompt - Prompt cần trích xuất từ khóa
   * @returns {Array} - Danh sách các từ khóa
   */
  extractKeywords(prompt) {
    if (!prompt?.length || prompt.length < 3) return [];

    const stopWords = new Set([
      "và", "hoặc", "nhưng", "nếu", "vì", "bởi", "với", "từ", "đến", "trong", "ngoài",
      "a", "an", "the", "and", "or", "but", "if", "because", "with", "from", "to", "in", "out"
    ]);

    return [...new Set(
      prompt
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word))
    )].slice(0, 5);
  },

  /**
   * Trích xuất các tin nhắn quan trọng từ lịch sử cuộc trò chuyện
   * @param {Array} history - Lịch sử cuộc trò chuyện
   * @returns {Array} - Danh sách các tin nhắn quan trọng
   */
  extractKeyMessages(history) {
    if (!history?.length) return [];

    const userMessages = history
      .filter(msg => msg.role === "user")
      .map(msg => msg.content);

    const significantMessages = userMessages.filter(
      msg => msg.length > 10 && msg.length < 200
    );

    const messages = significantMessages.length ? significantMessages : userMessages;
    return messages.slice(-5).map(msg => 
      msg.length > 100 ? msg.substring(0, 100) + "..." : msg
    );
  },

  /**
   * Xác định các chủ đề chính từ lịch sử cuộc trò chuyện
   * @param {Array} history - Lịch sử cuộc trò chuyện
   * @returns {Array} - Danh sách các chủ đề chính
   */
  identifyMainTopics(history) {
    if (!history?.length) return ["Chưa có đủ dữ liệu"];

    const allKeywords = history
      .filter(msg => msg.role === "user")
      .flatMap(msg => this.extractKeywords(msg.content));

    const keywordFrequency = allKeywords.reduce((acc, keyword) => {
      acc[keyword] = (acc[keyword] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(keywordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
  },

  /**
   * Format thời gian trước đây
   * @param {number} timestamp - Thời gian cần định dạng
   * @returns {string} - Chuỗi thời gian đã định dạng
   */
  formatTimeAgo(timestamp) {
    const secondsAgo = Math.floor((Date.now() - timestamp) / 1000);
    
    if (secondsAgo < 60) return `${secondsAgo} giây`;
    
    const minutesAgo = Math.floor(secondsAgo / 60);
    if (minutesAgo < 60) return `${minutesAgo} phút`;
    
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo} giờ`;
    
    return `${Math.floor(hoursAgo / 24)} ngày`;
  },

  /**
   * Tạo animation loading
   * @param {number} step - Bước hiện tại
   * @returns {string} - Loading icon
   */
  getLoadingAnimation(step) {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    return frames[step % frames.length];
  },

  /**
   * Tạo progress bar
   * @param {number} percent - Phần trăm hoàn thành
   * @returns {string} - Progress bar string
   */
  getProgressBar(percent) {
    const TOTAL_LENGTH = 25;
    const completed = Math.floor((percent / 100) * TOTAL_LENGTH);
    const remaining = TOTAL_LENGTH - completed;

    const statusIcons = {
      0: "⬛",
      25: "<:thinking:1050344785153626122>",
      50: "<:wao:1050344773698977853>",
      75: "🔆",
      90: "⏭️",
      100: "<:like:1049784377103622218>",
    };

    const statusIcon =
      Object.entries(statusIcons)
        .reverse()
        .find(([threshold]) => percent >= parseInt(threshold))?.[1] || "⬛";

    const progressBar = `│${"█".repeat(completed)}${"▒".repeat(remaining)}│`;
    const percentText = `${percent.toString().padStart(3, " ")}%`;

    return `${statusIcon} ${progressBar} ${percentText}`;
  }
}; 