const Anthropic = require("@anthropic-ai/sdk");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const messageHandler = require("../handlers/messageHandler.js");
const storageDB = require("./storagedb.js");
const conversationManager = require("../handlers/conversationManager.js");
const ownerService = require("./ownerService.js");
const logger = require("../utils/logger.js");
const prompts = require("../config/prompts.js");

class NeuralNetworks {
  constructor() {
    this.checkTLSSecurity();
    this.initializeLogging();

    this.apiKey = process.env.XAI_API_KEY;
    if (!this.apiKey) {
      throw new Error("API không được đặt trong biến môi trường");
    }

    this.client = new Anthropic({
      apiKey: this.apiKey,
      baseURL: "https://api.x.ai",
    });

    this.systemPrompt = prompts.system.main;

    this.CoreModel = "grok-3-fast-beta";
    this.imageModel = "grok-2-image-1212";
    this.thinkingModel = "grok-3-mini";
    this.Model = "luna-v1-preview";

    this.gradioImageSpace =
      process.env.GRADIO_IMAGE_SPACE || "stabilityai/stable-diffusion-3-medium";

    storageDB.setMaxConversationLength(30);
    storageDB.setMaxConversationAge(3 * 60 * 60 * 1000);

    this.greetingPatterns = [];

    logger.info("NEURAL", `Model chat: ${this.CoreModel} & ${this.Model}`);
    logger.info("NEURAL", `Model tạo hình ảnh: ${this.imageModel}`);
    logger.info("NEURAL", `Gradio image space: ${this.gradioImageSpace}`);
    logger.info("NEURAL", `Live Search: Enabled`);

    this.testGradioConnection().then((connected) => {
      if (!connected) {
        logger.warn(
          "NEURAL",
          "Không thể kết nối đến Gradio Space. Vui lòng kiểm tra Space status."
        );
      }
    });
  }

  /**
   * Khởi tạo hệ thống logging khi bot khởi động
   */
  async initializeLogging() {
    try {
      await logger.initializeFileLogging();
      logger.info("SYSTEM", "Đã khởi tạo hệ thống logging thành công");
    } catch (error) {
      logger.error(
        "SYSTEM",
        `Lỗi khi khởi tạo hệ thống logging: ${error.message}`
      );
    }
  }

  /**
   * Dynamically load the Gradio client (ESM module)
   * @returns {Promise<Object>} - The Gradio client module
   */
  async loadGradioClient() {
    try {
      return await import("@gradio/client");
    } catch (error) {
      logger.error("NEURAL", `Lỗi khi tải Gradio client:`, error.message);
      throw error;
    }
  }

  /**
   * Khởi tạo các mẫu lời chào từ MongoDB
   */
  async initializeGreetingPatterns() {
    try {
      await storageDB.initializeDefaultGreetingPatterns();
      this.greetingPatterns = await storageDB.getGreetingPatterns();
      logger.info(
        "NEURAL",
        `Đã tải ${this.greetingPatterns.length} mẫu lời chào từ cơ sở dữ liệu`
      );
    } catch (error) {
      logger.error("NEURAL", "Lỗi khi khởi tạo mẫu lời chào:", error);
      this.greetingPatterns = [];
    }
  }

  /**
   * Cập nhật mẫu lời chào từ cơ sở dữ liệu
   */
  async refreshGreetingPatterns() {
    try {
      this.greetingPatterns = await storageDB.getGreetingPatterns();
      logger.info(
        "NEURAL",
        `Đã cập nhật ${this.greetingPatterns.length} mẫu lời chào từ cơ sở dữ liệu`
      );
    } catch (error) {
      logger.error("NEURAL", "Lỗi khi cập nhật mẫu lời chào:", error);
    }
  }

  /**
   * Kiểm tra cài đặt bảo mật TLS
   */
  checkTLSSecurity() {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
      logger.warn("SYSTEM", "CẢNH BÁO BẢO MẬT: NODE_TLS_REJECT_UNAUTHORIZED=0");
      logger.warn(
        "SYSTEM",
        "Cài đặt này làm vô hiệu hóa xác minh chứng chỉ SSL/TLS, khiến tất cả kết nối HTTPS không an toàn!"
      );
      logger.warn(
        "SYSTEM",
        "Điều này chỉ nên được sử dụng trong môi trường phát triển, KHÔNG BAO GIỜ trong sản xuất."
      );
      logger.warn(
        "SYSTEM",
        "Để khắc phục, hãy xóa biến môi trường NODE_TLS_REJECT_UNAUTHORIZED=0 hoặc sử dụng giải pháp bảo mật hơn."
      );
      logger.warn(
        "SYSTEM",
        "Nếu bạn đang gặp vấn đề với chứng chỉ tự ký, hãy cấu hình đường dẫn chứng chỉ CA trong thiết lập axios."
      );
    }
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
      logger.info(
        "SYSTEM",
        `Đang sử dụng chứng chỉ CA tùy chỉnh từ: ${certPath}`
      );
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
      logger.info("API", `Đang thực hiện Live Search cho: "${query}"`);

      const axiosInstance = this.createSecureAxiosInstance("https://api.x.ai");
      const searchPrompt = prompts.web.liveSearchPrompt.replace(
        "${query}",
        query
      );

      const response = await axiosInstance.post("/v1/chat/completions", {
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
        search_parameters: {
          mode: "auto",
          max_search_results: 10,
          include_citations: true,
        },
      });

      logger.info("API", "Đã nhận phản hồi từ Live Search");

      const searchResult = {
        content: response.data.choices[0].message.content,
        hasSearchResults: true,
        searchMetadata: response.data.search_metadata || null,
      };

