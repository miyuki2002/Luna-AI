const OpenAI = require("openai");
const axios = require("axios");
const fs = require("fs");

const logger = require("../utils/logger.js");
const prompts = require("../config/prompts.js");

class AICore {
  constructor() {
    this.apiKey = process.env.XAI_API_KEY;
    if (!this.apiKey) {
      throw new Error("API_KEY không được đặt trong biến môi trường");
    }

    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: "https://api.x.ai/v1",
    });

    this.systemPrompt = prompts.system.main;
    this.CoreModel = "grok-3-fast-beta";
    this.imageModel = "grok-2-image-1212";
    this.thinkingModel = "grok-3-mini";
    this.Model = "luna-v2";

    logger.info("AI_CORE", `Initialized with models: ${this.CoreModel}, ${this.thinkingModel}`);
  }

  /**
   * Tạo cấu hình Axios với xử lý chứng chỉ phù hợp
   */
  createSecureAxiosInstance(baseURL) {
    const options = {
      baseURL: baseURL || "https://api.x.ai",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "anthropic-version": "2025-04-15",
        "User-Agent": `Luna/${this.Model}`,
        Accept: "application/json",
      },
    };

    const certPath = process.env.CUSTOM_CA_CERT_PATH;
    if (certPath && fs.existsSync(certPath)) {
      const ca = fs.readFileSync(certPath);
      options.httpsAgent = new require("https").Agent({ ca });
      logger.info("AI_CORE", `Using custom CA cert: ${certPath}`);
    }

    return axios.create(options);
  }

  /**
   * Thực hiện tìm kiếm web bằng Live Search
   * @param {string} query - Truy vấn tìm kiếm
   * @returns {Promise<Object>} - Kết quả tìm kiếm và metadata
   */
  async performLiveSearch(query) {
    try {
      logger.info("AI_CORE", `Performing Live Search: "${query}"`);

      const searchPrompt = prompts.web.liveSearchPrompt.replace("${query}", query);

      // Sử dụng OpenAI SDK format nhưng với Grok's Live Search
      const response = await this.client.chat.completions.create({
        model: this.CoreModel,
        max_tokens: 2048,
        messages: [
          {
            role: "system",
            content: prompts.web.liveSearchSystem,
          },
          {
            role: "user",
            content: searchPrompt,
          },
        ],
        extra_body: {
          search_parameters: {
            mode: "auto",
            max_search_results: 10,
            include_citations: true,
          },
        },
      });

      logger.info("AI_CORE", "Live Search completed successfully");

      return {
        content: response.choices[0].message.content,
        hasSearchResults: true,
        searchMetadata: response.search_metadata || null,
      };
    } catch (error) {
      logger.error("AI_CORE", "Live Search error:", error.message);
      return {
        content: null,
        hasSearchResults: false,
        searchMetadata: null,
        error: error.message,
      };
    }
  }

  /**
   * Phân tích tin nhắn cho chức năng giám sát
   * @param {string} prompt - Prompt phân tích tin nhắn
   * @returns {Promise<string>} - Kết quả phân tích
   */
  async getMonitoringAnalysis(prompt) {
    try {
      logger.debug("AI_CORE", "Processing monitoring analysis");

      const axiosInstance = this.createSecureAxiosInstance("https://api.x.ai");
      const response = await axiosInstance.post("/v1/chat/completions", {
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
      });

      const content = response.data.choices[0].message.content;

      if (!content.includes("VI_PHẠM:") && !content.includes("QUY_TẮC_VI_PHẠM:")) {
        return `VI_PHẠM: Không\nQUY_TẮC_VI_PHẠM: Không có\nMỨC_ĐỘ: Không có\nDẤU_HIỆU_GIẢ_MẠO: Không\nĐỀ_XUẤT: Không cần hành động\nLÝ_DO: Không phát hiện vi phạm`;
      }

      return content;
    } catch (error) {
      logger.error("AI_CORE", "Monitoring analysis error:", error.message);
      return `VI_PHẠM: Không\nQUY_TẮC_VI_PHẠM: Không có\nMỨC_ĐỘ: Không có\nDẤU_HIỆU_GIẢ_MẠO: Không\nĐỀ_XUẤT: Không cần hành động\nLÝ_DO: Lỗi kết nối API: ${error.message}`;
    }
  }

  /**
   * Xử lý chat completion với API
   * @param {Array} messages - Lịch sử tin nhắn
   * @param {Object} config - Cấu hình API
   * @returns {Promise<string>} - Phản hồi từ API
   */
  async processChatCompletion(messages, config = {}) {
    try {
      const axiosInstance = this.createSecureAxiosInstance("https://api.x.ai");

      const response = await axiosInstance.post("/v1/chat/completions", {
        model: config.model || this.CoreModel,
        max_tokens: config.max_tokens || 2048,
        messages: messages,
        ...config,
      });

      logger.info("AI_CORE", "Chat completion processed successfully");
      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error("AI_CORE", "Chat completion error:", error.message);
      throw new Error(`AI API Error: ${error.message}`);
    }
  }

  /**
   * Nhận phản hồi với quá trình suy nghĩ từ API
   * @param {string} prompt - Câu hỏi từ người dùng
   * @returns {Promise<string>} - Phản hồi với quá trình suy nghĩ
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

      let content = await this.processChatCompletion(messages, {
        model: this.thinkingModel,
      });

      // Format thinking response
      content = content.replace("[THINKING]", "💭 **Quá trình suy nghĩ:**\n");
      content = content.replace("[ANSWER]", "\n\n✨ **Câu trả lời:**\n");

      return content;
    } catch (error) {
      logger.error("AI_CORE", "Thinking response error:", error.message);
      throw error;
    }
  }

  /**
   * Nhận phản hồi mã từ API
   * @param {string} prompt - Prompt của người dùng
   * @returns {Promise<string>} - Phản hồi mã từ API
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

      const content = await this.processChatCompletion(messages, {
        model: this.thinkingModel,
        max_tokens: 1000,
      });

      const analysisResult = JSON.parse(content);
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

  /**
   * Dịch prompt tiếng Việt sang tiếng Anh
   * @param {string} vietnamesePrompt - Prompt tiếng Việt
   * @returns {Promise<string>} - Prompt đã được dịch sang tiếng Anh
   */
  async translatePrompt(vietnamesePrompt) {
    try {
      logger.info("AI_CORE", "Translating Vietnamese prompt");

      const translateRequest = prompts.translation.vietnameseToEnglish.replace(
        "${vietnameseText}",
        vietnamesePrompt
      );

      const messages = [
        {
          role: "user",
          content: translateRequest,
        },
      ];

      const translatedText = await this.processChatCompletion(messages, {
        model: this.thinkingModel,
        max_tokens: 1024,
      });

      const cleanTranslation = translatedText.trim().replace(/^["']|["']$/g, "");
      logger.info("AI_CORE", "Translation completed");

      return cleanTranslation;
    } catch (error) {
      logger.error("AI_CORE", "Translation error:", error.message);
      return vietnamesePrompt;
    }
  }

  /**
   * Trả về tên mô hình được hiển thị cho người dùng
   * @returns {string} - Tên mô hình
   */
  getModelName() {
    return this.Model;
  }

  /**
   * Test method để kiểm tra logic shouldPerformWebSearch
   * @param {string} prompt - Prompt để test
   * @returns {Object} - Kết quả test với lý do
   */
  testWebSearchLogic(prompt) {
    const basicKnowledgeKeywords = /(là gì|what is|define|định nghĩa|giải thích|explain|cách làm|how to|hướng dẫn|tutorial|lý thuyết|theory|khái niệm|concept|nguyên lý|principle)/i;
    const aiPersonalKeywords = /(bạn nghĩ|ý kiến của bạn|theo bạn|bạn cảm thấy|bạn thích|bạn có thể|bạn biết cách|bạn có khả năng|bạn làm được|what do you think|in your opinion|your thoughts|how do you feel|do you like|can you|could you|are you able|do you know how|are you capable)/i;
    const programmingKeywords = /(code|lập trình|programming|javascript|python|html|css|react|nodejs|algorithm|thuật toán|debug|error|lỗi|syntax|cú pháp)/i;
    const realTimeKeywords = /(hôm nay|ngày nay|tuần này|tháng này|năm nay|hiện giờ|đang diễn ra|bây giờ|lúc này|today|this week|this month|this year|right now|currently|happening now|at the moment|vừa xảy ra|just happened)/i;
    const newsKeywords = /(tin tức|thời sự|breaking news|latest news|mới nhất|cập nhật|update|sự kiện|events|diễn biến mới|recent developments)/i;

    const result = {
      shouldSearch: this.shouldPerformWebSearch(prompt),
      reasons: []
    };

    if (basicKnowledgeKeywords.test(prompt)) {
      result.reasons.push("❌ Basic knowledge question - no search needed");
    }
    if (aiPersonalKeywords.test(prompt)) {
      result.reasons.push("❌ AI personal question - no search needed");
    }
    if (programmingKeywords.test(prompt)) {
      result.reasons.push("❌ Programming question - no search needed");
    }
    if (realTimeKeywords.test(prompt)) {
      result.reasons.push("✅ Real-time information - search needed");
    }
    if (newsKeywords.test(prompt)) {
      result.reasons.push("✅ News/updates - search needed");
    }

    if (result.reasons.length === 0) {
      result.reasons.push("ℹ️ No specific keywords matched");
    }

    return result;
  }

  /**
   * Xác định xem có nên thực hiện tìm kiếm web cho prompt hay không
   * @param {string} prompt - Prompt từ người dùng
   * @returns {boolean} - True nếu nên thực hiện tìm kiếm web
   */
  shouldPerformWebSearch(prompt) {
    if (prompt.length < 10) return false;

    const basicKnowledgeKeywords = /(là gì|what is|define|định nghĩa|giải thích|explain|cách làm|how to|hướng dẫn|tutorial|lý thuyết|theory|khái niệm|concept|nguyên lý|principle)/i;
    
    const aiPersonalKeywords = /(bạn nghĩ|ý kiến của bạn|theo bạn|bạn cảm thấy|bạn thích|bạn có thể|bạn biết cách|bạn có khả năng|bạn làm được|what do you think|in your opinion|your thoughts|how do you feel|do you like|can you|could you|are you able|do you know how|are you capable)/i;

    const programmingKeywords = /(code|lập trình|programming|javascript|python|html|css|react|nodejs|algorithm|thuật toán|debug|error|lỗi|syntax|cú pháp)/i;

    const realTimeKeywords = /(hôm nay|ngày nay|tuần này|tháng này|năm nay|hiện giờ|đang diễn ra|bây giờ|lúc này|today|this week|this month|this year|right now|currently|happening now|at the moment|vừa xảy ra|just happened)/i;
    
    const newsKeywords = /(tin tức|thời sự|breaking news|latest news|mới nhất|cập nhật|update|sự kiện|events|diễn biến mới|recent developments)/i;
    
    const currentPeopleKeywords = /(streamer|youtuber|tiktoker|influencer|nghệ sĩ|ca sĩ|diễn viên|idol|người nổi tiếng|celebrity|gần đây|recently)/i;
    
    const marketKeywords = /(giá hiện tại|current price|giá hôm nay|today's price|stock price|cổ phiếu|exchange rate|tỷ giá|market today|thị trường hôm nay)/i;
    
    const currentWeatherKeywords = /(thời tiết hôm nay|today's weather|thời tiết hiện tại|current weather|dự báo thời tiết|weather forecast)/i;

    const sportsResultsKeywords = /(kết quả trận|match result|tỷ số|score|championship|giải đấu|tournament|mùa giải|season|gần đây|recent)/i;

    if (basicKnowledgeKeywords.test(prompt) || 
        aiPersonalKeywords.test(prompt) || 
        programmingKeywords.test(prompt)) {
      return false;
    }

    return (
      realTimeKeywords.test(prompt) ||
      newsKeywords.test(prompt) ||
      (currentPeopleKeywords.test(prompt) && realTimeKeywords.test(prompt)) ||
      marketKeywords.test(prompt) ||
      currentWeatherKeywords.test(prompt) ||
      sportsResultsKeywords.test(prompt)
    );
  }
}

module.exports = new AICore(); 