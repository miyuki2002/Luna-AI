const AICore = require("./AICore.js");
const ImageService = require("./ImageService.js");
const ConversationService = require("./ConversationService.js");
const SystemService = require("./SystemService.js");
const logger = require("../utils/logger.js");

class NeuralNetworks {
  constructor() {
    SystemService.validateEnvironment();
    SystemService.setupGracefulShutdown();
    SystemService.startPeriodicTasks();

    logger.info("NEURAL", `Initialized with AI Core models`);
    logger.info("NEURAL", `Image Service: Ready`);
    logger.info("NEURAL", `Conversation Service: Ready`);
  }


  /**
   * Phân tích tin nhắn cho chức năng giám sát
   */
  async getMonitoringAnalysis(prompt) {
    return AICore.getMonitoringAnalysis(prompt);
  }

  /**
   * Nhận phản hồi trò chuyện từ API
   */
  async getCompletion(prompt, message = null) {
    return ConversationService.getCompletion(prompt, message);
  }

  /**
   * Nhận phản hồi với quá trình suy nghĩ từ API
   */
  async getThinkingResponse(prompt, message = null) {
    return AICore.getThinkingResponse(prompt);
  }

  /**
   * Nhận phản hồi mã từ API
   */
  async getCodeCompletion(prompt, message = null) {
    return AICore.getCodeCompletion(prompt);
  }

  /**
   * Tạo hình ảnh từ prompt
   */
  async generateImage(prompt, message = null, progressTracker = null) {
    return ImageService.generateImage(prompt, message, progressTracker);
  }

  /**
   * Theo dõi tiến trình tạo hình ảnh
   */
  trackImageGenerationProgress(messageOrInteraction, prompt) {
    return ImageService.trackImageGenerationProgress(messageOrInteraction, prompt);
  }

  /**
   * Kiểm tra kết nối đến Gradio Space
   */
  async testGradioConnection() {
    return ImageService.testGradioConnection();
  }

  /**
   * Trả về tên mô hình được hiển thị cho người dùng
   */
  getModelName() {
    return AICore.getModelName();
  }

  /**
   * Phân tích nội dung prompt bằng AI
   */
  async analyzeContentWithAI(prompt) {
    return AICore.analyzeContentWithAI(prompt);
  }

  /**
   * Lấy thông tin hệ thống
   */
  getSystemInfo() {
    return SystemService.getSystemInfo();
  }

  /**
   * Định dạng thông tin hệ thống cho hiển thị
   */
  formatSystemInfo() {
    return SystemService.formatSystemInfo();
  }

  /**
   * Kiểm tra trạng thái hệ thống
   */
  getHealthStatus() {
    return SystemService.getHealthStatus();
  }


  /**
   * @deprecated Use ConversationService.getCompletion instead
   */
  async getCompletionFromDiscord(message) {
    return ConversationService.getCompletion(message.content, message);
  }
}

module.exports = new NeuralNetworks();