      return searchResult;
    } catch (error) {
      logger.error("API", "Lỗi khi thực hiện Live Search:", error.message);
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
      logger.debug("MONITOR", `Đang phân tích tin nhắn cho chức năng giám sát`);
      logger.debug(
        "MONITOR",
        `Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`
      );

      const axiosInstance = this.createSecureAxiosInstance("https://api.x.ai");
      const monitorId = `monitor-${Date.now()}`;
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

      logger.debug("MONITOR", "Đã nhận phản hồi từ API cho chức năng giám sát");
      const content = response.data.choices[0].message.content;
      logger.debug(
        "MONITOR",
        `Kết quả phân tích: ${content.substring(0, 100)}${
          content.length > 100 ? "..." : ""
        }`
      );

      if (
        !content.includes("VI_PHẠM:") &&
        !content.includes("QUY_TẮC_VI_PHẠM:")
      ) {
        logger.debug(
          "MONITOR",
          "Kết quả không đúng định dạng, đang chuyển đổi..."
        );
        return `VI_PHẠM: Không\nQUY_TẮC_VI_PHẠM: Không có\nMỨC_ĐỘ: Không có\nDẤU_HIỆU_GIẢ_MẠO: Không\nĐỀ_XUẤT: Không cần hành động\nLÝ_DO: Không phát hiện vi phạm`;
      }

      return content;
    } catch (error) {
      logger.error(
        "MONITOR",
        `Lỗi khi gọi X.AI API cho chức năng giám sát:`,
        error.message
      );
      if (error.response) {
        logger.error(
          "MONITOR",
          "Chi tiết lỗi:",
          JSON.stringify(error.response.data, null, 2)
        );
      }
      return `VI_PHẠM: Không\nQUY_TẮC_VI_PHẠM: Không có\nMỨC_ĐỘ: Không có\nDẤU_HIỆU_GIẢ_MẠO: Không\nĐỀ_XUẤT: Không cần hành động\nLÝ_DO: Lỗi kết nối API: ${error.message}`;
    }
  }

  /**
   * Nhận phản hồi trò chuyện từ API
   * @param {string} prompt - Câu hỏi hoặc yêu cầu của người dùng
   * @param {Object|null} message - Đối tượng tin nhắn Discord nếu có
   * @returns {Promise<string>} - Phản hồi từ API
   */
  async getCompletion(prompt, message = null) {
    if (
      !message &&
      (prompt.includes("VI_PHẠM:") ||
        prompt.includes("QUY_TẮC_VI_PHẠM:") ||
        prompt.includes("MỨC_ĐỘ:"))
    ) {
      logger.debug("NEURAL", "Chuyển sang phương thức getMonitoringAnalysis");
      return this.getMonitoringAnalysis(prompt);
    }

    if (
      message &&
      message.mentions &&
      message.mentions.has(this.client?.user)
    ) {
      logger.debug(
        "NEURAL",
        "Xử lý tin nhắn tag bot như tin nhắn trò chuyện bình thường"
      );
    }

    try {
      // Trích xuất và xác thực ID người dùng
      const userId = this.extractUserId(message);
      if (userId === "anonymous-user") {
        logger.warn("NEURAL", "Không thể xác định userId, sử dụng ID mặc định");
      }

      logger.info(
        "NEURAL",
        `Đang xử lý yêu cầu chat completion cho userId: ${userId}`
      );
      logger.debug("NEURAL", `Prompt: "${prompt.substring(0, 50)}..."`);

      let isOwnerInteraction = false;
      let ownerMentioned = false;
      let ownerSpecialResponse = "";

      if (message?.author?.id) {
        isOwnerInteraction = ownerService.isOwner(message.author.id);
        ownerMentioned = ownerService.isOwnerMentioned(prompt, message);

        if (isOwnerInteraction) {
          logger.info(
            "NEURAL",
            `Owner đang tương tác: ${message.author.username}`
          );
          await conversationManager.loadConversationHistory(
            userId,
            this.systemPrompt,
            this.Model
          );
          const conversationHistory = conversationManager.getHistory(userId);
          const isNewConversation =
            !conversationHistory || conversationHistory.length <= 2;

          if (isNewConversation) {
            ownerSpecialResponse = await ownerService.getOwnerGreeting();
            logger.info("NEURAL", "Tạo lời chào đặc biệt cho owner");
          }
        } else if (ownerMentioned) {
          logger.info("NEURAL", "Owner được nhắc đến trong tin nhắn");
          ownerSpecialResponse = await ownerService.getOwnerMentionResponse(
            prompt
          );
        }
      }

      const imageCommandRegex =
        /^(vẽ|tạo hình|vẽ hình|hình|tạo ảnh ai|tạo ảnh)\s+(.+)$/i;
      const imageMatch = prompt.match(imageCommandRegex);

      if (imageMatch) {
        const imagePrompt = imageMatch[2];
        const commandUsed = imageMatch[1];
        logger.info(
          "NEURAL",
          `Phát hiện lệnh tạo hình ảnh "${commandUsed}". Prompt: ${imagePrompt}`
        );

        // Chuyển hướng người dùng sang sử dụng lệnh /image
        return `Để tạo hình ảnh, vui lòng sử dụng lệnh /image với nội dung bạn muốn tạo. Ví dụ:\n/image ${imagePrompt}`;
      }

      // Kiểm tra xem có phải là lệnh yêu cầu phân tích ký ức không
      const memoryAnalysisRegex =
        /^(nhớ lại|trí nhớ|lịch sử|conversation history|memory|như nãy|vừa gửi|vừa đề cập)\s*(.*)$/i;
      const memoryMatch = prompt.match(memoryAnalysisRegex);

      if (memoryMatch) {
        const memoryRequest =
          memoryMatch[2].trim() || "toàn bộ cuộc trò chuyện";
        return await this.getMemoryAnalysis(userId, memoryRequest);
      }

      // Xác định xem prompt có cần tìm kiếm web hay không
      const shouldSearchWeb = this.shouldPerformWebSearch(prompt);
      let searchResult = null;
      let promptWithSearch = prompt;

      if (shouldSearchWeb) {
        logger.info(
          "NEURAL",
          "Prompt có vẻ cần thông tin từ web, đang thực hiện Live Search..."
        );
        searchResult = await this.performLiveSearch(prompt);

        if (searchResult.hasSearchResults && searchResult.content) {
          // Sử dụng kết quả Live Search trực tiếp
          promptWithSearch = prompts.web.liveSearchEnhanced
            .replace("${originalPrompt}", prompt)
            .replace("${searchContent}", searchResult.content);
        } else {
          logger.warn(
            "NEURAL",
            "Live Search không trả về kết quả, sử dụng kiến thức có sẵn"
          );
        }
      } else {
        logger.info(
          "NEURAL",
          "Sử dụng kiến thức có sẵn, không cần Live Search"
        );
      }

      const enhancedPromptWithMemory = await this.enrichPromptWithMemory(
        promptWithSearch,
        userId
      );

      // Sử dụng phương thức chung để xử lý chat completion
      let content = await this.processChatCompletion(
        enhancedPromptWithMemory,
        userId,
        searchResult
      );

      // Xử lý phản hồi đặc biệt cho owner
      if (ownerSpecialResponse) {
        content = `${ownerSpecialResponse}\n\n${content}`;
      }

      return content;
    } catch (error) {
      logger.error("NEURAL", `Lỗi khi gọi X.AI API:`, error.message);
      if (error.response) {
        logger.error(
          "NEURAL",
          "Chi tiết lỗi:",
          JSON.stringify(error.response.data, null, 2)
        );
      }
      return `Xin lỗi, tôi không thể kết nối với dịch vụ AI. Lỗi: ${error.message}`;
    }
  }

  /**
   * Trích xuất userId từ message object
   * @param {object} message - Message object từ Discord
   * @param {string} defaultUserId - Default userId nếu không tìm thấy
   * @returns {string} - UserId đã được format
   */
  extractUserId(message, defaultUserId = "anonymous-user") {
    if (!message?.author?.id) {
      return defaultUserId;
    }

    let userId = message.author.id;

    if (message.channel && message.channel.type === "DM") {
      userId = `DM-${userId}`;
    } else if (message.guildId) {
      userId = `${message.guildId}-${userId}`;
    }

    return userId;
  }

  /**
   * Phương thức chung để xử lý chat completion
   * @param {string} prompt - Prompt đã được xử lý
   * @param {string} userId - ID người dùng
   * @param {object} searchResult - Kết quả Live Search
   * @param {object} additionalConfig - Cấu hình bổ sung
   * @returns {Promise<string>} - Phản hồi từ API
   */
  async processChatCompletion(
    prompt,
    userId,
    searchResult = null,
    additionalConfig = {}
  ) {
    try {
      const axiosInstance = this.createSecureAxiosInstance("https://api.x.ai");
      const systemPrompt = additionalConfig.systemPrompt || this.systemPrompt;

      await conversationManager.loadConversationHistory(
        userId,
        systemPrompt,
        this.Model
      );

      const conversationHistory = conversationManager.getHistory(userId);
      const isNewConversation =
        !conversationHistory || conversationHistory.length <= 2;

      let enhancedPrompt = prompts.chat.responseStyle;

      if (!isNewConversation) {
        enhancedPrompt += prompts.chat.ongoingConversation;
      } else {
        enhancedPrompt += prompts.chat.newConversation;
      }

      if (searchResult && searchResult.hasSearchResults) {
        enhancedPrompt += prompts.chat.webSearch;
      }

      enhancedPrompt += prompts.chat.generalInstructions + ` ${prompt}`;

      // Thêm tin nhắn người dùng vào lịch sử
      await conversationManager.addMessage(userId, "user", enhancedPrompt);

      // Đảm bảo messages không rỗng
      let messages = conversationManager.getHistory(userId);
      if (!messages || messages.length === 0) {
        logger.error(
          "NEURAL",
          `Lịch sử cuộc trò chuyện rỗng cho userId: ${userId}, khởi tạo lại`
        );
        await conversationManager.resetConversation(
          userId,
          systemPrompt,
          this.Model
        );
        await conversationManager.addMessage(userId, "user", enhancedPrompt);
        messages = conversationManager.getHistory(userId);
      }

      // Thực hiện yêu cầu API với lịch sử cuộc trò chuyện
      const response = await axiosInstance.post("/v1/chat/completions", {
        model: additionalConfig.model || this.CoreModel,
        max_tokens: additionalConfig.max_tokens || 2048,
        messages: messages,
        ...additionalConfig,
      });

      logger.info("NEURAL", `Đã nhận phản hồi từ API cho userId: ${userId}`);
      let content = response.data.choices[0].message.content;

      await conversationManager.addMessage(userId, "assistant", content);
      content = await this.formatResponseContent(
        content,
        isNewConversation,
        searchResult
      );

      return content;
    } catch (error) {
      logger.error(
        "NEURAL",
        `Lỗi khi xử lý yêu cầu chat completion:`,
        error.message
      );
      if (error.response) {
        logger.error(
          "NEURAL",
          "Chi tiết lỗi:",
          JSON.stringify(error.response.data, null, 2)
        );
      }
      return `Xin lỗi, tôi không thể kết nối với dịch vụ AI. Lỗi: ${error.message}`;
    }
  }

  /**
   * Xác định xem có nên thực hiện tìm kiếm web cho prompt hay không
   * @param {string} prompt - Prompt từ người dùng
   * @returns {boolean} - True nếu nên thực hiện tìm kiếm web
   */
  shouldPerformWebSearch(prompt) {
    if (prompt.length < 10) return false;

    const urgentInfoKeywords =
      /(hôm nay|ngày nay|tuần này|tháng này|năm nay|hiện giờ|đang diễn ra|breaking|today|this week|this month|this year|happening now|trending)/i;
    const informationKeywords =
      /(gần đây|hiện tại|mới nhất|cập nhật|tin tức|thời sự|sự kiện|diễn biến|thay đổi|phát triển|recent|current|latest|update|news|events|changes|developments)/i;
    const detailKeywords =
      /(thông tin về|chi tiết|tìm hiểu|tài liệu|nghiên cứu|báo cáo|information about|details|research|report|study|documentation)/i;
    const factsKeywords =
      /(năm nào|khi nào|ở đâu|ai là|bao nhiêu|như thế nào|tại sao|định nghĩa|how many|when|where|who is|what is|why|how|define)/i;
    const opinionKeywords =
      /(bạn nghĩ|ý kiến của bạn|theo bạn|bạn cảm thấy|bạn thích|what do you think|in your opinion|your thoughts|how do you feel|do you like)/i;
    const knowledgeCheckKeywords =
      /(bạn có biết|bạn biết|bạn có hiểu|bạn hiểu|bạn có rõ|bạn rõ|do you know|you know|do you understand|you understand|are you familiar with)/i;
    const animeKeywords =
      /(anime|manga|manhua|manhwa|hoạt hình|phim hoạt hình|webtoon|light novel|visual novel|doujinshi|otaku|cosplay|mangaka|seiyuu|studio|season|tập|chapter|volume|arc|raw|scan|fansub|vietsub|raw|scanlation)/i;
    const genreKeywords =
      /(shounen|shoujo|seinen|josei|mecha|isekai|slice of life|harem|reverse harem|romance|action|adventure|fantasy|sci-fi|horror|comedy|drama|psychological|mystery|supernatural|magical girl|sports|school life)/i;
    const studioKeywords =
      /(ghibli|kyoto animation|shaft|madhouse|bones|ufotable|a-1 pictures|wit studio|mappa|trigger|toei animation|pierrot|production i\.g|sunrise|gainax|hoạt hình 3d|cgi animation|3d animation)/i;
    const nameKeywords =
      /(tên thật|tên đầy đủ|tên khai sinh|tên thường gọi|biệt danh|nickname|tên riêng|tên nghệ sĩ|stage name|real name|full name|birth name|given name|alias|streamer|youtuber|tiktoker|influencer|nghệ sĩ|ca sĩ|diễn viên|idol|người nổi tiếng|celebrity|artist|actor|actress|singer|performer|gamer|content creator)/i;

    if (opinionKeywords.test(prompt)) return false;

    // Kiểm tra mức độ ưu tiên tìm kiếm
    if (urgentInfoKeywords.test(prompt)) return true;
    if (knowledgeCheckKeywords.test(prompt)) return true;
    if (animeKeywords.test(prompt)) return true;
    if (genreKeywords.test(prompt)) return true;
    if (studioKeywords.test(prompt)) return true;
    if (nameKeywords.test(prompt)) return true;
    return (
      informationKeywords.test(prompt) ||
      detailKeywords.test(prompt) ||
      factsKeywords.test(prompt)
    );
  }

  /**
   * Xử lý và định dạng nội dung phản hồi
   * @param {string} content - Nội dung phản hồi gốc
   * @param {boolean} isNewConversation - Là cuộc trò chuyện mới hay không
   * @param {Object} searchResult - Kết quả Live Search (nếu có)
   * @returns {string} - Nội dung đã được định dạng
   */
  async formatResponseContent(content, isNewConversation, searchResult) {
    if (!isNewConversation) {
      if (!this.greetingPatterns || this.greetingPatterns.length === 0) {
        await this.refreshGreetingPatterns();
      }

      // Áp dụng từng mẫu lọc
      let contentChanged = false;
      let originalLength = content.length;

      for (const pattern of this.greetingPatterns) {
        const previousContent = content;
        content = content.replace(pattern, "");
        if (previousContent !== content) {
          contentChanged = true;
        }
      }

      // Xử lý sau khi lọc
      content = content.replace(/^[\s,.!:;]+/, "");
      if (content.length > 0) {
        content = content.charAt(0).toUpperCase() + content.slice(1);
      }

      // Xử lý các trường hợp đặc biệt
      if (
        contentChanged &&
        content.length < originalLength * 0.7 &&
        content.length < 20
      ) {
        const commonFiller =
          /^(uhm|hmm|well|so|vậy|thế|đó|nha|nhé|ok|okay|nào|giờ)/i;
        content = content.replace(commonFiller, "");
        content = content.replace(/^[\s,.!:;]+/, "");
        if (content.length > 0) {
          content = content.charAt(0).toUpperCase() + content.slice(1);
        }
      }

      if (content.length < 10 && originalLength > 50) {
        const potentialContentStart =
          originalLength > 30 ? 30 : Math.floor(originalLength / 2);
        content = content || content.substring(potentialContentStart).trim();
        if (content.length > 0) {
          content = content.charAt(0).toUpperCase() + content.slice(1);
        }
      }
    } else if (
      content.toLowerCase().trim() === "chào bạn" ||
      content.length < 6
    ) {
      content = `Hii~ mình là ${this.Model} và mình ở đây nếu bạn cần gì nè 💬 Cứ thoải mái nói chuyện như bạn bè nha! ${content}`;
    }

    if (searchResult && searchResult.hasSearchResults) {
      content = `🔍 ${content}`;
      content += `\n\n*Thông tin được cập nhật từ Live Search.*`;

      if (searchResult.searchMetadata) {
        logger.debug(
          "NEURAL",
          `Live Search metadata: ${JSON.stringify(searchResult.searchMetadata)}`
        );
      }
    }

    return content;
  }

  /**
   * Làm phong phú prompt bằng cách thêm thông tin từ trí nhớ cuộc trò chuyện
   * @param {string} originalPrompt - Prompt ban đầu từ người dùng
   * @param {string} userId - ID của người dùng
   * @returns {string} - Prompt đã được làm phong phú với thông tin từ trí nhớ
   */
  async enrichPromptWithMemory(originalPrompt, userId) {
    try {
      // Lấy toàn bộ lịch sử cuộc trò chuyện
      const fullHistory = await storageDB.getConversationHistory(
        userId,
        this.systemPrompt,
        this.Model
      );

      if (!fullHistory || fullHistory.length < 3) {
        return originalPrompt;
      }

      const relevantMessages = await this.extractRelevantMemories(
        fullHistory,
        originalPrompt
      );

      if (!relevantMessages || relevantMessages.length === 0) {
        return originalPrompt;
      }

      let enhancedPrompt = originalPrompt;

      if (relevantMessages.length > 0) {
        const memoryContext = prompts.memory.memoryContext.replace(
          "${relevantMessagesText}",
          relevantMessages.join(". ")
        );
        enhancedPrompt = memoryContext + enhancedPrompt;
        console.log("Đã bổ sung prompt với thông tin từ trí nhớ");
      }

      return enhancedPrompt;
    } catch (error) {
      console.error("Lỗi khi bổ sung prompt với trí nhớ:", error);
      return originalPrompt;
    }
  }

  /**
   * Trích xuất thông tin liên quan từ lịch sử cuộc trò chuyện
   * @param {Array} history - Lịch sử cuộc trò chuyện
   * @param {string} currentPrompt - Prompt hiện tại cần tìm thông tin liên quan
   * @returns {Array} - Danh sách các thông tin liên quan
   */
  async extractRelevantMemories(history, currentPrompt) {
    try {
      if (!history || history.length < 3) {
        return [];
      }

      const conversationSummary = [];

      // Lọc ra 5 cặp tin nhắn gần nhất
      const recentMessages = history.slice(-10);

      for (let i = 0; i < recentMessages.length; i++) {
        const msg = recentMessages[i];
        if (msg.role === "user" || msg.role === "assistant") {
          const summaryText = this.createMessageSummary(msg.content, msg.role);
          if (summaryText) {
            conversationSummary.push(summaryText);
          }
        }
      }

      const relevantMemories = conversationSummary.filter((summary) => {
        const keywords = this.extractKeywords(currentPrompt);
        return keywords.some((keyword) =>
          summary.toLowerCase().includes(keyword.toLowerCase())
        );
      });

      return relevantMemories.slice(-3);
    } catch (error) {
      console.error("Lỗi khi trích xuất trí nhớ liên quan:", error);
      return [];
    }
  }

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
  }

  /**
   * Trích xuất từ khóa từ prompt
   * @param {string} prompt - Prompt cần trích xuất từ khóa
   * @returns {Array} - Danh sách các từ khóa
   */
  extractKeywords(prompt) {
    if (!prompt || prompt.length < 3) return [];

    const stopWords = [
      "và",
      "hoặc",
      "nhưng",
      "nếu",
      "vì",
      "bởi",
      "với",
      "từ",
      "đến",
      "trong",
      "ngoài",
      "a",
      "an",
      "the",
      "and",
      "or",
      "but",
      "if",
      "because",
      "with",
      "from",
      "to",
      "in",
      "out",
    ];

    return [
      ...new Set(
        prompt
          .toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
          .split(/\s+/)
          .filter((word) => word.length > 3 && !stopWords.includes(word))
      ),
    ].slice(0, 5);
  }

  /**
   * Phân tích và trả về thông tin từ trí nhớ cuộc trò chuyện
   * @param {string} userId - ID của người dùng
   * @param {string} request - Yêu cầu phân tích cụ thể
   * @returns {Promise<string>} - Kết quả phân tích trí nhớ
   */
  async getMemoryAnalysis(userId, request) {
    try {
      console.log(
        `Đang phân tích trí nhớ cho người dùng ${userId}. Yêu cầu: ${request}`
      );

      // Lấy toàn bộ lịch sử cuộc trò chuyện
      const fullHistory = await storageDB.getConversationHistory(
        userId,
        this.systemPrompt,
        this.Model
      );

      if (!fullHistory || fullHistory.length === 0) {
        return "Mình chưa có bất kỳ trí nhớ nào về cuộc trò chuyện của chúng ta. Hãy bắt đầu trò chuyện nào! 😊";
      }

      // Tạo tóm tắt cuộc trò chuyện
      const conversationSummary = [];
      let messageCount = 0;

      for (const msg of fullHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          messageCount++;

          // Tạo tóm tắt chi tiết hơn cho phân tích trí nhớ
          let roleName = msg.role === "user" ? "👤 Bạn" : "🤖 Luna";
          let content = msg.content;

          // Giới hạn độ dài của mỗi tin nhắn
          if (content.length > 150) {
            content = content.substring(0, 150) + "...";
          }

          conversationSummary.push(`${roleName}: ${content}`);
        }
      }

      // Tạo phản hồi phân tích tùy theo yêu cầu cụ thể
      let analysis = "";

      if (
        request.toLowerCase().includes("ngắn gọn") ||
        request.toLowerCase().includes("tóm tắt")
      ) {
        analysis = `📝 **Tóm tắt cuộc trò chuyện của chúng ta**\n\n`;
        analysis += `- Chúng ta đã trao đổi ${messageCount} tin nhắn\n`;
        analysis += `- Cuộc trò chuyện bắt đầu cách đây ${this.formatTimeAgo(
          fullHistory[0]?.timestamp || Date.now()
        )}\n\n`;
        analysis += `Đây là một số điểm chính từ cuộc trò chuyện:\n`;

        // Trích xuất 3-5 tin nhắn quan trọng
        const keyMessages = this.extractKeyMessages(fullHistory);
        keyMessages.forEach((msg, index) => {
          analysis += `${index + 1}. ${msg}\n`;
        });
      } else if (
        request.toLowerCase().includes("đầy đủ") ||
        request.toLowerCase().includes("chi tiết")
      ) {
        analysis = `📜 **Lịch sử đầy đủ cuộc trò chuyện của chúng ta**\n\n`;

        // Giới hạn số lượng tin nhắn hiển thị để tránh quá dài
        const maxDisplayMessages = Math.min(conversationSummary.length, 15);
        for (
          let i = conversationSummary.length - maxDisplayMessages;
          i < conversationSummary.length;
          i++
        ) {
          analysis += conversationSummary[i] + "\n\n";
        }

        if (conversationSummary.length > maxDisplayMessages) {
          analysis =
            `💬 *[${
              conversationSummary.length - maxDisplayMessages
            } tin nhắn trước đó không được hiển thị]*\n\n` + analysis;
        }
      } else {
        // Mặc định: hiển thị tóm tắt ngắn
        analysis = `💭 **Tóm tắt trí nhớ của cuộc trò chuyện**\n\n`;
        analysis += `- Chúng ta đã trao đổi ${messageCount} tin nhắn\n`;
        analysis += `- Các chủ đề chính: ${this.identifyMainTopics(
          fullHistory
        ).join(", ")}\n\n`;

        // Hiển thị 3 tin nhắn gần nhất
        analysis += `**Tin nhắn gần nhất:**\n`;
        const recentMessages = conversationSummary.slice(-3);
        recentMessages.forEach((msg) => {
          analysis += msg + "\n\n";
        });
      }

      analysis +=
        "\n💫 *Lưu ý: Mình vẫn nhớ toàn bộ cuộc trò chuyện của chúng ta và có thể trả lời dựa trên ngữ cảnh đó.*";

      return analysis;
    } catch (error) {
      console.error("Lỗi khi phân tích trí nhớ:", error);
      return (
        "Xin lỗi, mình gặp lỗi khi truy cập trí nhớ của cuộc trò chuyện. Lỗi: " +
        error.message
      );
    }
  }

  /**
   * Trích xuất các tin nhắn quan trọng từ lịch sử cuộc trò chuyện
   * @param {Array} history - Lịch sử cuộc trò chuyện
   * @returns {Array} - Danh sách các tin nhắn quan trọng
   */
  extractKeyMessages(history) {
    if (!history || history.length === 0) return [];

    // Lọc ra các tin nhắn từ người dùng
    const userMessages = history
      .filter((msg) => msg.role === "user")
      .map((msg) => msg.content);

    const significantMessages = userMessages.filter(
      (msg) => msg.length > 10 && msg.length < 200
    );

    if (significantMessages.length === 0) {
      return userMessages.slice(-3).map((msg) => {
        if (msg.length > 100) return msg.substring(0, 100) + "...";
        return msg;
      });
    }

    return significantMessages.slice(-5).map((msg) => {
      if (msg.length > 100) return msg.substring(0, 100) + "...";
      return msg;
    });
  }

  /**
   * Xác định các chủ đề chính từ lịch sử cuộc trò chuyện
   * @param {Array} history - Lịch sử cuộc trò chuyện
   * @returns {Array} - Danh sách các chủ đề chính
   */
  identifyMainTopics(history) {
    if (!history || history.length === 0) return ["Chưa có đủ dữ liệu"];

    const allKeywords = [];

    history.forEach((msg) => {
      if (msg.role === "user") {
        const keywords = this.extractKeywords(msg.content);
        allKeywords.push(...keywords);
      }
    });

    const keywordFrequency = {};
    allKeywords.forEach((keyword) => {
      if (!keywordFrequency[keyword]) {
        keywordFrequency[keyword] = 1;
      } else {
        keywordFrequency[keyword]++;
      }
    });

    const sortedKeywords = Object.entries(keywordFrequency)
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    return sortedKeywords.slice(0, 5);
  }

  /**
   * Format thời gian trước đây
   * @param {number} timestamp - Thời gian cần định dạng
   * @returns {string} - Chuỗi thời gian đã định dạng
   */
  formatTimeAgo(timestamp) {
    const now = Date.now();
    const secondsAgo = Math.floor((now - timestamp) / 1000);

    if (secondsAgo < 60) {
      return `${secondsAgo} giây`;
    }

    const minutesAgo = Math.floor(secondsAgo / 60);
    if (minutesAgo < 60) {
      return `${minutesAgo} phút`;
    }

    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) {
      return `${hoursAgo} giờ`;
    }

    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo} ngày`;
  }

  /**
   * Nhận phản hồi với quá trình suy nghĩ từ API
   * @param {string} prompt - Câu hỏi từ người dùng
   * @param {object} message - Đối tượng tin nhắn (tuỳ chọn)
   * @returns {Promise<string>} - Phản hồi với quá trình suy nghĩ
   */
  async getThinkingResponse(prompt, message = null) {
    try {
      const userId = this.extractUserId(message, "anonymous-thinking-user");
      logger.info(
        "NEURAL",
        `Đang xử lý yêu cầu thinking response cho userId: ${userId}`
      );

      const thinkingPrompt = prompts.chat.thinking.replace(
        "${promptText}",
        prompt
      );
      let content = await this.processChatCompletion(
        thinkingPrompt,
        userId,
        null,
        {
          model: this.thinkingModel,
        }
      );

      // Định dạng phần suy nghĩ để dễ đọc hơn
      content = content.replace("[THINKING]", "💭 **Quá trình suy nghĩ:**\n");
      content = content.replace("[ANSWER]", "\n\n✨ **Câu trả lời:**\n");

      return content;
    } catch (error) {
      logger.error(
        "NEURAL",
        `Lỗi khi gọi API cho chế độ thinking:`,
        error.message
      );
      return `Xin lỗi, tôi không thể kết nối với dịch vụ AI ở chế độ thinking. Lỗi: ${error.message}`;
    }
  }

  /**
   * Nhận phản hồi mã từ API
   * @param {string} prompt - Prompt của người dùng
   * @param {Object|null} message - Đối tượng tin nhắn Discord nếu có
   * @returns {Promise<string>} - Phản hồi mã từ API
   */
  async getCodeCompletion(prompt, message = null) {
    try {
      const userId = this.extractUserId(message, "anonymous-code-user");
      logger.info(
        "NEURAL",
        `Đang xử lý yêu cầu code completion cho userId: ${userId}`
      );

      const enhancedPrompt = `${prompts.code.prefix} ${prompt} ${prompts.code.suffix}`;
      const content = await this.processChatCompletion(
        enhancedPrompt,
        userId,
        null,
        {
          max_tokens: 4000,
          systemPrompt: this.systemPrompt + prompts.code.systemAddition,
        }
      );

      return content;
    } catch (error) {
      logger.error(
        "NEURAL",
        `Lỗi khi gọi X.AI API cho code completion:`,
        error.message
      );
      return `Xin lỗi, tôi không thể kết nối với dịch vụ AI. Lỗi: ${error.message}`;
    }
  }

  /**
   * Phân tích nội dung prompt bằng AI để phát hiện nội dung không phù hợp
   * @param {string} prompt - Prompt cần phân tích
   * @returns {Promise<Object>} - Kết quả phân tích
   */
  async analyzeContentWithAI(prompt) {
    try {
      logger.info(
        "NEURAL",
        `Đang phân tích nội dung prompt bằng AI: "${prompt}"`
      );

      const axiosInstance = this.createSecureAxiosInstance("https://api.x.ai");

      const analysisPrompt = prompts.system.analysis.replace(
        "${promptText}",
        prompt
      );

      const response = await axiosInstance.post("/v1/chat/completions", {
        model: this.thinkingModel,
        max_tokens: 1000,
        messages: [
          {
            role: "system",
            content: prompts.system.format,
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
      });

      const content = response.data.choices[0].message.content;
      const analysisResult = JSON.parse(content);

      logger.info(
        "NEURAL",
        `Kết quả phân tích AI: ${JSON.stringify(analysisResult)}`
      );

      return analysisResult;
    } catch (error) {
      logger.error(
        "NEURAL",
        `Lỗi khi phân tích nội dung bằng AI: ${error.message}`
      );
      return {
        isInappropriate: false,
        categories: [],
        severity: "low",
        explanation: "Không thể phân tích do lỗi: " + error.message,
        suggestedKeywords: [],
      };
    }
  }

  async generateImage(prompt, message = null, progressTracker = null) {
    progressTracker =
      progressTracker ||
      (message ? this.trackImageGenerationProgress(message, prompt) : null);

    try {
      logger.info("NEURAL", `Đang tạo hình ảnh với prompt: "${prompt}"`);

      const blacklistCheck = await storageDB.checkImageBlacklist(prompt);
      const aiAnalysis = await this.analyzeContentWithAI(prompt);
      const isBlocked = blacklistCheck.isBlocked || aiAnalysis.isInappropriate;

      //  const categories = [...new Set([...blacklistCheck.categories, ...aiAnalysis.categories])];

      if (isBlocked) {
        const errorReason = [];

        if (aiAnalysis.isInappropriate) {
          errorReason.push(
            `Phân tích AI:`,
            `- Danh mục: ${aiAnalysis.categories.join(", ")}`,
            `- Mức độ: ${aiAnalysis.severity}`
          );
        }

        const errorMsg = `Prompt chứa nội dung không phù hợp\n${errorReason.join(
          "\n"
        )}`;

        if (progressTracker) {
          await progressTracker.error(errorMsg);
        }
        return logger.warn("NEURAL", errorMsg);
      }

      // Nếu nội dung an toàn, tiếp tục quá trình tạo hình ảnh
      if (progressTracker) {
        await progressTracker.update("Đang phân tích prompt", 15);
      }

      let finalPrompt = prompt;
      if (prompt.match(/[\u00C0-\u1EF9]/)) {
        try {
          finalPrompt = await this.translatePrompt(prompt);
          logger.info("NEURAL", `Prompt dịch sang tiếng Anh: "${finalPrompt}"`);
        } catch (translateError) {
          logger.warn(
            "NEURAL",
            `Không thể dịch prompt: ${translateError.message}. Sử dụng prompt gốc.`
          );
        }
      }

      if (progressTracker) {
        // Cập nhật trạng thái: Đang khởi tạo
        await progressTracker.update("Đang khởi tạo", 20);
      }

      const gradioModule = await this.loadGradioClient();
      const { Client } = gradioModule;

      const options = {
        status_callback: (status) => {
          logger.info(
            "NEURAL",
            `Trạng thái Gradio Space ${this.gradioImageSpace}: ${
              status.status
            } - ${status.detail || ""}`
          );

          if (progressTracker) {
            if (status.status === "running") {
              progressTracker.update("Đang tạo concept", 30);
            } else if (status.status === "processing") {
              progressTracker.update("Đang tạo hình ảnh sơ bộ", 40);
            }
          }

          if (status.status === "error" && status.detail === "NOT_FOUND") {
            if (progressTracker)
              progressTracker.error(
                `Space ${this.gradioImageSpace} không tồn tại hoặc không khả dụng.`
              );
            throw new Error(
              `Space ${this.gradioImageSpace} không tồn tại hoặc không khả dụng.`
            );
          }
          if (status.status === "error") {
            logger.error(
              "NEURAL",
              `Lỗi từ Gradio Space ${this.gradioImageSpace}: ${
                status.message || status.detail
              }`
            );
            if (progressTracker) progressTracker.update("Đang xử lý lỗi", 30);
          }
        },
      };

      logger.info(
        "NEURAL",
        `Đang kết nối đến Gradio Space public: ${this.gradioImageSpace}`
      );

      if (progressTracker) {
        await progressTracker.update("Đang tạo concept", 35);
      }

      let app;
      try {
        app = await Client.connect(this.gradioImageSpace, options);
      } catch (connectError) {
        logger.error(
          "NEURAL",
          `Không thể kết nối đến Space ${this.gradioImageSpace}: ${connectError.message}`
        );
        if (
          connectError.message.toLowerCase().includes("authorization") ||
          connectError.message.toLowerCase().includes("private space")
        ) {
          const errorMsg = `Không thể kết nối đến Space private ${this.gradioImageSpace}. Vui lòng cung cấp hf_token hợp lệ.`;
          if (progressTracker) progressTracker.error(errorMsg);
          throw new Error(errorMsg);
        }
        const errorMsg = `Space ${this.gradioImageSpace} không khả dụng. Vui lòng kiểm tra trạng thái Space.`;
        if (progressTracker) progressTracker.error(errorMsg);
        throw new Error(errorMsg);
      }

      logger.info(
        "NEURAL",
        `Kiểm tra API endpoints của Gradio Space ${this.gradioImageSpace}...`
      );
      const api = await app.view_api();

      const apiEndpointName = "/generate_image"; // Tên API standard

      if (!api.named_endpoints || !api.named_endpoints[apiEndpointName]) {
        const hasUnnamedEndpoint =
          api.unnamed_endpoints &&
          Object.keys(api.unnamed_endpoints).length > 0;
        if (!hasUnnamedEndpoint) {
          const errorMsg = `Space ${this.gradioImageSpace} không có endpoint ${apiEndpointName} hoặc bất kỳ API endpoint nào. Vui lòng kiểm tra cấu hình app.py.`;
          if (progressTracker) progressTracker.error(errorMsg);
          throw new Error(errorMsg);
        }
        logger.warn(
          "NEURAL",
          `Space ${this.gradioImageSpace} không có endpoint có tên ${apiEndpointName}. Sẽ thử sử dụng endpoint đầu tiên có sẵn.`
        );
        if (progressTracker) {
          await progressTracker.update("Đang tìm endpoint thay thế", 40);
        }
      }

      if (progressTracker) {
        await progressTracker.update("Đang tạo hình ảnh sơ bộ", 50);
      }

      logger.info(
        "NEURAL",
        `Đang gọi endpoint ${apiEndpointName} trên Space ${this.gradioImageSpace}...`
      );
      const result = await app.predict(apiEndpointName, [
        finalPrompt, // prompt
        "", // negative_prompt
        0, // seed
        true, // randomize_seed
        768, // width
        768, // height
        2.0, // guidance_scale
        1, // num_inference_steps
      ]);

      if (progressTracker) {
        await progressTracker.update("Đang tinh chỉnh chi tiết", 75);
      }

      if (!result || !result.data) {
        logger.error(
          "NEURAL",
          `Không nhận được phản hồi hợp lệ từ Gradio API. Result: ${JSON.stringify(
            result
          )}`
        );
        const errorMsg = "Không nhận được phản hồi hợp lệ từ Gradio API.";
        if (progressTracker) progressTracker.error(errorMsg);
        throw new Error(errorMsg);
      }

      const imageData = result.data[0];
      // const newSeed = result.data[1];

      if (!imageData || typeof imageData !== "object") {
        const errorMsg = `Dữ liệu hình ảnh không hợp lệ từ API: ${JSON.stringify(
          imageData
        )}`;
        if (progressTracker) progressTracker.error(errorMsg);
        throw new Error(errorMsg);
      }

      if (progressTracker) {
        await progressTracker.update("Đang hoàn thiện hình ảnh", 85);
      }

      let imageUrl = imageData.url || imageData.path || imageData.image;

      const uniqueFilename = `generated_image_${Date.now()}.png`;
      const outputPath = `./temp/${uniqueFilename}`;
      if (!fs.existsSync("./temp")) {
        fs.mkdirSync("./temp", { recursive: true });
      }

      let imageBuffer = null;

      if (progressTracker) {
        await progressTracker.update("Đang xử lý kết quả", 90);
      }

      if (typeof imageUrl === "string" && imageUrl.startsWith("http")) {
        logger.info("NEURAL", `Đang tải hình ảnh từ URL: ${imageUrl}`);
        const imageResponse = await axios.get(imageUrl, {
          responseType: "arraybuffer",
          timeout: 60000,
        });
        imageBuffer = Buffer.from(imageResponse.data);
        fs.writeFileSync(outputPath, imageBuffer);
      } else if (
        typeof imageUrl === "string" &&
        imageUrl.startsWith("data:image")
      ) {
        // Xử lý base64
        logger.info("NEURAL", "Nhận được hình ảnh base64.");
        const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
        imageBuffer = Buffer.from(base64Data, "base64");
        fs.writeFileSync(outputPath, imageBuffer);
      } else if (imageData.is_file && imageData.name) {
        // Trường hợp Gradio trả về file object
        logger.info(
          "NEURAL",
          `Nhận được file path: ${imageData.name}, đang tạo URL đầy đủ.`
        );
        // Tạo URL đầy đủ từ file path
        imageUrl = `${this.gradioImageSpace.replace(/\/+$/, "")}/file=${
          imageData.name
        }`;
        const imageResponse = await axios.get(imageUrl, {
          responseType: "arraybuffer",
          timeout: 60000,
        });
        imageBuffer = Buffer.from(imageResponse.data);
        fs.writeFileSync(outputPath, imageBuffer);
      } else {
        const errorMsg = `Định dạng URL hình ảnh không được hỗ trợ hoặc không tìm thấy: ${imageUrl}`;
        if (progressTracker) progressTracker.error(errorMsg);
        throw new Error(errorMsg);
      }

      if (progressTracker) {
        await progressTracker.update("Đang lưu hình ảnh", 95);
      }

      logger.info(
        "NEURAL",
        `Đã tạo hình ảnh thành công và lưu tại: ${outputPath}`
      );

      if (progressTracker) {
        await progressTracker.complete();
      }

      return {
        buffer: imageBuffer,
        url: imageUrl.startsWith("data:image") ? "base64_image_data" : imageUrl,
        localPath: outputPath,
        source: `Luna-image`,
      };
    } catch (error) {
      if (!this.generateImage.isBlocked) {
        logger.error(
          "NEURAL",
          `Lỗi khi tạo hình ảnh: ${error.message}`,
          error.stack
        );
        if (progressTracker) progressTracker.error(error.message);
        throw new Error(`Không thể tạo hình ảnh: ${error.message}`);
      } else {
        throw new Error(`Prompt chứa nội dung không phù hợp`);
      }
    }
  }

  /**
   * Kiểm tra kết nối đến Gradio Space
   * @returns {Promise<boolean>} - Kết quả kết nối (true/false)
   */
  async testGradioConnection() {
    try {
      const gradioModule = await this.loadGradioClient();
      const { Client } = gradioModule;

      const options = {
        status_callback: (status) => {
          logger.info(
            "NEURAL",
            `Trạng thái Gradio Space ${this.gradioImageSpace}: ${
              status.status
            } - ${status.detail || ""}`
          );
          if (status.status === "error") {
            logger.error(
              "NEURAL",
              `Lỗi từ Gradio Space ${this.gradioImageSpace}: ${
                status.message || status.detail
              }`
            );
          }
        },
      };

      const app = await Client.connect(this.gradioImageSpace, options);

      const api = await app.view_api();
      const apiEndpointName = "/generate_image";

      if (!api.named_endpoints || !api.named_endpoints[apiEndpointName]) {
        const hasUnnamedEndpoint =
          api.unnamed_endpoints &&
          Object.keys(api.unnamed_endpoints).length > 0;
        if (!hasUnnamedEndpoint) {
          logger.warn(
            "NEURAL",
            `Space ${this.gradioImageSpace} không có endpoint ${apiEndpointName} hoặc bất kỳ API endpoint nào. Vui lòng kiểm tra cấu hình app.py.`
          );
          return false;
        }
        logger.warn(
          "NEURAL",
          `Space ${this.gradioImageSpace} không có endpoint có tên ${apiEndpointName}. Sẽ thử sử dụng endpoint đầu tiên có sẵn.`
        );
      }

      logger.info(
        "NEURAL",
        `Kết nối thành công đến Gradio Space ${this.gradioImageSpace}`
      );
      return true;
    } catch (error) {
      logger.error(
        "NEURAL",
        `Lỗi kết nối đến Gradio Space ${this.gradioImageSpace}: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Xử lý tin nhắn Discord
   * @param {Discord.Message} message - Đối tượng tin nhắn Discord
   * @returns {Object} - Thông tin về nội dung đã xử lý
   */
  async processDiscordMessage(message) {
    try {
      const originalContent = message.content;
      console.log("Nội dung gốc của tin nhắn Discord:", originalContent);

      let cleanContent = message.cleanContent || originalContent;
      console.log("Nội dung đã xử lý của tin nhắn Discord:", cleanContent);

      return {
        cleanContent: cleanContent,
        hasMentions: false,
      };
    } catch (error) {
      console.error("Lỗi khi xử lý tin nhắn Discord:", error);
      return {
        cleanContent: message.content || "",
        hasMentions: false,
      };
    }
  }

  /**
   * Xử lý prompt từ Discord và gửi đến API
   * @param {Discord.Message} message - Đối tượng tin nhắn Discord
   * @returns {Promise<string>} - Phản hồi từ AI
   */
  async getCompletionFromDiscord(message) {
    const processedMessage = await this.processDiscordMessage(message);

    if (
      processedMessage.cleanContent.toLowerCase() === "reset conversation" ||
      processedMessage.cleanContent.toLowerCase() === "xóa lịch sử" ||
      processedMessage.cleanContent.toLowerCase() === "quên hết đi"
    ) {
      await storageDB.clearConversationHistory(
        message.author.id,
        this.systemPrompt,
        this.Model
      );
      return "Đã xóa lịch sử cuộc trò chuyện của chúng ta. Bắt đầu cuộc trò chuyện mới nào! 😊";
    }

    return await this.getCompletion(processedMessage.cleanContent, message);
  }

  /**
   * Trả về tên mô hình được hiển thị cho người dùng
   * @returns {string} - Tên mô hình hiển thị
   */
  getModelName() {
    return this.Model;
  }

  /**
   * Dịch prompt tiếng Việt sang tiếng Anh để tối ưu kết quả tạo hình ảnh
   * @param {string} vietnamesePrompt - Prompt tiếng Việt
   * @returns {Promise<string>} - Prompt đã được dịch sang tiếng Anh
   */
  async translatePrompt(vietnamesePrompt) {
    try {
      logger.info(
        "NEURAL",
        `Đang dịch prompt tiếng Việt: "${vietnamesePrompt}"`
      );

      const axiosInstance = this.createSecureAxiosInstance("https://api.x.ai");

      const translateRequest = prompts.translation.vietnameseToEnglish.replace(
        "${vietnameseText}",
        vietnamesePrompt
      );

      const response = await axiosInstance.post("/v1/chat/completions", {
        model: this.thinkingModel,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: translateRequest,
          },
        ],
      });

      const translatedText = response.data.choices[0].message.content.trim();

      const cleanTranslation = translatedText.replace(/^["']|["']$/g, "");

      logger.info("NEURAL", `Đã dịch thành công: "${cleanTranslation}"`);
      return cleanTranslation;
    } catch (error) {
      logger.error("NEURAL", `Lỗi khi dịch prompt: ${error.message}`);
      return vietnamesePrompt;
    }
  }

  /**
   * Tạo animation loading
   * @param {number} step - Bước hiện tại
   * @returns {string} - Loading icon
   */
  getLoadingAnimation(step) {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    return frames[step % frames.length];
  }

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

  /**
   * Theo dõi tiến trình của quá trình tạo hình ảnh
   * @param {Object} messageOrInteraction - Discord message hoặc interaction object để gửi cập nhật tiến trình
   * @param {string} prompt - Prompt đang được sử dụng
   * @returns {Object} - Controller object để cập nhật và dừng hiển thị tiến trình
   */
  trackImageGenerationProgress(messageOrInteraction, prompt) {
    const stages = [
      "Đang khởi tạo",
      "Đang phân tích prompt",
      "Đang tạo concept",
      "Đang tạo hình ảnh sơ bộ",
      "Đang tinh chỉnh chi tiết",
      "Đang hoàn thiện hình ảnh",
      "Đang xử lý kết quả",
      "Đang lưu hình ảnh",
    ];

    let currentStage = 0;
    let shouldContinue = true;
    let progressMessage = null;

    const isInteraction =
      messageOrInteraction.replied !== undefined ||
      messageOrInteraction.deferred !== undefined;

    const startTime = Date.now();
    const promptPreview =
      prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt;

    const updateProgress = async (step = 0) => {
      if (!shouldContinue || !messageOrInteraction) return;

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

      // if (step % 15 === 0 && currentStage < stages.length - 1) {
      //   currentStage++;
      // }

      const stagePercentMap = {
        0: 5, // Đang khởi tạo
        1: 15, // Đang phân tích prompt
        2: 30, // Đang tạo concept
        3: 45, // Đang tạo hình ảnh sơ bộ
        4: 60, // Đang tinh chỉnh chi tiết
        5: 75, // Đang hoàn thiện hình ảnh
        6: 90, // Đang xử lý kết quả
        7: 95, // Đang lưu hình ảnh
      };

      const percentComplete =
        stagePercentMap[currentStage] ||
        Math.min(Math.floor((currentStage / (stages.length - 1)) * 100), 99);

      const loadingEmoji = this.getLoadingAnimation(step);
      const progressBar = this.getProgressBar(percentComplete);

      const content =
        `### ${loadingEmoji} Đang Tạo Hình Ảnh...\n` +
        `> "${promptPreview}"\n` +
        `**Tiến trình:** ${progressBar}\n` +
        `**Đang thực hiện:** ${stages[currentStage]}\n` +
        `**Thời gian:** ${elapsedTime}s`;

      try {
        if (isInteraction) {
          if (!progressMessage) {
            if (
              !messageOrInteraction.deferred &&
              !messageOrInteraction.replied
            ) {
              await messageOrInteraction.deferReply();
            }
            progressMessage = await messageOrInteraction.editReply(content);
          } else {
            await messageOrInteraction.editReply(content);
          }
        } else {
          if (!progressMessage) {
            progressMessage = await messageOrInteraction.reply(content);
          } else {
            await progressMessage.edit(content);
          }
        }
      } catch (err) {
        logger.error(
          "NEURAL",
          `Lỗi khi cập nhật tin nhắn tiến trình: ${err.message}`
        );
      }
    };

    let step = 0;
    const progressInterval = setInterval(() => {
      if (!shouldContinue) {
        clearInterval(progressInterval);
        return;
      }
      updateProgress(step++);
    }, 1500);

    return {
      complete: async (imageUrl) => {
        shouldContinue = false;
        clearInterval(progressInterval);

        try {
          const content =
            `### 🎨 Hình Ảnh Đã Tạo Thành Công!\n` + `> "${promptPreview}"`;

          if (isInteraction) {
            await messageOrInteraction.editReply(content);
          } else if (progressMessage) {
            await progressMessage.edit(content);
          }
        } catch (err) {
          logger.error(
            "NEURAL",
            `Lỗi khi cập nhật thông báo hoàn tất: ${err.message}`
          );
        }

        return true;
      },

      error: async (errorMessage) => {
        shouldContinue = false;
        clearInterval(progressInterval);

        try {
          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
          let errorContent =
            `### <:oops:735756879761899521> Không Thể Tạo Hình Ảnh\n` +
            `> "${promptPreview}"\n\n`;

          if (
            errorMessage.includes("content moderation") ||
            errorMessage.includes("safety") ||
            errorMessage.includes("inappropriate")
          ) {
            errorContent += `**Lỗi:** Nội dung yêu cầu không tuân thủ nguyên tắc kiểm duyệt. Vui lòng thử chủ đề khác.\n`;
          } else if (errorMessage.includes("/generate_image")) {
            errorContent += `**Lỗi:** Không tìm thấy API endpoint phù hợp trong Space. Space có thể đang offline.\n`;
          } else {
            errorContent += `**Lỗi:** ${errorMessage.replace(
              "Không thể tạo hình ảnh: ",
              ""
            )}\n`;
          }

          errorContent += `**Thời gian đã trôi qua:** ${elapsedTime}s`;

          if (isInteraction) {
            if (messageOrInteraction.deferred || messageOrInteraction.replied) {
              await messageOrInteraction.editReply(errorContent);
            } else {
              await messageOrInteraction.reply(errorContent);
            }
          } else if (progressMessage) {
            await progressMessage.edit(errorContent);
          } else if (messageOrInteraction) {
            await messageOrInteraction.reply(errorContent);
          }
        } catch (err) {
          logger.error(
            "NEURAL",
            `Lỗi khi cập nhật thông báo lỗi: ${err.message}`
          );
        }

        return false;
      },

      update: async (stage, percent) => {
        if (!shouldContinue) return;

        if (stage && stages.includes(stage)) {
          currentStage = stages.indexOf(stage);
        }

        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
        const actualPercent =
          percent !== undefined
            ? percent
            : Math.min(
                Math.floor((currentStage / (stages.length - 1)) * 100),
                99
              );
        const loadingEmoji = this.getLoadingAnimation(step);

        const content =
          `### ${loadingEmoji} Đang Tạo Hình Ảnh...\n` +
          `> "${promptPreview}"\n` +
          `**Tiến trình:** ${this.getProgressBar(actualPercent)}\n` +
          `**Đang thực hiện:** ${stages[currentStage]}\n` +
          `**Thời gian:** ${elapsedTime}s`;

        try {
          if (isInteraction) {
            if (messageOrInteraction.deferred || messageOrInteraction.replied) {
              await messageOrInteraction.editReply(content);
            }
          } else if (progressMessage) {
            await progressMessage.edit(content);
          }
        } catch (err) {
          logger.error(
            "NEURAL",
            `Lỗi khi cập nhật tin nhắn tiến trình: ${err.message}`
          );
        }
      },
    };
  }
}

module.exports = new NeuralNetworks();
