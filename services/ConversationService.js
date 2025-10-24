const logger = require("../utils/logger.js");
const storageDB = require("./storagedb.js");
const conversationManager = require("../handlers/conversationManager.js");
const ownerService = require("./ownerService.js");
const prompts = require("../config/prompts.js");
const textUtils = require("../utils/textUtils.js");
const AICore = require("./AICore.js");

class ConversationService {
  constructor() {
    storageDB.setMaxConversationLength(30);
    storageDB.setMaxConversationAge(3 * 60 * 60 * 1000);
    
    logger.info("CONVERSATION_SERVICE", "Initialized conversation service");
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
   * Trích xuất thông tin từ trí nhớ cuộc trò chuyện
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

          let roleName = msg.role === "user" ? "Bạn" : "Luna";
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
        analysis = `**Tóm tắt cuộc trò chuyện của chúng ta**\n\n`;
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
        analysis = `**Lịch sử đầy đủ cuộc trò chuyện của chúng ta**\n\n`;

        const maxDisplayMessages = Math.min(conversationSummary.length, 15);
        for (let i = conversationSummary.length - maxDisplayMessages; i < conversationSummary.length; i++) {
          analysis += conversationSummary[i] + "\n\n";
        }

        if (conversationSummary.length > maxDisplayMessages) {
          analysis = `*[${conversationSummary.length - maxDisplayMessages} tin nhắn trước đó không được hiển thị]*\n\n` + analysis;
        }
      } else {
        analysis = `**Tóm tắt trí nhớ của cuộc trò chuyện**\n\n`;
        analysis += `- Chúng ta đã trao đổi ${messageCount} tin nhắn\n`;
        analysis += `- Các chủ đề chính: ${textUtils.identifyMainTopics(fullHistory).join(", ")}\n\n`;

        analysis += `**Tin nhắn gần nhất:**\n`;
        const recentMessages = conversationSummary.slice(-3);
        recentMessages.forEach((msg) => {
          analysis += msg + "\n\n";
        });
      }

      analysis += "\n*Lưu ý: Mình vẫn nhớ toàn bộ cuộc trò chuyện của chúng ta và có thể trả lời dựa trên ngữ cảnh đó.*";

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
    if (searchResult && searchResult.hasSearchResults) {
      content = `${content}`;
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

        if (ownerMentioned) {
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

      // Kiểm tra câu hỏi về training data
      if (prompts.trainingData.keywords.test(prompt)) {
        logger.info("CONVERSATION_SERVICE", "Training data question detected, returning direct response");
        return prompts.trainingData.response;
      }

      // Kiểm tra câu hỏi về model info/version
      if (prompts.modelInfo.keywords.test(prompt)) {
        logger.info("CONVERSATION_SERVICE", "Model info question detected, returning direct response");
        return prompts.modelInfo.response;
      }

      const enhancedPromptWithMemory = await this.enrichPromptWithMemory(prompt, userId);

      // Xử lý chat completion
      let content = await this.processChatCompletion(enhancedPromptWithMemory, userId, searchResults);

      // Xử lý phản hồi khi owner được mention
      if (ownerSpecialResponse) {
        content = `${ownerSpecialResponse}\n\n${content}`;
      }

      return content;
    } catch (error) {
      logger.error("CONVERSATION_SERVICE", "Error in getCompletion:", error.message);
      return `Xin lỗi, hệ thống xảy ra lỗi khi xử lý cuộc trò chuyện. Vui lòng thử lại sau.`;
    }
  }

  /**
   * Xử lý chat completion với conversation manager
   */
  async processChatCompletion(prompt, userId, searchResult = null, additionalConfig = {}) {
    try {
      let systemPrompt = additionalConfig.systemPrompt || prompts.system.main;

      await conversationManager.loadConversationHistory(userId, systemPrompt, AICore.getModelName());

      const conversationHistory = conversationManager.getHistory(userId);
      const isNewConversation = !conversationHistory || conversationHistory.length <= 2;

      let enhancedPrompt = prompts.chat.responseStyle;

      if (!isNewConversation) {
        enhancedPrompt += prompts.chat.ongoingConversation;
      } else {
        enhancedPrompt += prompts.chat.newConversation;
      }

      // Xử lý search results nếu có
      if (searchResult && searchResult.hasSearchResults && searchResult.content) {
        logger.info("CONVERSATION_SERVICE", "Integrating Live Search results into prompt");
        logger.debug("CONVERSATION_SERVICE", `Search result content: ${searchResult.content.substring(0, 200)}...`);
        
        enhancedPrompt += prompts.chat.webSearch;
        // Tích hợp kết quả search vào prompt
        enhancedPrompt = prompts.web.liveSearchEnhanced
          .replace("${originalPrompt}", prompt)
          .replace("${searchContent}", searchResult.content);
        
        logger.debug("CONVERSATION_SERVICE", `Enhanced prompt with search: ${enhancedPrompt.substring(0, 300)}...`);
        
        // Sử dụng system prompt đặc biệt cho Live Search
        systemPrompt = prompts.web.liveSearchSystem + "\n\n" + systemPrompt;
        
        // Reset conversation với system prompt mới
        await conversationManager.resetConversation(userId, systemPrompt, AICore.getModelName());
      } else {
        logger.debug("CONVERSATION_SERVICE", "No search results, using model knowledge");
        enhancedPrompt += prompts.chat.generalInstructions + ` ${prompt}`;
      }

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

      logger.debug("CONVERSATION_SERVICE", "Gọi AICore.processChatCompletion");
      const result = await AICore.processChatCompletion(messages, {
        model: additionalConfig.model || AICore.CoreModel,
        max_tokens: additionalConfig.max_tokens || 2048,
        enableLiveSearch: searchResult && searchResult.hasSearchResults,
        ...additionalConfig,
      });

      const content = result.content;
      const tokenUsage = result.usage;

      logger.info("CONVERSATION_SERVICE", `Chat completion processed for userId: ${userId}`);
      logger.debug("CONVERSATION_SERVICE", `Token usage: ${JSON.stringify(tokenUsage)}`);

      // Ghi nhận token usage
      if (tokenUsage && tokenUsage.total_tokens) {
        const TokenService = require('./TokenService.js');
        await TokenService.recordTokenUsage(userId, tokenUsage.total_tokens, 'chat');
      }

      await conversationManager.addMessage(userId, "assistant", content);
      const formattedContent = await this.formatResponseContent(content, isNewConversation, searchResult);

      return formattedContent;
    } catch (error) {
      logger.error("CONVERSATION_SERVICE", "Error in processChatCompletion:", error.message);
      logger.error("CONVERSATION_SERVICE", "Error stack:", error.stack);
      throw error;
    }
  }
}

module.exports = new ConversationService(); 