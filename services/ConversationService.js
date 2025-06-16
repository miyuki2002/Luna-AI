const logger = require("../utils/logger.js");
const storageDB = require("./storagedb.js");
const conversationManager = require("../handlers/conversationManager.js");
const ownerService = require("./ownerService.js");
const prompts = require("../config/prompts.js");
const textUtils = require("../utils/textUtils.js");
const AICore = require("./AICore.js");

class ConversationService {
  constructor() {
    this.greetingPatterns = [];
    this.initializeGreetingPatterns();
    
    // Cấu hình conversation
    storageDB.setMaxConversationLength(30);
    storageDB.setMaxConversationAge(3 * 60 * 60 * 1000);
    
    logger.info("CONVERSATION_SERVICE", "Initialized conversation service");
  }

  /**
   * Khởi tạo các mẫu lời chào từ MongoDB
   */
  async initializeGreetingPatterns() {
    try {
      await storageDB.initializeDefaultGreetingPatterns();
      this.greetingPatterns = await storageDB.getGreetingPatterns();
      logger.info("CONVERSATION_SERVICE", `Loaded ${this.greetingPatterns.length} greeting patterns`);
    } catch (error) {
      logger.error("CONVERSATION_SERVICE", "Error initializing greeting patterns:", error);
      this.greetingPatterns = [];
    }
  }

  /**
   * Cập nhật mẫu lời chào từ cơ sở dữ liệu
   */
  async refreshGreetingPatterns() {
    try {
      this.greetingPatterns = await storageDB.getGreetingPatterns();
      logger.info("CONVERSATION_SERVICE", `Updated ${this.greetingPatterns.length} greeting patterns`);
    } catch (error) {
      logger.error("CONVERSATION_SERVICE", "Error refreshing greeting patterns:", error);
    }
  }

  /**
   * Trích xuất userId từ message object
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
   * Làm phong phú prompt bằng cách thêm thông tin từ trí nhớ cuộc trò chuyện
   */
  async enrichPromptWithMemory(originalPrompt, userId) {
    try {
      const fullHistory = await storageDB.getConversationHistory(
        userId,
        prompts.system.main,
        AICore.getModelName()
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
        logger.debug("CONVERSATION_SERVICE", "Enhanced prompt with memory context");
      }

      return enhancedPrompt;
    } catch (error) {
      logger.error("CONVERSATION_SERVICE", "Error enriching prompt with memory:", error);
      return originalPrompt;
    }
  }

  /**
   * Trích xuất thông tin liên quan từ lịch sử cuộc trò chuyện
   */
  async extractRelevantMemories(history, currentPrompt) {
    try {
      if (!history || history.length < 3) {
        return [];
      }

      const conversationSummary = [];
      const recentMessages = history.slice(-10);

      for (let i = 0; i < recentMessages.length; i++) {
        const msg = recentMessages[i];
        if (msg.role === "user" || msg.role === "assistant") {
          const summaryText = textUtils.createMessageSummary(msg.content, msg.role);
          if (summaryText) {
            conversationSummary.push(summaryText);
          }
        }
      }

      const relevantMemories = conversationSummary.filter((summary) => {
        const keywords = textUtils.extractKeywords(currentPrompt);
        return keywords.some((keyword) =>
          summary.toLowerCase().includes(keyword.toLowerCase())
        );
      });

      return relevantMemories.slice(-3);
    } catch (error) {
      logger.error("CONVERSATION_SERVICE", "Error extracting relevant memories:", error);
      return [];
    }
  }

