const axios = require("axios");
const fs = require("fs");
const logger = require("../utils/logger.js");

class APIProviderManager {
  constructor() {
    try {
      this.providers = this.initializeProviders();
      this.currentProviderIndex = 0;
      this.failedProviders = new Set();
      this.quotaResetTimes = new Map();
      logger.info("PROVIDERS", `Đã khởi tạo ${this.providers.length} providers`);
    } catch (error) {
      logger.error("PROVIDERS", "Lỗi khi khởi tạo providers:", error);
      this.providers = [];
      this.currentProviderIndex = 0;
      this.failedProviders = new Set();
      this.quotaResetTimes = new Map();
    }
  }

  initializeProviders() {
    const providers = [];
    logger.debug("PROVIDERS", "Bắt đầu khởi tạo providers...");

    if (process.env.LUNA_BASE_URL && process.env.ENABLE_LOCAL_MODEL === 'true') {
      logger.debug("PROVIDERS", "Thêm Local provider");
        providers.push({
          name: "Local",
          baseURL: process.env.LUNA_BASE_URL || "http://localhost:11434/v1",
          apiKey: "local-dummy-key-idk-what-to-put-maybe-empty",
          models: {
            default: process.env.LUNA_DEFAULT_MODEL || "luna:30b",
            thinking: process.env.LUNA_THINKING_MODEL || "luna:235b", 
            image: process.env.GRADIO_IMAGE_SPACE || "stabilityai/stable-diffusion-3-medium"
          },
          headers: {
            "Content-Type": "application/json",
          },
          isLocal: true
        });
      }
    
    if (process.env.PERPLEXITY_API_KEY) {
      logger.debug("PROVIDERS", "Thêm Perplexity provider");
      providers.push({
        name: "Perplexity",
        baseURL: process.env.PERPLEXITY_BASE_URL || "https://api.perplexity.ai/",
        apiKey: process.env.PERPLEXITY_API_KEY,
        models: {
          default: "sonar-pro",
          thinking: "sonar-reasoning",
          image: "sonar-pro"
        },
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Luna/v3"
        }
      });
    }

    if (process.env.OPENROUTER_API_KEY) {
      logger.debug("PROVIDERS", "Thêm OpenRouter provider");
      providers.push({
        name: "OpenRouter",
        baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        models: {
          default: "google/gemini-2.0-flash-exp:free",
          thinking: "deepseek/deepseek-r1:free",
          image: "google/gemini-2.0-flash-exp:free"
        },
        headers: {
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://lunaby.io.vn",
          "X-Title": process.env.OPENROUTER_TITLE || "Luna-AI"
        }
      });
    }

