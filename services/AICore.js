const logger = require("../utils/logger.js");
const prompts = require("../config/prompts.js");
const APIProviderManager = require("./providers.js");
const initSystem = require("./initSystem.js");

class AICore {
  constructor() {
    this.systemPrompt = prompts.system.main;
    this.Model = "luna-v3";
    this.providerManager = new APIProviderManager();
    this.providerManager.initializeProviders();
    logger.info("AI_CORE", "Initialized with multi-provider support");
  }

  async waitForProviders() {
    await initSystem.waitForReady();
    return this.providerManager;
  }

  async processChatCompletion(messages, config = {}) {
    try {
      const response = await this.providerManager.makeRequest("/chat/completions", {
        max_tokens: config.max_tokens || 2048,
        messages: messages,
        ...config,
      }, config.modelType || 'default');

      
      const tokenUsage = response.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      };

      return {
        content: response.choices[0].message.content,
        usage: tokenUsage
      };
    } catch (error) {
      logger.error("AI_CORE", "Chat completion error:", error.message);
      throw new Error(`AI API Error: ${error.message}`);
    }
  }

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
        modelType: 'thinking',
      });

      let content = result.content;
      content = "**Quá trình suy nghĩ:**\n" + content;
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
        modelType: 'thinking',
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

  getProviderStatus() {
    return this.providerManager.getProviderStatus();
  }

  isProvidersReady() {
    return initSystem.getStatus().services.providers;
  }
}

module.exports = new AICore();
