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
    this.CoreModel = "grok-3-fast-latest";
    this.imageModel = "grok-2-vision";
    this.thinkingModel = "grok-3-mini-latest";
    this.Model = "luna-v2";

    logger.info("AI_CORE", `Initialized with models: ${this.CoreModel}, ${this.thinkingModel}`);
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

      const response = await this.client.chat.completions.create({
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

      const content = response.choices[0].message.content;

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
      const response = await this.client.chat.completions.create({
        model: config.model || this.CoreModel,
        max_tokens: config.max_tokens || 2048,
        messages: messages,
        ...config,
      });

      logger.info("AI_CORE", "Chat completion processed successfully");
      return response.choices[0].message.content;
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