    if (process.env.ALIBABA_API_KEY) {
      providers.push({
        name: "Alibaba",
        baseURL: process.env.ALIBABA_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        apiKey: process.env.ALIBABA_API_KEY,
        models: {
          default: "qwen-plus",
          thinking: "qwen-max",
          image: "qwen-vl-plus"
        },
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    if (process.env.OPENAI_API_KEY) {
      providers.push({
        name: "OpenAI",
        baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY,
        models: {
          default: "gpt-4o",
          thinking: "o1-mini",
          image: "gpt-4o"
        },
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    logger.info("PROVIDERS", `Initialized ${providers.length} providers: ${providers.map(p => p.name).join(", ")}`);
    return providers;
  }

  getCurrentProvider() {
    if (this.providers.length === 0) {
      throw new Error("Không có API provider nào được cấu hình");
    }
    return this.providers[this.currentProviderIndex];
  }

  switchToNextProvider() {
    const originalIndex = this.currentProviderIndex;
    let attempts = 0;
    
    do {
      this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
      attempts++;
      
      const provider = this.providers[this.currentProviderIndex];
      const resetTime = this.quotaResetTimes.get(provider.name);
      
      if (!this.failedProviders.has(provider.name) || 
          (resetTime && Date.now() > resetTime)) {
        if (resetTime && Date.now() > resetTime) {
          this.failedProviders.delete(provider.name);
          this.quotaResetTimes.delete(provider.name);
        }
        
        if (this.currentProviderIndex !== originalIndex) {
          logger.info("PROVIDERS", `Switched to ${provider.name}`);
        }
        return provider;
      }
    } while (attempts < this.providers.length);

    throw new Error("Tất cả API providers đã hết quota hoặc lỗi");
  }

  markProviderAsFailed(providerName, retryAfter = null) {
    this.failedProviders.add(providerName);
    
    if (retryAfter) {
      const resetTime = Date.now() + (retryAfter * 1000);
      this.quotaResetTimes.set(providerName, resetTime);
      logger.warn("PROVIDERS", `${providerName} quota exceeded, retry after ${retryAfter}s`);
    } else {
      this.quotaResetTimes.set(providerName, Date.now() + (60 * 60 * 1000)); // 1 hour default
      logger.warn("PROVIDERS", `${providerName} failed, retry in 1 hour`);
    }
  }

  createAxiosInstance(provider) {
    const https = require("https");
    
    const options = {
      baseURL: provider.baseURL,
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        ...provider.headers
      },
      timeout: 30000,
    };

    const certPath = process.env.CUSTOM_CA_CERT_PATH;
    const rejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0';
    
    if (certPath && fs.existsSync(certPath)) {
      const ca = fs.readFileSync(certPath);
      options.httpsAgent = new https.Agent({ 
        ca,
        rejectUnauthorized: true
      });
    } else if (!rejectUnauthorized) {
      options.httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });
    } else {
      options.httpsAgent = new https.Agent({
        rejectUnauthorized: true
      });
    }

    return axios.create(options);
  }

  isValidResponse(content) {
    if (!content || typeof content !== 'string') return false;
    if (content.length < 10) return false;
    if (content.length > 50000) return false;
    
    const lowerContent = content.toLowerCase();
    const warningPatterns = [
      'quota exceeded', 'rate limit', 'insufficient credits',
      'usage limit', 'billing', 'upgrade your plan',
      'api limit reached', 'exceeded your current quota',
      'rate_limit_exceeded', 'quota_exceeded'
    ];
    
    return !warningPatterns.some(pattern => lowerContent.includes(pattern));
  }

  async makeRequest(endpoint, requestBody, modelType = 'default') {
    logger.debug("PROVIDERS", `makeRequest called with endpoint: ${endpoint}, modelType: ${modelType}`);
    logger.debug("PROVIDERS", `Available providers: ${this.providers.length}`);
    
    if (this.providers.length === 0) {
      throw new Error("Không có API provider nào được cấu hình");
    }
    
    let lastError;
    let attempts = 0;
    const maxAttempts = this.providers.length + 1;

    while (attempts < maxAttempts) {
      const provider = this.getCurrentProvider();
      
      try {
        const model = provider.models[modelType] || provider.models.default;
        const finalRequestBody = {
          ...requestBody,
          model: model
        };

        logger.debug("PROVIDERS", `Using ${provider.name} with model ${model}`);
        
        const axiosInstance = this.createAxiosInstance(provider);
        const response = await axiosInstance.post(endpoint, finalRequestBody);
        
        const content = response.data.choices?.[0]?.message?.content;
        
        if (!this.isValidResponse(content)) {
          logger.warn("PROVIDERS", `Invalid response from ${provider.name}, switching provider`);
          this.markProviderAsFailed(provider.name);
          this.switchToNextProvider();
          attempts++;
          continue;
        }

        logger.info("PROVIDERS", `Successful request using ${provider.name}`);
        return response.data;

      } catch (error) {
        lastError = error;
        attempts++;
        
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 
                           error.response.headers['x-ratelimit-reset-requests'];
          this.markProviderAsFailed(provider.name, retryAfter);
          logger.warn("PROVIDERS", `Rate limit hit for ${provider.name}`);
        } else if (error.response?.status >= 400 && error.response?.status < 500) {
          this.markProviderAsFailed(provider.name);
          logger.warn("PROVIDERS", `Client error for ${provider.name}: ${error.message}`);
        } else {
          logger.error("PROVIDERS", `Network error for ${provider.name}: ${error.message}`);
        }

        try {
          this.switchToNextProvider();
        } catch (switchError) {
          logger.error("PROVIDERS", switchError.message);
          throw new Error(`Không thể chuyển đổi provider: ${switchError.message}`);
        }
      }
    }

    throw new Error(`Tất cả providers đã thất bại. Lỗi cuối: ${lastError?.message}`);
  }

  getProviderStatus() {
    return this.providers.map(provider => ({
      name: provider.name,
      active: !this.failedProviders.has(provider.name),
      current: this.providers[this.currentProviderIndex].name === provider.name,
      resetTime: this.quotaResetTimes.get(provider.name) || null
    }));
  }
}

module.exports = new APIProviderManager();