  /**
   * Phân tích và trả về thông tin từ trí nhớ cuộc trò chuyện
   */
  async getMemoryAnalysis(userId, request) {
    try {
      logger.info("CONVERSATION_SERVICE", `Analyzing memory for user ${userId}`);

      const fullHistory = await storageDB.getConversationHistory(
        userId,
        prompts.system.main,
        AICore.getModelName()
      );

      if (!fullHistory || fullHistory.length === 0) {
        return "Mình chưa có bất kỳ trí nhớ nào về cuộc trò chuyện của chúng ta. Hãy bắt đầu trò chuyện nào! 😊";
      }

      const conversationSummary = [];
      let messageCount = 0;

      for (const msg of fullHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          messageCount++;

          let roleName = msg.role === "user" ? "👤 Bạn" : "🤖 Luna";
          let content = msg.content;

          if (content.length > 150) {
            content = content.substring(0, 150) + "...";
          }

          conversationSummary.push(`${roleName}: ${content}`);
        }
      }

      let analysis = "";

      if (request.toLowerCase().includes("ngắn gọn") || 
          request.toLowerCase().includes("tóm tắt")) {
        analysis = `📝 **Tóm tắt cuộc trò chuyện của chúng ta**\n\n`;
        analysis += `- Chúng ta đã trao đổi ${messageCount} tin nhắn\n`;
        analysis += `- Cuộc trò chuyện bắt đầu cách đây ${textUtils.formatTimeAgo(
          fullHistory[0]?.timestamp || Date.now()
        )}\n\n`;
        analysis += `Đây là một số điểm chính từ cuộc trò chuyện:\n`;

        const keyMessages = textUtils.extractKeyMessages(fullHistory);
        keyMessages.forEach((msg, index) => {
          analysis += `${index + 1}. ${msg}\n`;
        });
      } else if (request.toLowerCase().includes("đầy đủ") || 
                 request.toLowerCase().includes("chi tiết")) {
        analysis = `📜 **Lịch sử đầy đủ cuộc trò chuyện của chúng ta**\n\n`;

        const maxDisplayMessages = Math.min(conversationSummary.length, 15);
        for (let i = conversationSummary.length - maxDisplayMessages; i < conversationSummary.length; i++) {
          analysis += conversationSummary[i] + "\n\n";
        }

        if (conversationSummary.length > maxDisplayMessages) {
          analysis = `💬 *[${conversationSummary.length - maxDisplayMessages} tin nhắn trước đó không được hiển thị]*\n\n` + analysis;
        }
      } else {
        analysis = `💭 **Tóm tắt trí nhớ của cuộc trò chuyện**\n\n`;
        analysis += `- Chúng ta đã trao đổi ${messageCount} tin nhắn\n`;
        analysis += `- Các chủ đề chính: ${textUtils.identifyMainTopics(fullHistory).join(", ")}\n\n`;

        analysis += `**Tin nhắn gần nhất:**\n`;
        const recentMessages = conversationSummary.slice(-3);
        recentMessages.forEach((msg) => {
          analysis += msg + "\n\n";
        });
      }

      analysis += "\n💫 *Lưu ý: Mình vẫn nhớ toàn bộ cuộc trò chuyện của chúng ta và có thể trả lời dựa trên ngữ cảnh đó.*";

      return analysis;
    } catch (error) {
      logger.error("CONVERSATION_SERVICE", "Error analyzing memory:", error);
      return "Xin lỗi, mình gặp lỗi khi truy cập trí nhớ của cuộc trò chuyện. Lỗi: " + error.message;
    }
  }

  /**
   * Xử lý và định dạng nội dung phản hồi
   */
  async formatResponseContent(content, isNewConversation, searchResult) {
    if (!isNewConversation) {
      if (!this.greetingPatterns || this.greetingPatterns.length === 0) {
        await this.refreshGreetingPatterns();
      }

      let contentChanged = false;
      let originalLength = content.length;

      for (const pattern of this.greetingPatterns) {
        const previousContent = content;
        content = content.replace(pattern, "");
        if (previousContent !== content) {
          contentChanged = true;
        }
      }

      content = content.replace(/^[\s,.!:;]+/, "");
      if (content.length > 0) {
        content = content.charAt(0).toUpperCase() + content.slice(1);
      }

      if (contentChanged && content.length < originalLength * 0.7 && content.length < 20) {
        const commonFiller = /^(uhm|hmm|well|so|vậy|thế|đó|nha|nhé|ok|okay|nào|giờ)/i;
        content = content.replace(commonFiller, "");
        content = content.replace(/^[\s,.!:;]+/, "");
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
    } else if (content.toLowerCase().trim() === "chào bạn" || content.length < 6) {
      content = `Hii~ mình là ${AICore.getModelName()} và mình ở đây nếu bạn cần gì nè 💬 Cứ thoải mái nói chuyện như bạn bè nha! ${content}`;
    }

    if (searchResult && searchResult.hasSearchResults) {
      content = `🔍 ${content}`;
      content += `\n\n*Thông tin được cập nhật từ Live Search.*`;

      if (searchResult.searchMetadata) {
        logger.debug("CONVERSATION_SERVICE", `Live Search metadata: ${JSON.stringify(searchResult.searchMetadata)}`);
      }
    }

    return content;
  }

  /**
   * Xử lý completion chính với tất cả logic cuộc trò chuyện
   */
  async getCompletion(prompt, message = null) {
    // Kiểm tra monitoring analysis
    if (!message && (prompt.includes("VI_PHẠM:") || prompt.includes("QUY_TẮC_VI_PHẠM:") || prompt.includes("MỨC_ĐỘ:"))) {
      logger.debug("CONVERSATION_SERVICE", "Redirecting to monitoring analysis");
      return AICore.getMonitoringAnalysis(prompt);
    }

    try {
      const userId = this.extractUserId(message);
      if (userId === "anonymous-user") {
        logger.warn("CONVERSATION_SERVICE", "Cannot determine userId, using default");
      }

      logger.info("CONVERSATION_SERVICE", `Processing chat completion for userId: ${userId}`);

      let isOwnerInteraction = false;
      let ownerMentioned = false;
      let ownerSpecialResponse = "";

      if (message?.author?.id) {
        isOwnerInteraction = ownerService.isOwner(message.author.id);
        ownerMentioned = ownerService.isOwnerMentioned(prompt, message);

        if (isOwnerInteraction) {
          logger.info("CONVERSATION_SERVICE", `Owner interaction: ${message.author.username}`);
          await conversationManager.loadConversationHistory(userId, prompts.system.main, AICore.getModelName());
          const conversationHistory = conversationManager.getHistory(userId);
          const isNewConversation = !conversationHistory || conversationHistory.length <= 2;

          if (isNewConversation) {
            ownerSpecialResponse = await ownerService.getOwnerGreeting();
            logger.info("CONVERSATION_SERVICE", "Generated special owner greeting");
          }
        } else if (ownerMentioned) {
          logger.info("CONVERSATION_SERVICE", "Owner mentioned in message");
          ownerSpecialResponse = await ownerService.getOwnerMentionResponse(prompt);
        }
      }

      // Kiểm tra lệnh tạo hình ảnh
      const imageCommandRegex = /^(vẽ|tạo hình|vẽ hình|hình|tạo ảnh ai|tạo ảnh)\s+(.+)$/i;
      const imageMatch = prompt.match(imageCommandRegex);

      if (imageMatch) {
        const imagePrompt = imageMatch[2];
        const commandUsed = imageMatch[1];
        logger.info("CONVERSATION_SERVICE", `Image command detected: "${commandUsed}". Prompt: ${imagePrompt}`);
        return `Để tạo hình ảnh, vui lòng sử dụng lệnh /image với nội dung bạn muốn tạo. Ví dụ:\n/image ${imagePrompt}`;
      }

      // Kiểm tra lệnh memory analysis
      const memoryAnalysisRegex = /^(nhớ lại|trí nhớ|lịch sử|conversation history|memory|như nãy|vừa gửi|vừa đề cập)\s*(.*)$/i;
      const memoryMatch = prompt.match(memoryAnalysisRegex);

      if (memoryMatch) {
        const memoryRequest = memoryMatch[2].trim() || "toàn bộ cuộc trò chuyện";
        return await this.getMemoryAnalysis(userId, memoryRequest);
      }

      // Xác định có cần web search không
      const shouldSearchWeb = AICore.shouldPerformWebSearch(prompt);
      let searchResult = null;
      let promptWithSearch = prompt;

      if (shouldSearchWeb) {
        logger.info("CONVERSATION_SERVICE", "Performing web search for prompt");
        searchResult = await AICore.performLiveSearch(prompt);

        if (searchResult.hasSearchResults && searchResult.content) {
          promptWithSearch = prompts.web.liveSearchEnhanced
            .replace("${originalPrompt}", prompt)
            .replace("${searchContent}", searchResult.content);
        } else {
          logger.warn("CONVERSATION_SERVICE", "Live Search returned no results");
        }
      }

      const enhancedPromptWithMemory = await this.enrichPromptWithMemory(promptWithSearch, userId);

      // Xử lý chat completion
      let content = await this.processChatCompletion(enhancedPromptWithMemory, userId, searchResult);

      // Xử lý phản hồi đặc biệt cho owner
      if (ownerSpecialResponse) {
        content = `${ownerSpecialResponse}\n\n${content}`;
      }

      return content;
    } catch (error) {
      logger.error("CONVERSATION_SERVICE", "Error in getCompletion:", error.message);
      return `Xin lỗi, tôi không thể kết nối với dịch vụ AI. Lỗi: ${error.message}`;
    }
  }

  /**
   * Xử lý chat completion với conversation manager
   */
  async processChatCompletion(prompt, userId, searchResult = null, additionalConfig = {}) {
    try {
      const systemPrompt = additionalConfig.systemPrompt || prompts.system.main;

      await conversationManager.loadConversationHistory(userId, systemPrompt, AICore.getModelName());

      const conversationHistory = conversationManager.getHistory(userId);
      const isNewConversation = !conversationHistory || conversationHistory.length <= 2;

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
        logger.error("CONVERSATION_SERVICE", `Empty conversation history for userId: ${userId}, reinitializing`);
        await conversationManager.resetConversation(userId, systemPrompt, AICore.getModelName());
        await conversationManager.addMessage(userId, "user", enhancedPrompt);
        messages = conversationManager.getHistory(userId);
      }

      // Gọi AI Core để xử lý
      const content = await AICore.processChatCompletion(messages, {
        model: additionalConfig.model || AICore.CoreModel,
        max_tokens: additionalConfig.max_tokens || 2048,
        ...additionalConfig,
      });

      logger.info("CONVERSATION_SERVICE", `Chat completion processed for userId: ${userId}`);

      await conversationManager.addMessage(userId, "assistant", content);
      const formattedContent = await this.formatResponseContent(content, isNewConversation, searchResult);

      return formattedContent;
    } catch (error) {
      logger.error("CONVERSATION_SERVICE", "Error in processChatCompletion:", error.message);
      throw error;
    }
  }
}

module.exports = new ConversationService(); 