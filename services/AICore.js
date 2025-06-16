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
   * Xác định xem có nên thực hiện tìm kiếm web cho prompt hay không
   * @param {string} prompt - Prompt từ người dùng
   * @returns {boolean} - True nếu nên thực hiện tìm kiếm web
   */
  shouldPerformWebSearch(prompt) {
    if (prompt.length < 10) return false;
    const currentTimeKeywords = /(hôm nay|ngày nay|tuần này|tháng này|năm nay|hiện giờ|đang diễn ra|bây giờ|lúc này|today|this week|this month|this year|right now|currently|happening now|at the moment)/i;
    const updateKeywords = /(gần đây|hiện tại|mới nhất|cập nhật|tin tức|thời sự|sự kiện|diễn biến|thay đổi|phát triển|xu hướng|trending|recent|current|latest|update|news|events|changes|developments|breaking)/i;
    const detailKeywords = /(thông tin về|chi tiết|tìm hiểu|tài liệu|nghiên cứu|báo cáo|thống kê|dữ liệu|information about|details|research|report|study|documentation|statistics|data)/i;
    const factsKeywords = /(năm nào|khi nào|ở đâu|ai là|bao nhiêu|như thế nào|tại sao|định nghĩa|giá|price|cost|when|where|who is|what is|why|how|define|how much|how many)/i;
    const peopleKeywords = /(tên thật|tên đầy đủ|tiểu sử|lý lịch|nghề nghiệp|tuổi|sinh năm|quê quán|gia đình|real name|full name|biography|career|age|born|hometown|family|streamer|youtuber|tiktoker|influencer|nghệ sĩ|ca sĩ|diễn viên|idol|người nổi tiếng|celebrity|artist|actor|actress|singer|performer|gamer|content creator)/i;
    const entertainmentKeywords = /(anime|manga|manhua|manhwa|hoạt hình|phim|series|season|tập mới|episode|chapter mới|release date|ngày phát hành|studio|rating|review|đánh giá)/i;
    const techKeywords = /(phiên bản|version|update|patch|release|ra mắt|launch|specs|thông số|giá bán|availability|tính năng|features|comparison|so sánh)/i;
    const sportsKeywords = /(kết quả|result|score|tỷ số|match|trận đấu|tournament|giải đấu|championship|league|season|mùa giải|ranking|bảng xếp hạng)/i;
    const financeKeywords = /(giá|price|stock|cổ phiếu|exchange rate|tỷ giá|market|thị trường|economy|kinh tế|inflation|lạm phát|GDP|unemployment|thất nghiệp)/i;
    const weatherKeywords = /(thời tiết|weather|temperature|nhiệt độ|rain|mưa|storm|bão|climate|khí hậu|forecast|dự báo)/i;
    const opinionKeywords = /(bạn nghĩ|ý kiến của bạn|theo bạn|bạn cảm thấy|bạn thích|bạn có thể|what do you think|in your opinion|your thoughts|how do you feel|do you like|can you|could you)/i;
    const aiCapabilityKeywords = /(bạn có thể|bạn biết cách|bạn có khả năng|bạn làm được|can you|are you able|do you know how|are you capable)/i;
    if (opinionKeywords.test(prompt) || aiCapabilityKeywords.test(prompt)) {
      return false;
    }

    return (
      currentTimeKeywords.test(prompt) ||
      updateKeywords.test(prompt) ||
      detailKeywords.test(prompt) ||
      factsKeywords.test(prompt) ||
      peopleKeywords.test(prompt) ||
      entertainmentKeywords.test(prompt) ||
      techKeywords.test(prompt) ||
      sportsKeywords.test(prompt) ||
      financeKeywords.test(prompt) ||
      weatherKeywords.test(prompt)
    );
  }
}

module.exports = new AICore(); 