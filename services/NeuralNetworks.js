const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const fs = require('fs');
const messageHandler = require('../handlers/messageHandler.js');
const storageDB = require('./storagedb.js');
const conversationManager = require('../handlers/conversationManager.js');
const logger = require('../utils/logger.js');
const malAPI = require('./MyAnimeListAPI.js');

class NeuralNetworks {
  constructor() {
    // Kiểm tra cài đặt TLS không an toàn và cảnh báo
    this.checkTLSSecurity();

    // Lấy API key từ biến môi trường
    this.apiKey = process.env.XAI_API_KEY;
    if (!this.apiKey) {
      throw new Error('API không được đặt trong biến môi trường');
    }

    // Khởi tạo client Anthropic với cấu hình X.AI
    this.client = new Anthropic({
      apiKey: this.apiKey,
      baseURL: 'https://api.x.ai'
    });

    // System Prompt
    this.systemPrompt = "Your name is Luna, you were created by s4ory. You are a female-voiced AI with a cute, friendly, and warm tone. You speak naturally and gently, like a lovely older or younger sister, always maintaining professionalism without sounding too formal. When it fits, you can add light humor, emotion, or gentle encouragement. You always listen carefully and respond based on what the user shares, making them feel comfortable and connected — like chatting with someone who truly gets them, priority reply Vietnamese.";

    this.CoreModel = 'grok-3-fast-beta';
    this.imageModel = 'grok-2-image-1212';
    this.thinkingModel = 'grok-3-mini';
    this.Model = 'luna-v1-preview';

    // Cấu hình StorageDB
    storageDB.setMaxConversationLength(10);
    storageDB.setMaxConversationAge(3 * 60 * 60 * 1000);

    // Khởi tạo mảng rỗng để sử dụng trước khi có dữ liệu từ MongoDB
    this.greetingPatterns = [];

    logger.info('NEURAL', `Model chat: ${this.CoreModel} & ${this.Model}`);
    logger.info('NEURAL', `Model tạo hình ảnh: ${this.imageModel}`);
  }

  /**
   * Khởi tạo các mẫu lời chào từ MongoDB
   */
  async initializeGreetingPatterns() {
    try {
      // Khởi tạo mẫu lời chào mặc định nếu chưa có
      await storageDB.initializeDefaultGreetingPatterns();

      // Tải mẫu lời chào từ cơ sở dữ liệu
      this.greetingPatterns = await storageDB.getGreetingPatterns();
      logger.info('NEURAL', `Đã tải ${this.greetingPatterns.length} mẫu lời chào từ cơ sở dữ liệu`);
    } catch (error) {
      logger.error('NEURAL', 'Lỗi khi khởi tạo mẫu lời chào:', error);
      this.greetingPatterns = [];
    }
  }

  /**
   * Cập nhật mẫu lời chào từ cơ sở dữ liệu
   */
  async refreshGreetingPatterns() {
    try {
      this.greetingPatterns = await storageDB.getGreetingPatterns();
      logger.info('NEURAL', `Đã cập nhật ${this.greetingPatterns.length} mẫu lời chào từ cơ sở dữ liệu`);
    } catch (error) {
      logger.error('NEURAL', 'Lỗi khi cập nhật mẫu lời chào:', error);
    }
  }

