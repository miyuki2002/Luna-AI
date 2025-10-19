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
 * @param {string} query - Truy vấn tìm kiếm
 * @param {Object} options - Tùy chọn tìm kiếm (optional)
 * @returns {Promise<Object>} - Kết quả tìm kiếm và metadata
 */
async performLiveSearch(query, options = {}) {
  try {
    logger.info("AI_CORE", `Performing Sonar Search: "${query}"`);

    const requestBody = {
      model: options.model || "sonar-pro", // Thay thế this.CoreModel
      max_tokens: options.max_tokens || 2048,
      temperature: options.temperature || 0.1,
      messages: [
        {
          role: "user",
          content: query 
        }
      ],
      return_images: options.return_images !== false,
      return_related_questions: options.return_related_questions !== false,
      search_recency_filter: options.search_recency_filter || "auto",
      search_domain_filter: options.search_domain_filter || undefined,
      enable_search_classifier: options.enable_search_classifier !== false,
      disable_search: options.disable_search || false,
    };

    logger.debug("AI_CORE", `Sonar Search request body: ${JSON.stringify(requestBody, null, 2)}`);

    const axiosInstance = this.createSecureAxiosInstance("https://api.perplexity.ai/");
    const response = await axiosInstance.post("/chat/completions", requestBody, {
      headers: {
        "Authorization": `Bearer ${process.env.API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });

    logger.debug("AI_CORE", `Sonar Search response: ${JSON.stringify(response.data, null, 2)}`);
    logger.info("AI_CORE", "Sonar Search completed successfully");

    // Parse response từ Sonar API
    const choice = response.data.choices[0];
    const citations = response.data.citations || [];
    const web_results = response.data.web_results || [];
    const related_questions = response.data.related_questions || [];
    const images = response.data.images || [];

    return {
      content: choice.message.content,
      hasSearchResults: web_results.length > 0 || citations.length > 0,
      searchMetadata: {
        citations: citations,
        web_results: web_results,
        related_questions: related_questions,
        images: images,
        usage: response.data.usage,
        model: response.data.model,
        search_enabled: !requestBody.disable_search,
        total_results: web_results.length,
        search_time: response.data.created
      }
    };
  } catch (error) {
    logger.error("AI_CORE", "Sonar Search error:", error.message);
    logger.error("AI_CORE", "Sonar Search error details:", error);
    
    // Handle SSL certificate errors
    if (error.code === 'CERT_HAS_EXPIRED' || 
        error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
        error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      logger.error("AI_CORE", "SSL Certificate Error. Consider setting NODE_TLS_REJECT_UNAUTHORIZED=0 in .env file");
    }
    
    // Handle API specific errors
    if (error.response?.status === 401) {
      logger.error("AI_CORE", "Invalid API key. Check PERPLEXITY_API_KEY in environment variables");
    } else if (error.response?.status === 429) {
      logger.error("AI_CORE", "Rate limit exceeded. Please try again later");
    } else if (error.response?.status === 400) {
      logger.error("AI_CORE", "Bad request. Check request parameters:", error.response.data);
    }
    
    return {
      content: null,
      hasSearchResults: false,
      searchMetadata: null,
      error: error.message,
      errorCode: error.response?.status || 'UNKNOWN_ERROR'
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

      if (config.enableLiveSearch) {
        requestBody.search_parameters = {
          mode: "auto",
          max_search_results: 10,
          include_citations: true,
        };
      }

      logger.debug("AI_CORE", `Chat completion request: ${JSON.stringify(requestBody, null, 2)}`);

      const axiosInstance = this.createSecureAxiosInstance("https://api.perplexity.ai/");
      const response = await axiosInstance.post("/chat/completions", requestBody);

      logger.info("AI_CORE", "Chat completion processed successfully");
      
      // Trích xuất token usage từ response
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

      const result = await this.processChatCompletion(messages, {
        model: this.thinkingModel,
        max_tokens: 1024,
      });

      const cleanTranslation = result.content.trim().replace(/^["']|["']$/g, "");
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

    const urgentInfoKeywords = /(hôm nay|ngày nay|tuần này|tháng này|năm nay|hiện giờ|đang diễn ra|breaking|today|this week|this month|this year|happening now|trending)/i;

    const informationKeywords = /(gần đây|hiện tại|mới nhất|cập nhật|tin tức|thời sự|sự kiện|diễn biến|thay đổi|phát triển|recent|current|latest|update|news|events|changes|developments)/i;

    const detailKeywords = /(thông tin về|chi tiết|tìm hiểu|tài liệu|nghiên cứu|báo cáo|information about|details|research|report|study|documentation)/i;

    const factsKeywords = /(năm nào|khi nào|ở đâu|ai là|bao nhiêu|như thế nào|tại sao|định nghĩa|how many|when|where|who is|what is|why|how|define)/i;

    const opinionKeywords = /(bạn nghĩ|ý kiến của bạn|theo bạn|bạn cảm thấy|bạn thích|what do you think|in your opinion|your thoughts|how do you feel|do you like)/i;

    const knowledgeCheckKeywords = /(bạn có biết|bạn biết|bạn có hiểu|bạn hiểu|bạn có rõ|bạn rõ|do you know|you know|do you understand|you understand|are you familiar with)/i;

    const animeKeywords = /(anime|manga|manhua|manhwa|hoạt hình|phim hoạt hình|webtoon|light novel|visual novel|doujinshi|otaku|cosplay|mangaka|seiyuu|studio|season|tập|chapter|volume|arc|raw|scan|fansub|vietsub|raw|scanlation)/i;

    const genreKeywords = /(shounen|shoujo|seinen|josei|mecha|isekai|slice of life|harem|reverse harem|romance|action|adventure|fantasy|sci-fi|horror|comedy|drama|psychological|mystery|supernatural|magical girl|sports|school life)/i;

    const studioKeywords = /(ghibli|kyoto animation|shaft|madhouse|bones|ufotable|a-1 pictures|wit studio|mappa|trigger|toei animation|pierrot|production i\.g|sunrise|gainax|hoạt hình 3d|cgi animation|3d animation)/i;

    const nameKeywords = /(tên thật|tên đầy đủ|tên khai sinh|tên thường gọi|biệt danh|nickname|tên riêng|tên nghệ sĩ|stage name|real name|full name|birth name|given name|alias|streamer|youtuber|tiktoker|influencer|nghệ sĩ|ca sĩ|diễn viên|idol|người nổi tiếng|celebrity|artist|actor|actress|singer|performer|gamer|content creator)/i;

    if (opinionKeywords.test(prompt)) return false;

    return (
      urgentInfoKeywords.test(prompt) ||
      knowledgeCheckKeywords.test(prompt) ||
      animeKeywords.test(prompt) ||
      genreKeywords.test(prompt) ||
      studioKeywords.test(prompt) ||
      nameKeywords.test(prompt) ||
      informationKeywords.test(prompt) ||
      detailKeywords.test(prompt) ||
      factsKeywords.test(prompt)
    );
  }
}

module.exports = new AICore(); 