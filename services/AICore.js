const axios = require("axios");
const fs = require("fs");

const logger = require("../utils/logger.js");
const prompts = require("../config/prompts.js");

class AICore {
  constructor() {
    this.apiKey = process.env.API_KEY;
    if (!this.apiKey) {
      throw new Error("API_KEY không được đặt trong biến môi trường");
    }

    this.systemPrompt = prompts.system.main;
    this.CoreModel = "sonar-pro";
    this.imageModel = "sonar-pro";
    this.thinkingModel = "sonar-reasoning";
    this.Model = "luna-v3";

    logger.info("AI_CORE", `Initialized with models: ${this.CoreModel}, ${this.thinkingModel}`);
  }

  /**
   * Tạo cấu hình Axios với xử lý chứng chỉ phù hợp
   */
  createSecureAxiosInstance(baseURL) {
    const https = require("https");
    
    const options = {
      baseURL: baseURL || "https://api.perplexity.ai/",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": `Luna/${this.CoreModel}`,
        Accept: "application/json",
      },
      timeout: 30000, // 30 seconds timeout
    };

    // Xử lý SSL certificate
    const certPath = process.env.CUSTOM_CA_CERT_PATH;
    const rejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0';
    
    if (certPath && fs.existsSync(certPath)) {
      // Sử dụng custom certificate nếu có
      const ca = fs.readFileSync(certPath);
      options.httpsAgent = new https.Agent({ 
        ca,
        rejectUnauthorized: true
      });
      logger.info("AI_CORE", `Using custom CA cert: ${certPath}`);
    } else if (!rejectUnauthorized) {
      // Bypass SSL verification nếu NODE_TLS_REJECT_UNAUTHORIZED=0
      options.httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });
      logger.warn("AI_CORE", "SSL certificate verification disabled");
    } else {
      // Sử dụng default SSL verification
      options.httpsAgent = new https.Agent({
        rejectUnauthorized: true
      });
      logger.info("AI_CORE", "Using default SSL certificate verification");
    }

    return axios.create(options);
  }

  /**
   * Phân tích tin nhắn cho chức năng giám sát
   * @param {string} prompt - Prompt phân tích tin nhắn
   * @returns {Promise<string>} - Kết quả phân tích
   */
  async getMonitoringAnalysis(prompt) {
    try {
      logger.debug("AI_CORE", "Processing monitoring analysis");

      const requestBody = {
        model: this.CoreModel,
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content: prompts.system.monitoring,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      };

      const axiosInstance = this.createSecureAxiosInstance("https://api.perplexity.ai/");
      const response = await axiosInstance.post("/chat/completions", requestBody);

      const content = response.data.choices[0].message.content;

      if (!content.includes("VI_PHẠM:") && !content.includes("QUY_TẮC_VI_PHẠM:")) {
        return `VI_PHẠM: Không\nQUY_TẮC_VI_PHẠM: Không có\nMỨC_ĐỘ: Không có\nDẤU_HIỆU_GIẢ_MẠO: Không\nĐỀ_XUẤT: Không cần hành động\nLÝ_DO: Không phát hiện vi phạm`;
      }

      return content;
    } catch (error) {
      logger.error("AI_CORE", "Monitoring analysis error:", error.message);
      
      if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
        logger.error("AI_CORE", "SSL Certificate Error. Consider setting NODE_TLS_REJECT_UNAUTHORIZED=0 in .env file");
      }
      
      return `VI_PHẠM: Không\nQUY_TẮC_VI_PHẠM: Không có\nMỨC_ĐỘ: Không có\nDẤU_HIỆU_GIẢ_MẠO: Không\nĐỀ_XUẤT: Không cần hành động\nLÝ_DO: Lỗi kết nối API: ${error.message}`;
    }
  }

  /**
   * Xử lý chat completion với API
   * @param {Array} messages - Lịch sử tin nhắn
   * @param {Object} config - Cấu hình API
   * @returns {Promise<Object>} - Phản hồi từ API với thông tin token usage
   */
  async processChatCompletion(messages, config = {}) {
    try {
      const requestBody = {
        model: config.model || this.CoreModel,
        max_tokens: config.max_tokens || 2048,
        messages: messages,
        ...config,
      };
      logger.debug("AI_CORE", `Chat completion request: ${JSON.stringify(requestBody, null, 2)}`);

      const axiosInstance = this.createSecureAxiosInstance("https://api.perplexity.ai/");
      const response = await axiosInstance.post("/chat/completions", requestBody);

      logger.info("AI_CORE", "Chat completion processed successfully");
      
      const tokenUsage = response.data.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      };

      return {
        content: response.data.choices[0].message.content,
        usage: tokenUsage
      };
    } catch (error) {
      logger.error("AI_CORE", "Chat completion error:", error.message);
      
      if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
        logger.error("AI_CORE", "SSL Certificate Error. Consider setting NODE_TLS_REJECT_UNAUTHORIZED=0 in .env file");
      }
      
      throw new Error(`AI API Error: ${error.message}`);
    }
  }

  /**
   * Nhận phản hồi với quá trình suy nghĩ từ API
   * @param {string} prompt - Câu hỏi từ người dùng
   * @returns {Promise<Object>} - Phản hồi với quá trình suy nghĩ và token usage
   */
  async getThinkingResponse(prompt) {
    try {
      logger.info("AI_CORE", "Processing thinking response");

      const thinkingPrompt = prompts.chat.thinking.replace("${promptText}", prompt);
      const messages = [
        {
          role: "system",
          content: this.systemPrompt,
        },
        {
          role: "user",
          content: thinkingPrompt,
        },
      ];

      const result = await this.processChatCompletion(messages, {
        model: this.thinkingModel,
      });

      // Format thinking response
      let content = result.content;
      content = content.replace("[THINKING]", "**Quá trình suy nghĩ:**\n");
      content = content.replace("[ANSWER]", "\n\n**Câu trả lời:**\n");

      return {
        content,
        usage: result.usage
      };
    } catch (error) {
      logger.error("AI_CORE", "Thinking response error:", error.message);
      throw error;
    }
  }

  /**
   * Nhận phản hồi mã từ API
   * @param {string} prompt - Prompt của người dùng
   * @returns {Promise<Object>} - Phản hồi mã từ API với token usage
   */
  async getCodeCompletion(prompt) {
    try {
      logger.info("AI_CORE", "Processing code completion");

      const enhancedPrompt = `${prompts.code.prefix} ${prompt} ${prompts.code.suffix}`;
      const messages = [
        {
          role: "system",
          content: this.systemPrompt + prompts.code.systemAddition,
        },
        {
          role: "user",
          content: enhancedPrompt,
        },
      ];

      return await this.processChatCompletion(messages, {
        max_tokens: 4000,
      });
    } catch (error) {
      logger.error("AI_CORE", "Code completion error:", error.message);
      throw error;
    }
  }

  /**
   * Phân tích nội dung prompt bằng AI để phát hiện nội dung không phù hợp
   * @param {string} prompt - Prompt cần phân tích
   * @returns {Promise<Object>} - Kết quả phân tích
   */
  async analyzeContentWithAI(prompt) {
    try {
      logger.info("AI_CORE", "Analyzing content with AI");

      const analysisPrompt = prompts.system.analysis.replace("${promptText}", prompt);
      const messages = [
        {
          role: "system",
          content: prompts.system.format,
        },
        {
          role: "user",
          content: analysisPrompt,
        },
      ];

      const result = await this.processChatCompletion(messages, {
        model: this.thinkingModel,
        max_tokens: 1000,
      });

      const analysisResult = JSON.parse(result.content);
      logger.info("AI_CORE", "Content analysis completed");

      return analysisResult;
    } catch (error) {
      logger.error("AI_CORE", "Content analysis error:", error.message);
      return {
        isInappropriate: false,
        categories: [],
        severity: "low",
        explanation: "Không thể phân tích do lỗi: " + error.message,
        suggestedKeywords: [],
      };
    }
  }

  getModelName() {
    return this.Model;
  }
}

module.exports = new AICore(); 