  /**
   * Kiểm tra cài đặt bảo mật TLS
   */
  checkTLSSecurity() {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
      logger.warn('SYSTEM', '⚠️ CẢNH BÁO BẢO MẬT: NODE_TLS_REJECT_UNAUTHORIZED=0 ⚠️');
      logger.warn('SYSTEM', 'Cài đặt này làm vô hiệu hóa xác minh chứng chỉ SSL/TLS, khiến tất cả kết nối HTTPS không an toàn!');
      logger.warn('SYSTEM', 'Điều này chỉ nên được sử dụng trong môi trường phát triển, KHÔNG BAO GIỜ trong sản xuất.');
      logger.warn('SYSTEM', 'Để khắc phục, hãy xóa biến môi trường NODE_TLS_REJECT_UNAUTHORIZED=0 hoặc sử dụng giải pháp bảo mật hơn.');
      logger.warn('SYSTEM', 'Nếu bạn đang gặp vấn đề với chứng chỉ tự ký, hãy cấu hình đường dẫn chứng chỉ CA trong thiết lập axios.');
    }
  }

  /**
   * Tạo cấu hình Axios với xử lý chứng chỉ phù hợp
   */
  createSecureAxiosInstance(baseURL) {
    const options = {
      baseURL: baseURL || 'https://api.x.ai',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2025-04-15',
        'User-Agent': `Luna/${this.Model}`,
        'Accept': 'application/json'
      }
    };

    const certPath = process.env.CUSTOM_CA_CERT_PATH;
    if (certPath && fs.existsSync(certPath)) {
      const ca = fs.readFileSync(certPath);
      options.httpsAgent = new require('https').Agent({ ca });
      logger.info('SYSTEM', `Đang sử dụng chứng chỉ CA tùy chỉnh từ: ${certPath}`);
    }

    return axios.create(options);
  }

  /**
   * Thực hiện tìm kiếm web bằng Google Custom Search API
   * @param {string} query - Truy vấn tìm kiếm
   * @returns {Promise<Array>} - Danh sách kết quả tìm kiếm
   */
  async performWebSearch(query) {
    try {
      const googleApiKey = process.env.GOOGLE_API_KEY;
      const googleCseId = process.env.GOOGLE_CSE_ID;

      if (!googleApiKey || !googleCseId) {
        logger.warn('API', 'Thiếu GOOGLE_API_KEY hoặc GOOGLE_CSE_ID trong biến môi trường. Bỏ qua tìm kiếm web.');
        return [];
      }

      // Tối ưu truy vấn tìm kiếm
      const optimizedQuery = this.optimizeSearchQuery(query);

      logger.info('API', `Đang thực hiện tìm kiếm web cho: "${optimizedQuery}"`);

      const axiosInstance = axios.create({
        baseURL: 'https://www.googleapis.com',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000 // Thêm timeout để tránh chờ đợi quá lâu
      });

      const response = await axiosInstance.get('/customsearch/v1', {
        params: {
          key: googleApiKey,
          cx: googleCseId,
          q: optimizedQuery,
          num: 5,
          hl: 'vi', // Ưu tiên kết quả tiếng Việt
          gl: 'vn'  // Ưu tiên kết quả từ Việt Nam
        }
      });

      const results = response.data.items
        ? response.data.items.map(item => ({
            title: item.title,
            snippet: item.snippet,
            url: item.link,
            date: item.pagemap?.metatags?.[0]?.['article:published_time'] || null
          }))
        : [];

      logger.info('API', `Đã tìm thấy ${results.length} kết quả cho truy vấn: ${optimizedQuery}`);
      return results;
    } catch (error) {
      logger.error('API', 'Lỗi khi thực hiện tìm kiếm web:', error.message);
      return [];
    }
  }

  /**
   * Tối ưu hoá truy vấn tìm kiếm để có kết quả chính xác hơn
   * @param {string} query - Truy vấn gốc
   * @returns {string} - Truy vấn đã được tối ưu
   */
  optimizeSearchQuery(query) {
    // Loại bỏ các từ hỏi thông thường để tập trung vào từ khóa chính
    const commonQuestionWords = /^(làm thế nào|tại sao|tại sao lại|là gì|có phải|ai là|khi nào|ở đâu|what is|how to|why|who is|when|where)/i;
    let optimized = query.replace(commonQuestionWords, '').trim();

    // Loại bỏ các cụm từ yêu cầu cá nhân
    const personalRequests = /(tôi muốn biết|cho tôi biết|hãy nói cho tôi|tell me|i want to know|please explain)/i;
    optimized = optimized.replace(personalRequests, '').trim();

    // Nếu truy vấn quá ngắn sau khi tối ưu, sử dụng truy vấn gốc
    if (optimized.length < 5) {
      return query;
    }

    return optimized;
  }

  /**
   * Tạo prompt cải tiến với kết quả tìm kiếm
   * @param {string} originalPrompt - Prompt ban đầu
   * @param {Array} searchResults - Kết quả tìm kiếm
   * @returns {string} - Prompt đã cải tiến
   */
  createSearchEnhancedPrompt(originalPrompt, searchResults) {
    if (searchResults.length === 0) {
      return originalPrompt;
    }

    // Loại bỏ các kết quả trùng lặp hoặc không liên quan
    const relevantResults = this.filterRelevantResults(searchResults, originalPrompt);

    if (relevantResults.length === 0) {
      return originalPrompt;
    }

    let enhancedPrompt = `${originalPrompt}\n\n[SEARCH INFORMATION]\n`;
    enhancedPrompt += 'Below is relevant information from the web. Use this information when appropriate to supplement your answer, but you don\'t need to reference all of it:\n\n';

    relevantResults.forEach((result, index) => {
      enhancedPrompt += `[Source ${index + 1}]: ${result.title}\n`;
      enhancedPrompt += `${result.snippet}\n`;
      enhancedPrompt += `URL: ${result.url}\n\n`;
    });

    enhancedPrompt += 'Naturally incorporate the above information into your answer without explicitly listing the sources. Respond in a friendly tone, not too academic.';

    return enhancedPrompt;
  }

  /**
   * Lọc kết quả tìm kiếm để lấy những kết quả liên quan nhất
   * @param {Array} results - Danh sách kết quả tìm kiếm
   * @param {string} query - Truy vấn gốc
   * @returns {Array} - Danh sách kết quả đã được lọc
   */
  filterRelevantResults(results, query) {
    if (results.length === 0) return [];

    // Trích xuất từ khóa chính từ truy vấn
    const keywords = this.extractKeywords(query);

    // Tính điểm liên quan cho mỗi kết quả
    const scoredResults = results.map(result => {
      let score = 0;

      // Kiểm tra sự xuất hiện của từ khóa trong tiêu đề và đoạn trích
      keywords.forEach(keyword => {
        if (result.title.toLowerCase().includes(keyword.toLowerCase())) score += 2;
        if (result.snippet.toLowerCase().includes(keyword.toLowerCase())) score += 1;
      });

      // Ưu tiên các kết quả có ngày mới hơn
      if (result.date) {
        const resultDate = new Date(result.date);
        const now = new Date();
        const monthsAgo = (now - resultDate) / (1000 * 60 * 60 * 24 * 30);
        if (monthsAgo < 3) score += 2; // Trong vòng 3 tháng
        else if (monthsAgo < 12) score += 1; // Trong vòng 1 năm
      }

      return { ...result, relevanceScore: score };
    });

    // Sắp xếp theo điểm liên quan và chỉ lấy tối đa 3 kết quả có liên quan nhất
    return scoredResults
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .filter(result => result.relevanceScore > 0)
      .slice(0, 3);
  }

  /**
   * Phân tích tin nhắn cho chức năng giám sát
   * @param {string} prompt - Prompt phân tích tin nhắn
   * @returns {Promise<string>} - Kết quả phân tích
   */
  async getMonitoringAnalysis(prompt) {
    try {
      logger.debug('MONITOR', `Đang phân tích tin nhắn cho chức năng giám sát`);
      logger.debug('MONITOR', `Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);

      // Sử dụng Axios với cấu hình bảo mật
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');

      // Tạo một ID riêng cho chức năng giám sát
      const monitorId = `monitor-${Date.now()}`;

      // Thực hiện yêu cầu API với prompt giám sát
      const response = await axiosInstance.post('/v1/chat/completions', {
        model: this.CoreModel,
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: `Bạn là trợ lý phân tích tin nhắn. Nhiệm vụ của bạn là phân tích tin nhắn và xác định xem nó có vi phạm quy tắc nào không.

QUAN TRỌNG: Hãy phân tích kỹ lưỡng và chính xác. Nếu tin nhắn có chứa chính xác nội dung bị cấm trong quy tắc, hãy trả lời "VIOLATION: Có". Nếu không, trả lời "VIOLATION: Không".

Ví dụ: Nếu quy tắc là "không chat s4ory" và tin nhắn chứa "s4ory", thì đó là vi phạm.

Trả lời theo định dạng chính xác sau:
VIOLATION: Có/Không
RULE: [Số thứ tự quy tắc hoặc "Không có"]
SEVERITY: Thấp/Trung bình/Cao/Không có
FAKE: Có/Không
ACTION: Không cần hành động/Cảnh báo/Xóa tin nhắn/Mute/Kick/Ban
REASON: [Giải thích ngắn gọn]`
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      logger.debug('MONITOR', 'Đã nhận phản hồi từ API cho chức năng giám sát');
      const content = response.data.choices[0].message.content;
      logger.debug('MONITOR', `Kết quả phân tích: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);

      // Kiểm tra xem kết quả có đúng định dạng không
      if (!content.includes('VI_PHẠM:') && !content.includes('QUY_TẮC_VI_PHẠM:')) {
        logger.debug('MONITOR', 'Kết quả không đúng định dạng, đang chuyển đổi...');
        // Nếu không đúng định dạng, chuyển đổi sang định dạng chuẩn
        return `VI_PHẠM: Không\nQUY_TẮC_VI_PHẠM: Không có\nMỨC_ĐỘ: Không có\nDẤU_HIỆU_GIẢ_MẠO: Không\nĐỀ_XUẤT: Không cần hành động\nLÝ_DO: Không phát hiện vi phạm`;
      }

      return content;
    } catch (error) {
      logger.error('MONITOR', `Lỗi khi gọi X.AI API cho chức năng giám sát:`, error.message);
      if (error.response) {
        logger.error('MONITOR', 'Chi tiết lỗi:', JSON.stringify(error.response.data, null, 2));
      }
      return `VI_PHẠM: Không\nQUY_TẮC_VI_PHẠM: Không có\nMỨC_ĐỘ: Không có\nDẤU_HIỆU_GIẢ_MẠO: Không\nĐỀ_XUẤT: Không cần hành động\nLÝ_DO: Lỗi kết nối API: ${error.message}`;
    }
  }

  /**
   * Nhận phản hồi trò chuyện từ API
   */
  async getCompletion(prompt, message = null) {
    // Nếu đây là yêu cầu từ chức năng giám sát và không phải từ tin nhắn tag bot, chuyển sang phương thức riêng
    // Chỉ chuyển sang getMonitoringAnalysis khi không có message object (không phải từ Discord)
    if (!message && (prompt.includes('VI_PHẠM:') || prompt.includes('QUY_TẮC_VI_PHẠM:') || prompt.includes('MỨC_ĐỘ:'))) {
      logger.debug('NEURAL', 'Chuyển sang phương thức getMonitoringAnalysis');
      return this.getMonitoringAnalysis(prompt);
    }

    // Nếu có message object (từ Discord), luôn xử lý như tin nhắn trò chuyện bình thường
    if (message && message.mentions && message.mentions.has(this.client?.user)) {
      logger.debug('NEURAL', 'Xử lý tin nhắn tag bot như tin nhắn trò chuyện bình thường');
    }
    try {
      // Trích xuất ID người dùng từ tin nhắn hoặc tạo một ID cho tương tác không phải Discord
      const userId = message?.author?.id || 'default-user';

      // Kiểm tra xem prompt có chứa nội dung liên quan đến anime/manga không
      if (this.containsAnimeRelatedContent(prompt)) {
        logger.info('NEURAL', 'Phát hiện nội dung liên quan đến anime/manga');
        return await this.processAnimeRelatedRequest(prompt, message);
      }

      // Kiểm tra xem prompt có phải là lệnh liên quan đến MyAnimeList không
      const malRegex = /(^|\s)(anime|manga|mal|myanimelist|อนิเมะ|อนิเมะ|アニメ|漫画|애니메이션|만화)([\s:]+|\s+về\s+|\s+info\s+|\s+thông tin\s+|\s+chi tiết\s+|\s+tìm\s+|\s+kiếm\s+|\s+search\s+|\s+season\s+|\s+mùa\s+|\s+xếp hạng\s+|\s+ranking\s+|\s+top\s+|\s+bxh\s+)(.+)/i;
      const malMatch = prompt.match(malRegex);

      if (malMatch) {
        logger.info('NEURAL', 'Phát hiện lệnh liên quan đến MyAnimeList');
        return await this.handleMyAnimeListRequest(malMatch[2].toLowerCase(), malMatch[4], message);
      }

      // Kiểm tra xem lời nhắc có phải là lệnh tạo hình ảnh không (với hỗ trợ lệnh tiếng Việt mở rộng)
      const imageCommandRegex = /^(vẽ|tạo hình|vẽ hình|hình|tạo ảnh ai|tạo ảnh)\s+(.+)$/i;
      const imageMatch = prompt.match(imageCommandRegex);

      if (imageMatch) {
        // Trích xuất mô tả hình ảnh (bây giờ trong nhóm 2)
        const imagePrompt = imageMatch[2];
        const commandUsed = imageMatch[1];
        logger.info('NEURAL', `Phát hiện lệnh tạo hình ảnh "${commandUsed}". Prompt: ${imagePrompt}`);

        // Nếu có message object (từ Discord), sử dụng messageHandler
        if (message) {
          // Truyền hàm generateImage được bind với this
          return await messageHandler.handleDiscordImageGeneration(
            message,
            imagePrompt,
            this.generateImage.bind(this)
          );
        }

        // Nếu không, tạo hình ảnh và trả về URL như thông thường
        return await this.generateImage(imagePrompt);
      }

      // Kiểm tra xem có phải là lệnh yêu cầu phân tích ký ức không
      const memoryAnalysisRegex = /^(nhớ lại|trí nhớ|lịch sử|conversation history|memory|như nãy|vừa gửi|vừa đề cập)\s*(.*)$/i;
      const memoryMatch = prompt.match(memoryAnalysisRegex);

      if (memoryMatch) {
        const memoryRequest = memoryMatch[2].trim() || "toàn bộ cuộc trò chuyện";
        return await this.getMemoryAnalysis(userId, memoryRequest);
      }

      logger.info('NEURAL', `Đang xử lý yêu cầu chat completion cho prompt: "${prompt.substring(0, 50)}..."`);

      // Xác định xem prompt có cần tìm kiếm web hay không
      const shouldSearchWeb = this.shouldPerformWebSearch(prompt);
      let searchResults = [];

      if (shouldSearchWeb) {
        logger.info('NEURAL', "Prompt có vẻ cần thông tin từ web, đang thực hiện tìm kiếm...");
        searchResults = await this.performWebSearch(prompt);
      } else {
        logger.info('NEURAL', "Sử dụng kiến thức có sẵn, không cần tìm kiếm web");
      }

      // Tạo prompt được nâng cao với kết quả tìm kiếm (nếu có)
      const promptWithSearch = searchResults.length > 0
        ? this.createSearchEnhancedPrompt(prompt, searchResults)
        : prompt;

      // Bổ sung thông tin từ trí nhớ cuộc trò chuyện
      const enhancedPromptWithMemory = await this.enrichPromptWithMemory(promptWithSearch, userId);

      // Sử dụng Axios với cấu hình bảo mật
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');

      // Lấy lịch sử cuộc trò chuyện hiện có
      const conversationHistory = await conversationManager.loadConversationHistory(userId, this.systemPrompt, this.Model);

      // Xác định xem có phải là cuộc trò chuyện mới hay không
      const isNewConversation = conversationHistory.length <= 2; // Chỉ có system prompt và tin nhắn hiện tại

      // Add specific instructions about response style, with guidance about greetings
      let enhancedPrompt = `Reply like a smart, sweet, and charming young woman named Luna. Use gentle, friendly language — nothing too stiff or robotic.`;

      // Add instructions not to send greetings if in an existing conversation
      if (!isNewConversation) {
        enhancedPrompt += ` IMPORTANT: This is an ongoing conversation, DO NOT introduce yourself again or send greetings like "Chào bạn", "Hi", "Hello" or "Mình là Luna". Continue the conversation naturally without reintroducing yourself.`;
      } else {
        enhancedPrompt += ` If it fits the context, feel free to sprinkle in light humor or kind encouragement.`;
      }

      if (searchResults.length > 0) {
        enhancedPrompt += ` I've provided you with web search results. Incorporate this information naturally into your response without explicitly listing the sources. Respond in a conversational tone as Luna, not as an information aggregator.`;
      }

      enhancedPrompt += ` Avoid sounding too textbook-y or dry. If the user says something interesting, pick up on it naturally to keep the flow going. ${enhancedPromptWithMemory}`;

      // Chuẩn bị tin nhắn cho lịch sử cuộc trò chuyện
      const userMessage = enhancedPrompt || prompt;

      // Thêm tin nhắn người dùng vào lịch sử
      await conversationManager.addMessage(userId, 'user', userMessage);

      // Tạo mảng tin nhắn hoàn chỉnh với lịch sử cuộc trò chuyện của người dùng cụ thể
      const messages = conversationManager.getHistory(userId);

      // Thực hiện yêu cầu API với lịch sử cuộc trò chuyện
      const response = await axiosInstance.post('/v1/chat/completions', {
        model: this.CoreModel,
        max_tokens: 2048,
        messages: messages
      });

      logger.info('NEURAL', 'Đã nhận phản hồi từ API');
      let content = response.data.choices[0].message.content;

      // Thêm phản hồi của trợ lý vào lịch sử cuộc trò chuyện
      await conversationManager.addMessage(userId, 'assistant', content);

      // Xử lý và định dạng phản hồi
      content = await this.formatResponseContent(content, isNewConversation, searchResults);

      return content;
    } catch (error) {
      logger.error('NEURAL', `Lỗi khi gọi X.AI API:`, error.message);
      if (error.response) {
        logger.error('NEURAL', 'Chi tiết lỗi:', JSON.stringify(error.response.data, null, 2));
      }
      return `Xin lỗi, tôi không thể kết nối với dịch vụ AI. Lỗi: ${error.message}`;
    }
  }

  /**
   * Kiểm tra xem nội dung có liên quan đến anime/manga không
   * @param {string} prompt - Nội dung tin nhắn
   * @returns {boolean} - true nếu nội dung liên quan đến anime/manga
   */
  containsAnimeRelatedContent(prompt) {
    // Các từ khóa phổ biến liên quan đến anime/manga
    const animeKeywords = [
      // Các thuật ngữ cơ bản
      /\b(anime|manga|light novel|webtoon|manhwa|manhua)\b/i,
      
      // Các thuật ngữ tiếng Việt
      /\b(truyện tranh nhật|hoạt hình nhật|phim hoạt hình nhật bản)\b/i,
      
      // Studio và nhà xuất bản phổ biến
      /\b(studio ghibli|kyoto animation|toei animation|shaft|bones|madhouse|ufotable|mappa|a-1 pictures|wit studio|shueisha|viz media)\b/i,
      
      // Thể loại anime phổ biến
      /\b(isekai|shonen|shounen|shoujo|shojo|seinen|josei|mecha|slice of life|harem|romcom)\b/i,
      
      // Các dịch vụ streaming anime
      /\b(crunchyroll|funimation|animelab|wakanim|netflix anime|hulu anime|myanimelist)\b/i,
      
      // Các sự kiện và thuật ngữ anime
      /\b(cosplay|anime convention|anime expo|otaku|weeb|waifu|husbando|senpai|kohai|chan|kun|san|sama)\b/i,
      
      // Các anime nổi tiếng
      /\b(naruto|one piece|bleach|dragon ball|attack on titan|demon slayer|kimetsu no yaiba|my hero academia|full metal alchemist|death note|sword art online|hunter x hunter|jojo|evangelion|sailor moon|detective conan)\b/i
    ];

    // Kiểm tra từng biểu thức chính quy
    for (const regex of animeKeywords) {
      if (regex.test(prompt)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Xử lý yêu cầu liên quan đến anime/manga
   * @param {string} prompt - Nội dung tin nhắn
   * @param {object} message - Đối tượng tin nhắn Discord (nếu có)
   * @returns {Promise<string|Object>} - Phản hồi
   */
  async processAnimeRelatedRequest(prompt, message) {
    try {
      // Extract userId from message or use default
      const userId = message?.author?.id || 'default-user';
      
      // Chuyển đổi prompt thành chữ thường để so sánh dễ dàng hơn
      const promptLower = prompt.toLowerCase();
      
      // Xử lý trực tiếp các trường hợp phổ biến trước khi gọi API phân tích
      // 1. Xử lý trường hợp yêu cầu về top anime/manga
      const topAnimeRegex = /(top|best|xếp hạng|bxh)\s+(anime|manga)(\s+(năm|year)\s+(\d{4}))?/i;
      const topAnimeMatch = prompt.match(topAnimeRegex);
      
      if (topAnimeMatch || promptLower.includes('top anime') || promptLower.includes('xếp hạng anime')) {
        const dataType = topAnimeMatch ? topAnimeMatch[2].toLowerCase() : 'anime';
        const year = topAnimeMatch ? topAnimeMatch[5] : null;
        
        logger.info('NEURAL', `Phát hiện yêu cầu về top ${dataType}${year ? ` năm ${year}` : ''}`);
        
        // Xác định loại ranking 
        let rankingType = 'all';
        if (promptLower.includes('đang phát') || promptLower.includes('airing')) {
          rankingType = 'airing';
        } else if (promptLower.includes('sắp ra mắt') || promptLower.includes('upcoming')) {
          rankingType = 'upcoming';
        } else if (promptLower.includes('phổ biến') || promptLower.includes('popular')) {
          rankingType = 'bypopularity';
        } else if (promptLower.includes('yêu thích') || promptLower.includes('favorite')) {
          rankingType = 'favorite';
        } else if (promptLower.includes('movie') || promptLower.includes('phim')) {
          rankingType = 'movie';
        } else if (promptLower.includes('tv')) {
          rankingType = 'tv';
        }
        
        return await this.handleMALRanking({
          dataType: dataType,
          searchTerm: '',
          additionalInfo: {
            rankingType: rankingType
          }
        }, message);
      }
      
      // 2. Xử lý trường hợp tìm kiếm anime/manga trực tiếp
      const searchAnimeRegex = /(tìm|search|find|lookup|info)\s+(anime|manga)\s+(.+)/i;
      const searchAnimeMatch = prompt.match(searchAnimeRegex);
      
      if (searchAnimeMatch) {
        const dataType = searchAnimeMatch[2].toLowerCase();
        const searchTerm = searchAnimeMatch[3].trim();
        
        logger.info('NEURAL', `Phát hiện yêu cầu tìm kiếm ${dataType}: "${searchTerm}"`);
        
        return await this.handleMALSearch({
          dataType: dataType,
          searchTerm: searchTerm,
          additionalInfo: {}
        }, message);
      }
      
      // 3. Xử lý trường hợp chi tiết anime/manga trực tiếp
      const detailsAnimeRegex = /(chi tiết|details|chi tiết về|thông tin về|thông tin chi tiết về)\s+(anime|manga)\s+(.+)/i;
      const detailsAnimeMatch = prompt.match(detailsAnimeRegex);
      
      if (detailsAnimeMatch) {
        const dataType = detailsAnimeMatch[2].toLowerCase();
        const searchTerm = detailsAnimeMatch[3].trim();
        
        logger.info('NEURAL', `Phát hiện yêu cầu chi tiết ${dataType}: "${searchTerm}"`);
        
        return await this.handleMALDetails({
          dataType: dataType,
          searchTerm: searchTerm,
          additionalInfo: {}
        }, message);
      }
      
      // 4. Xử lý trường hợp anime theo mùa
      const seasonalAnimeRegex = /(anime|phim)\s+(mùa|season)\s+(đông|xuân|hạ|thu|winter|spring|summer|fall)\s+(năm|year)?\s*(\d{4})?/i;
      const seasonalAnimeMatch = prompt.match(seasonalAnimeRegex);
      
      if (seasonalAnimeMatch) {
        let season = seasonalAnimeMatch[3].toLowerCase();
        // Chuyển đổi tên mùa tiếng Việt sang tiếng Anh nếu cần
        if (season === 'đông') season = 'winter';
        else if (season === 'xuân') season = 'spring';
        else if (season === 'hạ') season = 'summer';
        else if (season === 'thu') season = 'fall';
        
        // Lấy năm hoặc dùng năm hiện tại nếu không có
        const year = seasonalAnimeMatch[5] || new Date().getFullYear();
        
        logger.info('NEURAL', `Phát hiện yêu cầu anime mùa ${season} năm ${year}`);
        
        return await this.handleMALSeasonal({
          dataType: 'anime',
          searchTerm: '',
          additionalInfo: {
            season: season,
            year: year
          }
        }, message);
      }
      
      // Sử dụng CoreModel để phân tích yêu cầu nếu các regex trên không phát hiện được
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');
      
      const analysisPrompt = 
        `Phân tích nội dung sau và xác định xem có phải là yêu cầu tìm kiếm thông tin anime/manga không: 
        "${prompt}"
        
        Nếu người dùng đang yêu cầu thông tin về anime hoặc manga cụ thể, hãy trích xuất các thông tin sau:
        1. Loại yêu cầu (tìm kiếm/thông tin chi tiết/xếp hạng/theo mùa)
        2. Loại dữ liệu (anime/manga)
        3. Tên anime/manga hoặc ID cần tìm kiếm
        4. Thông tin bổ sung (nếu có như mùa, năm, loại xếp hạng)
        
        QUAN TRỌNG: Nếu nội dung đề cập đến anime hoặc manga theo bất kỳ cách nào, hãy coi đó là yêu cầu anime.
        Mặc định với top anime hoặc manga là yêu cầu xếp hạng (ranking).
        
        Trả về định dạng JSON:
        {
          "isAnimeRequest": true/false,
          "requestType": "search|details|ranking|seasonal",
          "dataType": "anime|manga",
          "searchTerm": "tên anime/manga hoặc ID",
          "additionalInfo": {
            "rankingType": "all|airing|upcoming...",
            "year": "năm",
            "season": "winter|spring|summer|fall" 
          }
        }`;
      
      try {
        const response = await axiosInstance.post('/v1/chat/completions', {
          model: this.thinkingModel,
          max_tokens: 500,
          messages: [
            {
              role: 'system',
              content: 'Bạn là trợ lý phân tích yêu cầu tìm kiếm anime và manga. Hãy phân tích chính xác và trả về định dạng JSON theo yêu cầu.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ]
        });
        
        const content = response.data.choices[0].message.content;
        
        // Trích xuất JSON từ phản hồi
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/{[\s\S]*}/);
        
        if (jsonMatch) {
          try {
            const jsonString = jsonMatch[1] || jsonMatch[0];
            const parsedResult = JSON.parse(jsonString);
            
            logger.info('NEURAL', `Kết quả phân tích JSON: ${JSON.stringify(parsedResult)}`);
            
            // Nếu là yêu cầu liên quan đến anime
            if (parsedResult.isAnimeRequest) {
              logger.info('NEURAL', `Phát hiện yêu cầu anime: ${JSON.stringify(parsedResult)}`);
              
              // Xử lý theo loại yêu cầu
              switch (parsedResult.requestType) {
                case 'search':
                  return await this.handleMALSearch({
                    dataType: parsedResult.dataType,
                    searchTerm: parsedResult.searchTerm,
                    additionalInfo: parsedResult.additionalInfo
                  }, message);
                case 'details':
                  return await this.handleMALDetails({
                    dataType: parsedResult.dataType,
                    searchTerm: parsedResult.searchTerm,
                    additionalInfo: parsedResult.additionalInfo
                  }, message);
                case 'ranking':
                  return await this.handleMALRanking({
                    dataType: parsedResult.dataType,
                    searchTerm: '',
                    additionalInfo: parsedResult.additionalInfo
                  }, message);
                case 'seasonal':
                  return await this.handleMALSeasonal({
                    dataType: 'anime',
                    searchTerm: '',
                    additionalInfo: parsedResult.additionalInfo
                  }, message);
                default:
                  // Xử lý thông minh khi không rõ loại yêu cầu
                  if (parsedResult.searchTerm) {
                    // Nếu có searchTerm, mặc định là tìm kiếm
                    return await this.handleMALSearch({
                      dataType: parsedResult.dataType || 'anime',
                      searchTerm: parsedResult.searchTerm,
                      additionalInfo: {}
                    }, message);
                  } else {
                    // Nếu không có searchTerm, mặc định là ranking
                    return await this.handleMALRanking({
                      dataType: parsedResult.dataType || 'anime',
                      searchTerm: '',
                      additionalInfo: {
                        rankingType: 'all'
                      }
                    }, message);
                  }
              }
            }
          } catch (parseError) {
            logger.error('NEURAL', 'Lỗi khi phân tích JSON:', parseError.message);
          }
        }
      } catch (apiError) {
        logger.error('NEURAL', 'Lỗi khi gọi API phân tích:', apiError.message);
      }
      
      // Nếu tất cả xử lý API thất bại, kiểm tra từ khóa anime thủ công
      if (this.containsAnimeKeywords(prompt)) {
        logger.info('NEURAL', 'Phát hiện từ khóa anime, xử lý theo mặc định');
        
        if (promptLower.includes('top') || promptLower.includes('xếp hạng') || promptLower.includes('bxh')) {
          return await this.handleMALRanking({
            dataType: 'anime',
            searchTerm: '',
            additionalInfo: {
              rankingType: 'all'
            }
          }, message);
        } else {
          // Tìm kiếm với từ khóa được trích xuất
          const searchTerm = this.extractAnimeSearchTerm(prompt);
          return await this.handleMALSearch({
            dataType: 'anime',
            searchTerm: searchTerm,
            additionalInfo: {}
          }, message);
        }
      }
      
      // Nếu không phát hiện hoặc xử lý được yêu cầu anime, tiếp tục xử lý thông thường
      logger.info('NEURAL', `Không phải yêu cầu rõ ràng về anime, tiếp tục xử lý thông thường`);
      
      // Tiếp tục xử lý yêu cầu thông thường
      
      // Xác định xem prompt có cần tìm kiếm web hay không
      const shouldSearchWeb = this.shouldPerformWebSearch(prompt);
      let searchResults = [];

      if (shouldSearchWeb) {
        logger.info('NEURAL', "Prompt có vẻ cần thông tin từ web, đang thực hiện tìm kiếm...");
        searchResults = await this.performWebSearch(prompt);
      } else {
        logger.info('NEURAL', "Sử dụng kiến thức có sẵn, không cần tìm kiếm web");
      }

      // Rest of the existing code for normal request processing
      const promptWithSearch = searchResults.length > 0
        ? this.createSearchEnhancedPrompt(prompt, searchResults)
        : prompt;

      // Bổ sung thông tin từ trí nhớ cuộc trò chuyện
      const enhancedPromptWithMemory = await this.enrichPromptWithMemory(promptWithSearch, userId);
      
      // Process with the regular chat completion flow
      return this.processNormalChatCompletion(enhancedPromptWithMemory, userId, message, searchResults);
    } catch (error) {
      logger.error('NEURAL', 'Lỗi khi xử lý yêu cầu liên quan đến anime:', error.message);
      return this.processNormalChatCompletion(prompt, userId, message, []);
    }
  }

  /**
   * Kiểm tra từ khóa anime trong prompt (dùng cho phân tích thủ công)
   * @param {string} prompt - Nội dung tin nhắn
   * @returns {boolean} - true nếu chứa từ khóa anime
   */
  containsAnimeKeywords(prompt) {
    const loweredPrompt = prompt.toLowerCase();
    const animeTerms = [
      'anime', 'manga', 'myanimelist', 'mal', 
      'top anime', 'bxh anime', 'xếp hạng anime',
      'top manga', 'bxh manga', 'xếp hạng manga',
      'anime movie', 'anime series', 'anime tv', 'ova', 
      'phim hoạt hình nhật bản', 'light novel',
      'seasonal anime', 'anime season', 'anime mùa',
      'phim anime', 'phim hoạt hình', 'otaku',
      'ranking anime', 'anime ranking', 'anime hay nhất',
      'anime mới', 'manga mới', 'upcoming anime'
    ];
    
    // Kiểm tra các tên anime/manga phổ biến
    const popularTitles = [
      'naruto', 'one piece', 'bleach', 'dragon ball', 
      'attack on titan', 'shingeki no kyojin', 
      'my hero academia', 'boku no hero', 
      'demon slayer', 'kimetsu no yaiba',
      'jujutsu kaisen', 'fullmetal alchemist',
      'death note', 'tokyo ghoul', 'hunter x hunter',
      'sword art online', 'steins gate', 'gintama',
      'spy x family', 'chainsaw man', 'aot', 'bnha'
    ];
    
    return animeTerms.some(term => loweredPrompt.includes(term)) || 
           popularTitles.some(title => loweredPrompt.includes(title));
  }

  /**
   * Trích xuất từ khóa tìm kiếm anime từ prompt
   * @param {string} prompt - Nội dung tin nhắn
   * @returns {string} - Từ khóa tìm kiếm
   */
  extractAnimeSearchTerm(prompt) {
    // Loại bỏ các từ khóa thông dụng để lấy phần còn lại làm từ khóa tìm kiếm
    let searchTerm = prompt.replace(/(anime|manga|mal|myanimelist|top|bxh|xếp hạng|năm|2025|2024|search|tìm|kiếm)/gi, '').trim();
    
    // Nếu chỉ còn ít từ hoặc không còn gì, trả về mặc định
    if (searchTerm.length < 3) {
      // Nếu có "top" hoặc "xếp hạng", có thể là yêu cầu về top anime
      if (prompt.toLowerCase().includes('top') || prompt.toLowerCase().includes('xếp hạng') || prompt.toLowerCase().includes('bxh')) {
        return ''; // Để trống để xử lý như yêu cầu ranking
      }
      // Mặc định tìm kiếm với từ khóa là toàn bộ prompt
      return prompt;
    }
    
    return searchTerm;
  }

  /**
   * Xử lý hoàn thành chat thông thường (tách từ phương thức getCompletion)
   * @param {string} enhancedPrompt - Prompt đã được cải thiện
   * @param {string} userId - ID người dùng
   * @param {object} message - Đối tượng tin nhắn
   * @param {array} searchResults - Kết quả tìm kiếm web
   * @returns {Promise<string>} - Phản hồi
   */
  async processNormalChatCompletion(enhancedPrompt, userId, message, searchResults) {
    try {
      // Sử dụng Axios với cấu hình bảo mật
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');

      // Lấy lịch sử cuộc trò chuyện hiện có
      const conversationHistory = await conversationManager.loadConversationHistory(userId, this.systemPrompt, this.Model);

      // Xác định xem có phải là cuộc trò chuyện mới hay không
      const isNewConversation = conversationHistory.length <= 2; // Chỉ có system prompt và tin nhắn hiện tại

      // Add specific instructions about response style, with guidance about greetings
      let promptWithInstructions = `Reply like a smart, sweet, and charming young woman named Luna. Use gentle, friendly language — nothing too stiff or robotic.`;

      // Add instructions not to send greetings if in an existing conversation
      if (!isNewConversation) {
        promptWithInstructions += ` IMPORTANT: This is an ongoing conversation, DO NOT introduce yourself again or send greetings like "Chào bạn", "Hi", "Hello" or "Mình là Luna". Continue the conversation naturally without reintroducing yourself.`;
      } else {
        promptWithInstructions += ` If it fits the context, feel free to sprinkle in light humor or kind encouragement.`;
      }

      if (searchResults.length > 0) {
        promptWithInstructions += ` I've provided you with web search results. Incorporate this information naturally into your response without explicitly listing the sources. Respond in a conversational tone as Luna, not as an information aggregator.`;
      }

      promptWithInstructions += ` Avoid sounding too textbook-y or dry. If the user says something interesting, pick up on it naturally to keep the flow going. ${enhancedPrompt}`;

      // Chuẩn bị tin nhắn cho lịch sử cuộc trò chuyện
      const userMessage = promptWithInstructions;

      // Thêm tin nhắn người dùng vào lịch sử
      await conversationManager.addMessage(userId, 'user', userMessage);

      // Tạo mảng tin nhắn hoàn chỉnh với lịch sử cuộc trò chuyện của người dùng cụ thể
      const messages = conversationManager.getHistory(userId);

      // Thực hiện yêu cầu API với lịch sử cuộc trò chuyện
      const response = await axiosInstance.post('/v1/chat/completions', {
        model: this.CoreModel,
        max_tokens: 2048,
        messages: messages
      });

      logger.info('NEURAL', 'Đã nhận phản hồi từ API');
      let content = response.data.choices[0].message.content;

      // Thêm phản hồi của trợ lý vào lịch sử cuộc trò chuyện
      await conversationManager.addMessage(userId, 'assistant', content);

      // Xử lý và định dạng phản hồi
      content = await this.formatResponseContent(content, isNewConversation, searchResults);

      return content;
    } catch (error) {
      logger.error('NEURAL', `Lỗi khi xử lý yêu cầu chat completion:`, error.message);
      if (error.response) {
        logger.error('NEURAL', 'Chi tiết lỗi:', JSON.stringify(error.response.data, null, 2));
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
    // Nếu prompt quá ngắn, không cần tìm kiếm
    if (prompt.length < 10) return false;

    // Các từ khóa ưu tiên cao về thông tin mới nhất
    const urgentInfoKeywords = /(hôm nay|ngày nay|tuần này|tháng này|năm nay|hiện giờ|đang diễn ra|breaking|today|this week|this month|this year|happening now|trending)/i;

    // Các từ khóa về thông tin cập nhật hoặc sự kiện
    const informationKeywords = /(gần đây|hiện tại|mới nhất|cập nhật|tin tức|thời sự|sự kiện|diễn biến|thay đổi|phát triển|recent|current|latest|update|news|events|changes|developments)/i;

    // Các từ khóa tìm kiếm thông tin chi tiết
    const detailKeywords = /(thông tin về|chi tiết|tìm hiểu|tài liệu|nghiên cứu|báo cáo|information about|details|research|report|study|documentation)/i;

    // Các từ khóa gợi ý cần dữ liệu cụ thể
    const factsKeywords = /(năm nào|khi nào|ở đâu|ai là|bao nhiêu|như thế nào|tại sao|định nghĩa|how many|when|where|who is|what is|why|how|define)/i;

    // Các từ khóa chỉ ý kiến cá nhân hoặc sáng tạo (không cần tìm kiếm)
    const opinionKeywords = /(bạn nghĩ|ý kiến của bạn|theo bạn|bạn cảm thấy|bạn thích|what do you think|in your opinion|your thoughts|how do you feel|do you like)/i;

    // Các từ khóa hỏi về kiến thức của bot
    const knowledgeCheckKeywords = /(bạn có biết|bạn biết|bạn có hiểu|bạn hiểu|bạn có rõ|bạn rõ|do you know|you know|do you understand|you understand|are you familiar with)/i;

    // Nếu có từ khóa chỉ ý kiến cá nhân, không cần tìm kiếm
    if (opinionKeywords.test(prompt)) return false;

    // Kiểm tra mức độ ưu tiên tìm kiếm
    if (urgentInfoKeywords.test(prompt)) return true; // Ưu tiên cao nhất
    if (knowledgeCheckKeywords.test(prompt)) return true; // Ưu tiên tìm kiếm khi hỏi về kiến thức
    return informationKeywords.test(prompt) || detailKeywords.test(prompt) || factsKeywords.test(prompt);
  }

  /**
   * Xử lý và định dạng nội dung phản hồi
   * @param {string} content - Nội dung phản hồi gốc
   * @param {boolean} isNewConversation - Là cuộc trò chuyện mới hay không
   * @param {Array} searchResults - Kết quả tìm kiếm (nếu có)
   * @returns {string} - Nội dung đã được định dạng
   */
  async formatResponseContent(content, isNewConversation, searchResults) {
    // Lọc bỏ các lời chào thông thường ở đầu tin nhắn nếu không phải cuộc trò chuyện mới
    if (!isNewConversation) {
      // Cập nhật mẫu lời chào nếu cần
      if (!this.greetingPatterns || this.greetingPatterns.length === 0) {
        await this.refreshGreetingPatterns();
      }

      // Áp dụng từng mẫu lọc
      let contentChanged = false;
      let originalLength = content.length;

      for (const pattern of this.greetingPatterns) {
        const previousContent = content;
        content = content.replace(pattern, '');
        if (previousContent !== content) {
          contentChanged = true;
        }
      }

      // Xử lý sau khi lọc
      content = content.replace(/^[\s,.!:;]+/, '');
      if (content.length > 0) {
        content = content.charAt(0).toUpperCase() + content.slice(1);
      }

      // Xử lý các trường hợp đặc biệt
      if (contentChanged && content.length < originalLength * 0.7 && content.length < 20) {
        const commonFiller = /^(uhm|hmm|well|so|vậy|thế|đó|nha|nhé|ok|okay|nào|giờ)/i;
        content = content.replace(commonFiller, '');
        content = content.replace(/^[\s,.!:;]+/, '');
        if (content.length > 0) {
          content = content.charAt(0).toUpperCase() + content.slice(1);
        }
      }

      if (content.length < 10 && originalLength > 50) {
        const potentialContentStart = originalLength > 30 ? 30 : Math.floor(originalLength / 2);
        content = content || content.substring(potentialContentStart).trim();
        if (content.length > 0) {
          content = content.charAt(0).toUpperCase() + content.slice(1);
        }
      }
    } else if (content.toLowerCase().trim() === 'chào bạn' || content.length < 6) {
      content = `Hii~ mình là ${this.Model} và mình ở đây nếu bạn cần gì nè 💬 Cứ thoải mái nói chuyện như bạn bè nha! ${content}`;
    }

    // Thêm chỉ báo về kết quả tìm kiếm nếu có
    if (searchResults && searchResults.length > 0) {
      // Chỉ thêm biểu tượng tìm kiếm nhỏ ở đầu để không làm gián đoạn cuộc trò chuyện
      content = `🔍 ${content}`;

      // Thêm ghi chú nhỏ về nguồn thông tin ở cuối nếu có nhiều kết quả tìm kiếm
      if (searchResults.length >= 2) {
        content += `\n\n*Thông tin được tổng hợp từ ${searchResults.length} nguồn trực tuyến.*`;
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
      const fullHistory = await storageDB.getConversationHistory(userId, this.systemPrompt, this.Model);

      // Nếu lịch sử quá ngắn hoặc không tồn tại, trả về prompt ban đầu
      if (!fullHistory || fullHistory.length < 3) {
        return originalPrompt;
      }

      // Trích xuất các tin nhắn trước đây để tạo bối cảnh
      const relevantMessages = await this.extractRelevantMemories(fullHistory, originalPrompt);

      // Nếu không có tin nhắn liên quan, trả về prompt ban đầu
      if (!relevantMessages || relevantMessages.length === 0) {
        return originalPrompt;
      }

      // Xây dựng prompt được bổ sung với thông tin từ trí nhớ
      let enhancedPrompt = originalPrompt;

      // Chỉ thêm thông tin từ trí nhớ nếu có thông tin liên quan
      if (relevantMessages.length > 0) {
        const memoryContext = `[Thông tin từ cuộc trò chuyện trước: ${relevantMessages.join('. ')}] `;
        enhancedPrompt = memoryContext + enhancedPrompt;
        console.log('Đã bổ sung prompt với thông tin từ trí nhớ');
      }

      return enhancedPrompt;
    } catch (error) {
      console.error('Lỗi khi bổ sung prompt với trí nhớ:', error);
      return originalPrompt; // Trả về prompt ban đầu nếu có lỗi
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
      // Bỏ qua nếu lịch sử quá ngắn
      if (!history || history.length < 3) {
        return [];
      }

      // Tạo danh sách các tin nhắn từ người dùng và trợ lý
      const conversationSummary = [];

      // Lọc ra 5 cặp tin nhắn gần nhất
      const recentMessages = history.slice(-10);

      // Trích xuất nội dung của các tin nhắn
      for (let i = 0; i < recentMessages.length; i++) {
        const msg = recentMessages[i];
        if (msg.role === 'user' || msg.role === 'assistant') {
          // Tạo tóm tắt ngắn gọn của tin nhắn
          const summaryText = this.createMessageSummary(msg.content, msg.role);
          if (summaryText) {
            conversationSummary.push(summaryText);
          }
        }
      }

      // Lọc các phần thông tin liên quan đến prompt hiện tại
      // Đây là một thuật toán đơn giản để tìm các từ khóa chung
      const relevantMemories = conversationSummary.filter(summary => {
        const keywords = this.extractKeywords(currentPrompt);
        // Kiểm tra xem có ít nhất một từ khóa xuất hiện trong tóm tắt không
        return keywords.some(keyword => summary.toLowerCase().includes(keyword.toLowerCase()));
      });

      // Giới hạn số lượng tin nhắn liên quan để tránh prompt quá dài
      return relevantMemories.slice(-3);
    } catch (error) {
      console.error('Lỗi khi trích xuất trí nhớ liên quan:', error);
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
    if (!content || content.length < 2) return null;

    // Giới hạn độ dài tối đa của tóm tắt
    const maxLength = 100;

    // Bỏ qua các tin nhắn hệ thống hoặc tin nhắn quá ngắn
    if (content.length < 5) return null;

    let summary = '';
    if (role === 'user') {
      summary = `Người dùng đã hỏi: ${content}`;
    } else if (role === 'assistant') {
      summary = `Tôi đã trả lời: ${content}`;
    }

    // Cắt bớt nếu quá dài
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength) + '...';
    }

    return summary;
  }

  /**
   * Trích xuất từ khóa từ prompt
   * @param {string} prompt - Prompt cần trích xuất từ khóa
   * @returns {Array} - Danh sách các từ khóa
   */
  extractKeywords(prompt) {
    if (!prompt || prompt.length < 3) return [];

    // Danh sách các từ stop word (từ không có nhiều ý nghĩa)
    const stopWords = ['và', 'hoặc', 'nhưng', 'nếu', 'vì', 'bởi', 'với', 'từ', 'đến', 'trong', 'ngoài',
      'a', 'an', 'the', 'and', 'or', 'but', 'if', 'because', 'with', 'from', 'to', 'in', 'out'];

    // Tách prompt thành các từ
    const words = prompt.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .split(/\s+/);

    // Lọc bỏ stop word và các từ quá ngắn
    const keywords = words.filter(word =>
      word.length > 3 && !stopWords.includes(word)
    );

    // Trả về danh sách các từ khóa (tối đa 5 từ)
    return [...new Set(keywords)].slice(0, 5);
  }

  /**
   * Phân tích và trả về thông tin từ trí nhớ cuộc trò chuyện
   * @param {string} userId - ID của người dùng
   * @param {string} request - Yêu cầu phân tích cụ thể
   * @returns {Promise<string>} - Kết quả phân tích trí nhớ
   */
  async getMemoryAnalysis(userId, request) {
    try {
      console.log(`Đang phân tích trí nhớ cho người dùng ${userId}. Yêu cầu: ${request}`);

      // Lấy toàn bộ lịch sử cuộc trò chuyện
      const fullHistory = await storageDB.getConversationHistory(userId, this.systemPrompt, this.Model);

      if (!fullHistory || fullHistory.length === 0) {
        return "Mình chưa có bất kỳ trí nhớ nào về cuộc trò chuyện của chúng ta. Hãy bắt đầu trò chuyện nào! 😊";
      }

      // Tạo tóm tắt cuộc trò chuyện
      const conversationSummary = [];
      let messageCount = 0;

      for (const msg of fullHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messageCount++;

          // Tạo tóm tắt chi tiết hơn cho phân tích trí nhớ
          let roleName = msg.role === 'user' ? "👤 Bạn" : "🤖 Luna";
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

      if (request.toLowerCase().includes("ngắn gọn") || request.toLowerCase().includes("tóm tắt")) {
        analysis = `📝 **Tóm tắt cuộc trò chuyện của chúng ta**\n\n`;
        analysis += `- Chúng ta đã trao đổi ${messageCount} tin nhắn\n`;
        analysis += `- Cuộc trò chuyện bắt đầu cách đây ${this.formatTimeAgo(fullHistory[0]?.timestamp || Date.now())}\n\n`;
        analysis += `Đây là một số điểm chính từ cuộc trò chuyện:\n`;

        // Trích xuất 3-5 tin nhắn quan trọng
        const keyMessages = this.extractKeyMessages(fullHistory);
        keyMessages.forEach((msg, index) => {
          analysis += `${index + 1}. ${msg}\n`;
        });
      } else if (request.toLowerCase().includes("đầy đủ") || request.toLowerCase().includes("chi tiết")) {
        analysis = `📜 **Lịch sử đầy đủ cuộc trò chuyện của chúng ta**\n\n`;

        // Giới hạn số lượng tin nhắn hiển thị để tránh quá dài
        const maxDisplayMessages = Math.min(conversationSummary.length, 15);
        for (let i = conversationSummary.length - maxDisplayMessages; i < conversationSummary.length; i++) {
          analysis += conversationSummary[i] + "\n\n";
        }

        if (conversationSummary.length > maxDisplayMessages) {
          analysis = `💬 *[${conversationSummary.length - maxDisplayMessages} tin nhắn trước đó không được hiển thị]*\n\n` + analysis;
        }
      } else {
        // Mặc định: hiển thị tóm tắt ngắn
        analysis = `💭 **Tóm tắt trí nhớ của cuộc trò chuyện**\n\n`;
        analysis += `- Chúng ta đã trao đổi ${messageCount} tin nhắn\n`;
        analysis += `- Các chủ đề chính: ${this.identifyMainTopics(fullHistory).join(", ")}\n\n`;

        // Hiển thị 3 tin nhắn gần nhất
        analysis += `**Tin nhắn gần nhất:**\n`;
        const recentMessages = conversationSummary.slice(-3);
        recentMessages.forEach(msg => {
          analysis += msg + "\n\n";
        });
      }

      analysis += "\n💫 *Lưu ý: Mình vẫn nhớ toàn bộ cuộc trò chuyện của chúng ta và có thể trả lời dựa trên ngữ cảnh đó.*";

      return analysis;
    } catch (error) {
      console.error('Lỗi khi phân tích trí nhớ:', error);
      return "Xin lỗi, mình gặp lỗi khi truy cập trí nhớ của cuộc trò chuyện. Lỗi: " + error.message;
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
    const userMessages = history.filter(msg => msg.role === 'user').map(msg => msg.content);

    // Chọn tin nhắn có độ dài vừa phải và không quá ngắn
    const significantMessages = userMessages.filter(msg => msg.length > 10 && msg.length < 200);

    // Nếu không có tin nhắn thỏa điều kiện, trả về một số tin nhắn bất kỳ
    if (significantMessages.length === 0) {
      return userMessages.slice(-3).map(msg => {
        if (msg.length > 100) return msg.substring(0, 100) + "...";
        return msg;
      });
    }

    // Trả về các tin nhắn quan trọng (tối đa 5)
    return significantMessages.slice(-5).map(msg => {
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

    // Thu thập tất cả từ khóa từ các tin nhắn của người dùng
    const allKeywords = [];

    history.forEach(msg => {
      if (msg.role === 'user') {
        const keywords = this.extractKeywords(msg.content);
        allKeywords.push(...keywords);
      }
    });

    // Đếm tần suất xuất hiện của các từ khóa
    const keywordFrequency = {};
    allKeywords.forEach(keyword => {
      if (!keywordFrequency[keyword]) {
        keywordFrequency[keyword] = 1;
      } else {
        keywordFrequency[keyword]++;
      }
    });

    // Sắp xếp từ khóa theo tần suất xuất hiện
    const sortedKeywords = Object.entries(keywordFrequency)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    // Trả về các chủ đề phổ biến nhất (tối đa 5)
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
      const userId = message?.author?.id || 'default-user';
      console.log(`Đang gửi yêu cầu thinking mode đến ${this.CoreModel}...`);

      // Create a special prompt asking the model to show its thinking process
      const thinkingPrompt =
        `Explain your thinking process step by step before giving your final answer.

         Please divide your response into two parts:
         1. [THINKING] - Your thinking process, analysis, and reasoning
         2. [ANSWER] - Your final answer, clear and concise

         Question: ${prompt}`;

      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');

      // Khởi tạo/tải lịch sử cuộc trò chuyện
      await conversationManager.loadConversationHistory(userId, this.systemPrompt, this.Model);

      // Thêm tin nhắn người dùng vào lịch sử
      await conversationManager.addMessage(userId, 'user', thinkingPrompt);

      // Tạo mảng tin nhắn hoàn chỉnh với lịch sử cuộc trò chuyện của người dùng cụ thể
      const messages = conversationManager.getHistory(userId);

      const response = await axiosInstance.post('/v1/chat/completions', {
        model: this.thinkingModel,
        max_tokens: 2048,
        messages: messages
      });

      let content = response.data.choices[0].message.content;

      // Thêm phản hồi của trợ lý vào lịch sử cuộc trò chuyện
      await conversationManager.addMessage(userId, 'assistant', content);

      // Định dạng phần suy nghĩ để dễ đọc hơn
      content = content.replace('[THINKING]', '💭 **Quá trình suy nghĩ:**\n');
      content = content.replace('[ANSWER]', '\n\n✨ **Câu trả lời:**\n');

      return content;
    } catch (error) {
      console.error(`Lỗi khi gọi API cho chế độ thinking:`, error.message);
      if (error.response) {
        console.error('Chi tiết lỗi:', JSON.stringify(error.response.data, null, 2));
      }
      return `Xin lỗi, tôi không thể kết nối với dịch vụ AI ở chế độ thinking. Lỗi: ${error.message}`;
    }
  }

  /**
   * Nhận phản hồi mã từ API
   * @param {string} prompt - Câu hỏi hoặc yêu cầu từ người dùng
   * @param {object} message - Đối tượng tin nhắn (tuỳ chọn)
   * @returns {Promise<string>} - Phản hồi mã từ API
   */
  async getCodeCompletion(prompt, message = null) {
    try {
      // Trích xuất ID người dùng từ tin nhắn hoặc tạo một ID cho tương tác không phải Discord
      const userId = message?.author?.id || 'default-user';

      // Kiểm tra xem có yêu cầu chế độ thinking không
      if (prompt.toLowerCase().includes('thinking') || prompt.toLowerCase().includes('giải thích từng bước')) {
        const codingThinkingPrompt = `${this.systemPrompt} You are also a programming assistant with model name ${this.Model}.
          Please explain your thinking process before writing code.

          Use this format:
          [THINKING] - Problem analysis and approach
          [CODE] - Complete code with full comments
          [EXPLANATION] - Detailed explanation of the code

          Question: ${prompt}`;

        // Lấy lịch sử cuộc trò chuyện hiện có
        await conversationManager.loadConversationHistory(userId, this.systemPrompt, this.Model);

        // Thêm tin nhắn người dùng vào lịch sử
        await conversationManager.addMessage(userId, 'user', codingThinkingPrompt);

        // Lấy lịch sử cuộc trò chuyện của người dùng cụ thể
        const messages = conversationManager.getHistory(userId);

        const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');

        const response = await axiosInstance.post('/v1/chat/completions', {
          model: this.CoreModel,
          max_tokens: 4096,
          messages: messages
        });

        let content = response.data.choices[0].message.content;

        // Thêm phản hồi của trợ lý vào lịch sử cuộc trò chuyện
        await conversationManager.addMessage(userId, 'assistant', content);

        // Định dạng phần suy nghĩ để dễ đọc hơn
        content = content.replace('[THINKING]', '💭 **Quá trình phân tích:**\n');
        content = content.replace('[CODE]', '\n\n💻 **Code:**\n');
        content = content.replace('[EXPLANATION]', '\n\n📝 **Giải thích:**\n');

        return content;
      }

      const codingSystemPrompt = `${this.systemPrompt} You are also a programming assistant with model name ${this.Model}. Provide code examples and explanations. Always present code in code blocks with comprehensive comments.`;

      // Lấy lịch sử cuộc trò chuyện hiện có
      await conversationManager.loadConversationHistory(userId, this.systemPrompt, this.Model);

      // Thêm tin nhắn người dùng vào lịch sử
      await conversationManager.addMessage(userId, 'user', prompt);

      // Lấy lịch sử cuộc trò chuyện của người dùng cụ thể
      const messages = conversationManager.getHistory(userId);

      // Sử dụng Axios với cấu hình bảo mật
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');

      const response = await axiosInstance.post('/v1/chat/completions', {
        model: this.CoreModel,
        max_tokens: 4096,
        messages: messages
      });

      const content = response.data.choices[0].message.content;

      // Thêm phản hồi của trợ lý vào lịch sử cuộc trò chuyện
      await conversationManager.addMessage(userId, 'assistant', content);

      return content;
    } catch (error) {
      console.error(`Lỗi khi gọi X.AI API cho mã:`, error.message);
      if (error.response) {
        console.error('Chi tiết lỗi:', JSON.stringify(error.response.data, null, 2));
      }
      return `Xin lỗi, tôi không thể tạo mã do lỗi kết nối. Lỗi: ${error.message}`;
    }
  }

  /**
   * Tạo hình ảnh sử dụng API với mô hình riêng
   */
  async generateImage(prompt) {
    try {
      console.log(`Đang tạo hình ảnh với mô hình ${this.imageModel}...`);

      // Sử dụng Axios với cấu hình bảo mật
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');

      const response = await axiosInstance.post('/v1/images/generations', {
        model: this.imageModel,
        prompt: prompt,
        n: 1
      });

      console.log('Đã nhận hình ảnh từ API');
      return response.data.data[0].url;
    } catch (error) {
      console.error('Lỗi khi tạo hình ảnh:', error.message);
      if (error.response) {
        console.error('Chi tiết lỗi:', JSON.stringify(error.response.data, null, 2));
      }

      if (error.response &&
        error.response.data &&
        error.response.data.error &&
        error.response.data.error.includes("Generated image rejected by content moderation")) {
        return "Xin lỗi, mình không thể tạo hình ảnh này. Nội dung bạn yêu cầu không tuân thủ nguyên tắc kiểm duyệt nội dung. Vui lòng thử chủ đề hoặc mô tả khác.";
      }

      return `Xin lỗi, không thể tạo hình ảnh: ${error.message}`;
    }
  }

  /**
   * Kiểm tra kết nối API
   */
  async testConnection() {
    try {
      console.log(`Đang kiểm tra kết nối tới X.AI API...`);

      // Sử dụng Axios với cấu hình bảo mật
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');
      const response = await axiosInstance.get('/v1/models');
      if (response.data && response.data.data) {
        console.log('Kết nối thành công với X.AI API!');
      }

      return true;
    } catch (error) {
      console.error(`Không thể kết nối tới X.AI API:`, error.message);
      if (error.response) {
        console.error('Chi tiết lỗi:', JSON.stringify(error.response.data, null, 2));
      }
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
        hasMentions: false
      };
    } catch (error) {
      console.error("Lỗi khi xử lý tin nhắn Discord:", error);
      return {
        cleanContent: message.content || "",
        hasMentions: false
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

    if (processedMessage.cleanContent.toLowerCase() === 'reset conversation' ||
      processedMessage.cleanContent.toLowerCase() === 'xóa lịch sử' ||
      processedMessage.cleanContent.toLowerCase() === 'quên hết đi') {
      await storageDB.clearConversationHistory(message.author.id, this.systemPrompt, this.Model);
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
   * Xử lý các yêu cầu liên quan đến MyAnimeList
   * @param {string} command - Loại lệnh (anime, manga, mal)
   * @param {string} query - Truy vấn của người dùng
   * @param {object} message - Đối tượng tin nhắn Discord (nếu có)
   * @returns {Promise<string|Object>} - Phản hồi hoặc embed
   */
  async handleMyAnimeListRequest(command, query, message) {
    try {
      logger.info('NEURAL', `Đang xử lý yêu cầu MyAnimeList: ${command} ${query}`);

      // Sử dụng CoreModel để phân tích nội dung yêu cầu
      const analysisPrompt = `Phân tích yêu cầu tìm kiếm anime/manga sau: "${command} ${query}"
      Cần xác định:
      1. Loại yêu cầu (tìm kiếm/thông tin chi tiết/xếp hạng/theo mùa)
      2. Loại dữ liệu (anime/manga)
      3. Từ khóa tìm kiếm hoặc ID
      4. Thông tin bổ sung (nếu có như mùa, năm, loại xếp hạng)
      
      Trả về định dạng JSON:
      {
        "requestType": "search|details|ranking|seasonal",
        "dataType": "anime|manga",
        "searchTerm": "từ khóa hoặc ID",
        "additionalInfo": {
          "rankingType": "all|airing|upcoming...",
          "year": "năm",
          "season": "winter|spring|summer|fall"
        }
      }`;

      // Sử dụng Axios với cấu hình bảo mật
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');

      // Gửi yêu cầu phân tích đến CoreModel
      const response = await axiosInstance.post('/v1/chat/completions', {
        model: this.thinkingModel, // Sử dụng thinking model để phân tích nhanh
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: 'Bạn là trợ lý phân tích yêu cầu tìm kiếm anime và manga. Hãy phân tích chính xác và trả về định dạng JSON theo yêu cầu.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ]
      });

      // Lấy kết quả phân tích
      const content = response.data.choices[0].message.content;
      
      // Trích xuất JSON từ phản hồi
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/{[\s\S]*}/);
      let parsedRequest;
      
      if (jsonMatch) {
        try {
          // Cố gắng phân tích cú pháp JSON từ kết quả trả về
          const jsonString = jsonMatch[1] || jsonMatch[0];
          parsedRequest = JSON.parse(jsonString);
        } catch (parseError) {
          logger.error('NEURAL', 'Lỗi khi phân tích cú pháp JSON:', parseError.message);
          return 'Mình không thể hiểu yêu cầu tìm kiếm của bạn. Vui lòng thử lại với cú pháp khác.';
        }
      } else {
        // Nếu không trích xuất được JSON, sử dụng phân tích đơn giản
        logger.warn('NEURAL', 'Không thể trích xuất JSON từ phản hồi, chuyển sang phân tích đơn giản');
        parsedRequest = this.simpleMALRequestAnalysis(command, query);
      }

      logger.info('NEURAL', `Kết quả phân tích yêu cầu: ${JSON.stringify(parsedRequest)}`);

      // Xử lý yêu cầu dựa trên phân tích
      switch (parsedRequest.requestType) {
        case 'search':
          return await this.handleMALSearch(parsedRequest, message);
        case 'details':
          return await this.handleMALDetails(parsedRequest, message);
        case 'ranking':
          return await this.handleMALRanking(parsedRequest, message);
        case 'seasonal':
          return await this.handleMALSeasonal(parsedRequest, message);
        default:
          return 'Mình không hiểu yêu cầu của bạn. Vui lòng thử lại với từ khóa cụ thể hơn.';
      }
    } catch (error) {
      logger.error('NEURAL', 'Lỗi khi xử lý yêu cầu MyAnimeList:', error.message);
      return 'Xin lỗi, mình gặp lỗi khi xử lý yêu cầu MyAnimeList của bạn. Vui lòng thử lại sau.';
    }
  }

  /**
   * Phân tích đơn giản yêu cầu MyAnimeList khi không thể sử dụng CoreModel
   * @param {string} command - Loại lệnh (anime, manga, mal)
   * @param {string} query - Truy vấn của người dùng
   * @returns {Object} - Kết quả phân tích
   */
  simpleMALRequestAnalysis(command, query) {
    // Xử lý query để loại bỏ các từ thừa
    query = query.trim();
    // Loại bỏ các từ không cần thiết ở đầu query
    query = query.replace(/^(về|thông tin về|chi tiết về|tìm|kiếm|search|info|details|information about)\s+/i, '');

    // Kiểm tra xem có phải là yêu cầu xem chi tiết hay không (theo ID hoặc từ khóa "info")
    const detailsRegex = /^(details|info|thông tin|chi tiết|id)[:\s]+(\d+)$/i;
    const detailsMatch = query.match(detailsRegex);
    
    // Kiểm tra xem có phải là yêu cầu xem bảng xếp hạng hay không
    const rankingRegex = /^(ranking|rank|xếp hạng|bxh|top)[:\s]*(all|airing|upcoming|tv|ova|movie|special|bypopularity|favorite|manga|novels|oneshots|doujin|manhwa|manhua)?$/i;
    const rankingMatch = query.match(rankingRegex);
    
    // Kiểm tra xem có phải là yêu cầu xem anime theo mùa hay không
    const seasonalRegex = /^(season|seasonal|mùa)[:\s]+(\d{4})[:\s]+(winter|spring|summer|fall|đông|xuân|hạ|thu)$/i;
    const seasonalMatch = query.match(seasonalRegex);
    
    if (detailsMatch) {
      return {
        requestType: 'details',
        dataType: command === 'manga' ? 'manga' : 'anime',
        searchTerm: detailsMatch[2],
        additionalInfo: {}
      };
    } else if (rankingMatch) {
      let rankingType = rankingMatch[2]?.toLowerCase() || 'all';
      
      return {
        requestType: 'ranking',
        dataType: command === 'manga' ? 'manga' : 'anime',
        searchTerm: '',
        additionalInfo: {
          rankingType: rankingType
        }
      };
    } else if (seasonalMatch) {
      let season = seasonalMatch[3].toLowerCase();
      // Chuyển đổi tên mùa tiếng Việt sang tiếng Anh
      if (season === 'đông') season = 'winter';
      else if (season === 'xuân') season = 'spring';
      else if (season === 'hạ') season = 'summer';
      else if (season === 'thu') season = 'fall';
      
      return {
        requestType: 'seasonal',
        dataType: 'anime',
        searchTerm: '',
        additionalInfo: {
          year: seasonalMatch[2],
          season: season
        }
      };
    } else {
      // Mặc định là tìm kiếm
      return {
        requestType: 'search',
        dataType: command === 'manga' ? 'manga' : 'anime',
        searchTerm: query,
        additionalInfo: {}
      };
    }
  }

  /**
   * Xử lý tìm kiếm anime/manga
   * @param {Object} request - Yêu cầu đã phân tích
   * @param {Object} message - Đối tượng tin nhắn Discord (nếu có)
   * @returns {Promise<string|Object>} - Phản hồi hoặc embed
   */
  async handleMALSearch(request, message) {
    try {
      if (request.dataType === 'manga') {
        const results = await malAPI.searchManga(request.searchTerm);
        if (results.length === 0) {
          return `Mình không tìm thấy manga nào với từ khóa "${request.searchTerm}".`;
        }
        
        if (message) {
          // Trả về embed nếu là từ Discord
          return malAPI.createMangaSearchEmbed(results, request.searchTerm);
        } else {
          // Trả về văn bản nếu không phải từ Discord
          let response = `🔍 Kết quả tìm kiếm manga cho "${request.searchTerm}":\n\n`;
          results.slice(0, 5).forEach((item, index) => {
            const manga = item.node;
            response += `${index + 1}. ${manga.title}\n`;
            if (manga.mean) response += `   ⭐ Điểm: ${manga.mean}/10\n`;
            if (manga.num_volumes) response += `   📚 Tập: ${manga.num_volumes}\n`;
            response += `   🔗 https://myanimelist.net/manga/${manga.id}\n\n`;
          });
          return response;
        }
      } else {
        const results = await malAPI.searchAnime(request.searchTerm);
        if (results.length === 0) {
          return `Mình không tìm thấy anime nào với từ khóa "${request.searchTerm}".`;
        }
        
        if (message) {
          // Trả về embed nếu là từ Discord
          return malAPI.createAnimeSearchEmbed(results, request.searchTerm);
        } else {
          // Trả về văn bản nếu không phải từ Discord
          let response = `🔍 Kết quả tìm kiếm anime cho "${request.searchTerm}":\n\n`;
          results.slice(0, 5).forEach((item, index) => {
            const anime = item.node;
            response += `${index + 1}. ${anime.title}\n`;
            if (anime.mean) response += `   ⭐ Điểm: ${anime.mean}/10\n`;
            if (anime.num_episodes) response += `   🎬 Tập: ${anime.num_episodes}\n`;
            response += `   🔗 https://myanimelist.net/anime/${anime.id}\n\n`;
          });
          return response;
        }
      }
    } catch (error) {
      logger.error('NEURAL', 'Lỗi khi tìm kiếm anime/manga:', error.message);
      return 'Xin lỗi, mình gặp lỗi khi tìm kiếm. Vui lòng thử lại sau.';
    }
  }

  /**
   * Xử lý lấy thông tin chi tiết anime/manga
   * @param {Object} request - Yêu cầu đã phân tích
   * @param {Object} message - Đối tượng tin nhắn Discord (nếu có)
   * @returns {Promise<string|Object>} - Phản hồi hoặc embed
   */
  async handleMALDetails(request, message) {
    try {
      if (request.dataType === 'manga') {
        const manga = await malAPI.getMangaDetails(request.searchTerm);
        if (!manga) {
          return `Mình không tìm thấy thông tin chi tiết của manga với ID ${request.searchTerm}.`;
        }
        
        if (message) {
          // Trả về embed nếu là từ Discord
          return malAPI.createMangaDetailEmbed(manga);
        } else {
          // Trả về văn bản nếu không phải từ Discord
          let status = 'N/A';
          switch (manga.status) {
            case 'finished': status = 'Đã hoàn thành'; break;
            case 'currently_publishing': status = 'Đang xuất bản'; break;
            case 'not_yet_published': status = 'Chưa xuất bản'; break;
          }
          
          let response = `📚 ${manga.title}\n\n`;
          response += manga.synopsis ? `${manga.synopsis.substring(0, 300)}${manga.synopsis.length > 300 ? '...' : ''}\n\n` : '';
          response += `⭐ Điểm: ${manga.mean || 'N/A'}/10\n`;
          response += `📚 Tập: ${manga.num_volumes || 'N/A'}\n`;
          response += `📑 Chương: ${manga.num_chapters || 'N/A'}\n`;
          response += `📅 Trạng thái: ${status}\n`;
          
          if (manga.genres && manga.genres.length > 0) {
            response += `🏷️ Thể loại: ${manga.genres.map(g => g.name).join(', ')}\n`;
          }
          
          response += `🔗 https://myanimelist.net/manga/${manga.id}`;
          return response;
        }
      } else {
        const anime = await malAPI.getAnimeDetails(request.searchTerm);
        if (!anime) {
          return `Mình không tìm thấy thông tin chi tiết của anime với ID ${request.searchTerm}.`;
        }
        
        if (message) {
          // Trả về embed nếu là từ Discord
          return malAPI.createAnimeDetailEmbed(anime);
        } else {
          // Trả về văn bản nếu không phải từ Discord
          let status = 'N/A';
          switch (anime.status) {
            case 'finished_airing': status = 'Đã hoàn thành'; break;
            case 'currently_airing': status = 'Đang phát sóng'; break;
            case 'not_yet_aired': status = 'Chưa phát sóng'; break;
          }
          
          let response = `📺 ${anime.title}\n\n`;
          response += anime.synopsis ? `${anime.synopsis.substring(0, 300)}${anime.synopsis.length > 300 ? '...' : ''}\n\n` : '';
          response += `⭐ Điểm: ${anime.mean || 'N/A'}/10\n`;
          response += `🎬 Số tập: ${anime.num_episodes || 'N/A'}\n`;
          response += `📅 Trạng thái: ${status}\n`;
          
          if (anime.genres && anime.genres.length > 0) {
            response += `🏷️ Thể loại: ${anime.genres.map(g => g.name).join(', ')}\n`;
          }
          
          if (anime.studios && anime.studios.length > 0) {
            response += `🏢 Studio: ${anime.studios.map(s => s.name).join(', ')}\n`;
          }
          
          response += `🔗 https://myanimelist.net/anime/${anime.id}`;
          return response;
        }
      }
    } catch (error) {
      logger.error('NEURAL', 'Lỗi khi lấy thông tin chi tiết anime/manga:', error.message);
      return 'Xin lỗi, mình gặp lỗi khi lấy thông tin chi tiết. Vui lòng thử lại sau.';
    }
  }

  /**
   * Xử lý lấy bảng xếp hạng anime/manga
   * @param {Object} request - Yêu cầu đã phân tích
   * @param {Object} message - Đối tượng tin nhắn Discord (nếu có)
   * @returns {Promise<string|Object>} - Phản hồi hoặc embed
   */
  async handleMALRanking(request, message) {
    try {
      const rankingType = request.additionalInfo?.rankingType || 'all';
      
      if (request.dataType === 'manga') {
        const results = await malAPI.getMangaRanking(rankingType);
        if (results.length === 0) {
          return `Mình không thể lấy bảng xếp hạng manga loại "${rankingType}".`;
        }
        
        if (message) {
          // Trả về embed nếu là từ Discord
          return malAPI.createMangaRankingEmbed(results, rankingType);
        } else {
          // Trả về văn bản nếu không phải từ Discord
          let response = `📊 Top Manga - ${rankingType}\n\n`;
          results.slice(0, 5).forEach((item, index) => {
            if (!item || !item.node) {
              logger.warn('NEURAL', `Phần tử manga không hợp lệ ở vị trí ${index}`);
              return;
            }
            const manga = item.node;
            const ranking = item.ranking || (index + 1);
            const title = manga.title || "Không có tiêu đề";
            response += `${ranking}. ${title}\n`;
            if (manga.mean) response += `   ⭐ Điểm: ${manga.mean}/10\n`;
            if (manga.id) response += `   🔗 https://myanimelist.net/manga/${manga.id}\n\n`;
          });
          return response;
        }
      } else {
        const results = await malAPI.getAnimeRanking(rankingType);
        if (results.length === 0) {
          return `Mình không thể lấy bảng xếp hạng anime loại "${rankingType}".`;
        }
        
        // Log để debug kỹ hơn về cấu trúc dữ liệu
        logger.info('NEURAL', `Đã nhận ${results.length} kết quả ranking anime`);
        if (results.length > 0) {
          logger.info('NEURAL', `Cấu trúc mẫu: ${JSON.stringify(results[0])}`);
        }
        
        if (message) {
          // Trả về embed nếu là từ Discord
          return malAPI.createAnimeRankingEmbed(results, rankingType);
        } else {
          // Trả về văn bản nếu không phải từ Discord
          let response = `📊 Top Anime - ${rankingType}\n\n`;
          results.slice(0, 5).forEach((item, index) => {
            if (!item || !item.node) {
              logger.warn('NEURAL', `Phần tử không hợp lệ ở vị trí ${index}: ${JSON.stringify(item)}`);
              return;
            }
            
            // Kiểm tra cấu trúc đối tượng và truy cập an toàn
            const anime = item.node;
            const ranking = item.ranking || (index + 1);
            
            // Truy cập an toàn thuộc tính title
            const title = anime.title || "Không có tiêu đề";
            
            response += `${ranking}. ${title}\n`;
            if (anime.mean) response += `   ⭐ Điểm: ${anime.mean}/10\n`;
            if (anime.id) {
              response += `   🔗 https://myanimelist.net/anime/${anime.id}\n\n`;
            } else {
              response += `\n`;
            }
          });
          return response;
        }
      }
    } catch (error) {
      logger.error('NEURAL', `Lỗi khi lấy bảng xếp hạng anime/manga: ${error.message}`);
      logger.error('NEURAL', `Stack trace: ${error.stack}`);
      return 'Xin lỗi, mình gặp lỗi khi lấy bảng xếp hạng. Vui lòng thử lại sau.';
    }
  }

  /**
   * Xử lý lấy anime theo mùa
   * @param {Object} request - Yêu cầu đã phân tích
   * @param {Object} message - Đối tượng tin nhắn Discord (nếu có)
   * @returns {Promise<string|Object>} - Phản hồi hoặc embed
   */
  async handleMALSeasonal(request, message) {
    try {
      const year = request.additionalInfo.year;
      const season = request.additionalInfo.season;
      
      const results = await malAPI.getSeasonalAnime(year, season);
      if (results.length === 0) {
        return `Mình không thể lấy danh sách anime mùa ${season} năm ${year}.`;
      }
      
      if (message) {
        // Chuyển đổi tên mùa sang tiếng Việt
        let seasonVi = '';
        switch (season) {
          case 'winter': seasonVi = 'Đông'; break;
          case 'spring': seasonVi = 'Xuân'; break;
          case 'summer': seasonVi = 'Hạ'; break;
          case 'fall': seasonVi = 'Thu'; break;
          default: seasonVi = season; break;
        }
        
        // Tạo embed tùy chỉnh cho mùa
        const embed = {
          color: 0x2E51A2,
          title: `Anime mùa ${seasonVi} ${year}`,
          footer: {
            text: 'Powered by MyAnimeList API'
          },
          timestamp: new Date(),
          fields: []
        };
        
        if (results[0].node.main_picture) {
          embed.thumbnail = { url: results[0].node.main_picture.medium };
        }
        
        results.slice(0, 10).forEach((item, index) => {
          const anime = item.node;
          
          let info = '';
          if (anime.mean) info += `⭐ Điểm: ${anime.mean}/10\n`;
          if (anime.num_episodes) info += `🎬 Tập: ${anime.num_episodes}\n`;
          
          if (anime.genres && anime.genres.length > 0) {
            const genreList = anime.genres.map(g => g.name).slice(0, 3).join(', ');
            info += `🏷️ Thể loại: ${genreList}\n`;
          }
          
          if (anime.studios && anime.studios.length > 0) {
            info += `🏢 Studio: ${anime.studios[0].name}`;
          }
          
          embed.fields.push({
            name: `${index + 1}. ${anime.title}`,
            value: info || 'Không có thông tin bổ sung.',
            inline: false
          });
        });
        
        if (results.length > 10) {
          embed.fields.push({
            name: 'Và nhiều hơn nữa...',
            value: `Tìm thấy tổng cộng ${results.length} kết quả.`,
            inline: false
          });
        }
        
        return embed;
      } else {
        // Trả về văn bản nếu không phải từ Discord
        let seasonVi = '';
        switch (season) {
          case 'winter': seasonVi = 'Đông'; break;
          case 'spring': seasonVi = 'Xuân'; break;
          case 'summer': seasonVi = 'Hạ'; break;
          case 'fall': seasonVi = 'Thu'; break;
          default: seasonVi = season; break;
        }
        
        let response = `🗓️ Anime mùa ${seasonVi} ${year}\n\n`;
        results.slice(0, 5).forEach((item, index) => {
          const anime = item.node;
          response += `${index + 1}. ${anime.title}\n`;
          if (anime.mean) response += `   ⭐ Điểm: ${anime.mean}/10\n`;
          if (anime.num_episodes) response += `   🎬 Tập: ${anime.num_episodes}\n`;
          response += `   🔗 https://myanimelist.net/anime/${anime.id}\n\n`;
        });
        return response;
      }
    } catch (error) {
      logger.error('NEURAL', 'Lỗi khi lấy anime theo mùa:', error.message);
      return 'Xin lỗi, mình gặp lỗi khi lấy anime theo mùa. Vui lòng thử lại sau.';
    }
  }
}

module.exports = new NeuralNetworks();
