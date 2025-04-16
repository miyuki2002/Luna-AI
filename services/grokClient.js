const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const messageHandler = require('../handlers/messageHandler.js'); // Thêm import messageHandler

class GrokClient {
  constructor() {
    // Kiểm tra cài đặt TLS không an toàn và cảnh báo
    this.checkTLSSecurity();
    
    // Lấy API key từ biến môi trường
    this.apiKey = process.env.XAI_API_KEY;
    
    if (!this.apiKey) {
      throw new Error('XAI_API_KEY không được đặt trong biến môi trường');
    }
    
    // Khởi tạo client Anthropic với cấu hình X.AI
    this.client = new Anthropic({
      apiKey: this.apiKey,
      baseURL: 'https://api.x.ai'
    });
    
    // Lời nhắc hệ thống để xác định là Luna
    this.systemPrompt = "Your name is Luna, You are a female-voiced AI with a cute, friendly, and warm tone. You speak naturally and gently, like a lovely older or younger sister, always maintaining professionalism without sounding too formal. When it fits, you can add light humor, emotion, or gentle encouragement. You always listen carefully and respond based on what the user shares, making them feel comfortable and connected — like chatting with someone who truly gets them, priority reply Vietnamese.";
    
    // Mô hình mặc định cho chat
    this.defaultModel = 'grok-3-beta'; // Đã đổi từ grok-3-beta thành grok-3
    
    // Thông tin metadata của model - chỉ để hiển thị
    this.modelInfo = {
      knowledgeCutoff: "Mid-2025", // Ngày giới hạn kiến thức ước tính
      apiVersion: "2025-04-15",    // Phiên bản đặc tả API
      capabilities: ["chat", "code", "reasoning"]
    };
    
    // Mô hình đặc biệt cho tạo hình ảnh
    this.imageModel = 'grok-2-image-1212';
    
    // Mô hình hiển thị cho người dùng
    this.displayModelName = 'luna-v1';
    
    // Kho lưu trữ cuộc hội thoại
    this.conversationStore = {};
    
    // Số lượng tin nhắn tối đa để giữ trong ngữ cảnh
    this.maxConversationLength = 10;
    
    // Tuổi thọ tối đa của cuộc trò chuyện (tính bằng mili giây) - 3 giờ
    this.maxConversationAge = 3 * 60 * 60 * 1000;
    
    // Lên lịch dọn dẹp cuộc trò chuyện cũ mỗi giờ
    setInterval(() => this.cleanupOldConversations(), 60 * 60 * 1000);
    
    console.log(`Đang sử dụng Anthropic SDK với X.AI API và mô hình thực: ${this.defaultModel}`);
    console.log(`Mô hình hiển thị cho người dùng: ${this.displayModelName}`);
    console.log(`Giới hạn kiến thức đến: ${this.modelInfo.knowledgeCutoff}`);
    console.log(`Mô hình tạo hình ảnh: ${this.imageModel}`);
  }
  
  /**
   * Kiểm tra cài đặt bảo mật TLS
   */
  checkTLSSecurity() {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
      console.warn('\x1b[31m%s\x1b[0m', '⚠️ CẢNH BÁO BẢO MẬT: NODE_TLS_REJECT_UNAUTHORIZED=0 ⚠️');
      console.warn('\x1b[33m%s\x1b[0m', 'Cài đặt này làm vô hiệu hóa xác minh chứng chỉ SSL/TLS, khiến tất cả kết nối HTTPS không an toàn!');
      console.warn('\x1b[33m%s\x1b[0m', 'Điều này chỉ nên được sử dụng trong môi trường phát triển, KHÔNG BAO GIỜ trong sản xuất.');
      console.warn('\x1b[36m%s\x1b[0m', 'Để khắc phục, hãy xóa biến môi trường NODE_TLS_REJECT_UNAUTHORIZED=0 hoặc sử dụng giải pháp bảo mật hơn.');
      console.warn('\x1b[36m%s\x1b[0m', 'Nếu bạn đang gặp vấn đề với chứng chỉ tự ký, hãy cấu hình đường dẫn chứng chỉ CA trong thiết lập axios.');
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
        // Phiên bản API khác với ngày giới hạn kiến thức của mô hình
        // Đây là phiên bản đặc tả API, không phải thời điểm kết thúc dữ liệu huấn luyện
        // Kiến thức thực tế của mô hình có thể kết thúc khoảng giữa năm 2023 đối với hầu hết mô hình hiện tại
        'anthropic-version': '2023-06-01', // Đã khôi phục về phiên bản API Anthropic tiêu chuẩn
        'User-Agent': `Luna/${this.displayModelName}`,
        'Accept': 'application/json'
      }
    };
    
    // Nếu có đường dẫn chứng chỉ CA tùy chỉnh (cho môi trường phát triển với chứng chỉ tự ký)
    const certPath = process.env.CUSTOM_CA_CERT_PATH;
    if (certPath && fs.existsSync(certPath)) {
      const ca = fs.readFileSync(certPath);
      options.httpsAgent = new require('https').Agent({ ca });
      console.log(`Đang sử dụng chứng chỉ CA tùy chỉnh từ: ${certPath}`);
    }
    
    return axios.create(options);
  }

  /**
   * Thêm tin nhắn vào lịch sử cuộc trò chuyện
   * @param {string} userId - Định danh người dùng
   * @param {string} role - Vai trò của tin nhắn ('user' hoặc 'assistant')
   * @param {string} content - Nội dung tin nhắn
   */
  addMessageToConversation(userId, role, content) {
    // Khởi tạo cuộc trò chuyện cho người dùng nếu chưa tồn tại
    if (!this.conversationStore[userId]) {
      this.conversationStore[userId] = {
        messages: [],
        lastUpdated: Date.now()
      };
    }
    
    // Thêm tin nhắn mới
    this.conversationStore[userId].messages.push({
      role: role,
      content: content
    });
    
    // Cập nhật thời gian của cuộc trò chuyện
    this.conversationStore[userId].lastUpdated = Date.now();
    
    // Chỉ giữ lại các tin nhắn gần đây nhất lên đến maxConversationLength
    if (this.conversationStore[userId].messages.length > this.maxConversationLength) {
      // Xóa tin nhắn cũ nhưng giữ lại lời nhắc hệ thống ở đầu
      const systemPrompt = this.conversationStore[userId].messages[0];
      this.conversationStore[userId].messages = 
        [systemPrompt, ...this.conversationStore[userId].messages.slice(-(this.maxConversationLength - 1))];
    }
    
    console.log(`Đã cập nhật cuộc trò chuyện cho người dùng ${userId}, độ dài lịch sử: ${this.conversationStore[userId].messages.length}`);
  }
  
  /**
   * Lấy lịch sử cuộc trò chuyện của người dùng
   * @param {string} userId - Định danh người dùng
   * @returns {Array} - Mảng các tin nhắn trò chuyện
   */
  getConversationHistory(userId) {
    if (!this.conversationStore[userId]) {
      // Khởi tạo với lời nhắc hệ thống nếu không có lịch sử
      this.conversationStore[userId] = {
        messages: [{ role: 'system', content: this.systemPrompt + ` You are running on ${this.displayModelName} model.` }],
        lastUpdated: Date.now()
      };
    } else {
      // Cập nhật thời gian để cho biết cuộc trò chuyện này vẫn đang hoạt động
      this.conversationStore[userId].lastUpdated = Date.now();
    }
    
    return this.conversationStore[userId].messages;
  }
  
  /**
   * Xóa lịch sử cuộc trò chuyện của người dùng
   * @param {string} userId - Định danh người dùng
   */
  clearConversationHistory(userId) {
    if (this.conversationStore[userId]) {
      this.conversationStore[userId] = {
        messages: [{ role: 'system', content: this.systemPrompt + ` You are running on ${this.displayModelName} model.` }],
        lastUpdated: Date.now()
      };
      console.log(`Đã xóa cuộc trò chuyện của người dùng ${userId}`);
    }
  }
  
  /**
   * Xóa các cuộc trò chuyện cũ để giải phóng bộ nhớ
   */
  cleanupOldConversations() {
    const now = Date.now();
    let cleanCount = 0;
    
    Object.keys(this.conversationStore).forEach(userId => {
      if ((now - this.conversationStore[userId].lastUpdated) > this.maxConversationAge) {
        delete this.conversationStore[userId];
        cleanCount++;
      }
    });
    
    if (cleanCount > 0) {
      console.log(`Đã dọn dẹp ${cleanCount} cuộc trò chuyện cũ`);
    }
  }

  /**
   * Nhận phản hồi trò chuyện từ API
   */
  async getCompletion(prompt, message = null) {
    try {
      // Trích xuất ID người dùng từ tin nhắn hoặc tạo một ID cho tương tác không phải Discord
      const userId = message?.author?.id || 'default-user';
      
      // Kiểm tra xem lời nhắc có phải là lệnh tạo hình ảnh không (với hỗ trợ lệnh tiếng Việt mở rộng)
      const imageCommandRegex = /^(\/image|vẽ|tạo hình|vẽ hình|hình|tạo ảnh ai|tạo ảnh)\s+(.+)$/i;
      const imageMatch = prompt.match(imageCommandRegex);
      
      if (imageMatch) {
        // Trích xuất mô tả hình ảnh (bây giờ trong nhóm 2)
        const imagePrompt = imageMatch[2];
        const commandUsed = imageMatch[1];
        console.log(`Phát hiện lệnh tạo hình ảnh "${commandUsed}". Prompt: ${imagePrompt}`);
        
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
      
      console.log(`Đang gửi yêu cầu chat completion đến ${this.defaultModel}... (hiển thị cho người dùng: ${this.displayModelName})`);
      
      // Sử dụng Axios với cấu hình bảo mật
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');
      
      // Thêm hướng dẫn cụ thể về phong cách trả lời
      const enhancedPrompt = `Reply like a smart, sweet, and charming young woman named Luna. Use gentle, friendly language — nothing too stiff or robotic. If it fits the context, feel free to sprinkle in light humor or kind encouragement. Avoid sounding too textbook-y or dry. If the user says something interesting, pick up on it naturally to keep the flow going. ${prompt}`;
      
      // Chuẩn bị tin nhắn cho lịch sử cuộc trò chuyện
      const userMessage = enhancedPrompt || prompt;
      
      // Lấy lịch sử cuộc trò chuyện hiện có
      const conversationHistory = this.getConversationHistory(userId);
      
      // Thêm tin nhắn người dùng vào lịch sử
      this.addMessageToConversation(userId, 'user', userMessage);
      
      // Tạo mảng tin nhắn hoàn chỉnh với lịch sử cuộc trò chuyện
      const messages = [...conversationHistory];
      
      // Thực hiện yêu cầu API với lịch sử cuộc trò chuyện
      const response = await axiosInstance.post('/v1/chat/completions', {
        model: this.defaultModel,
        max_tokens: 2048,
        messages: messages
      });
      
      console.log('Đã nhận phản hồi từ API');
      let content = response.data.choices[0].message.content;
      
      // Thêm phản hồi của trợ lý vào lịch sử cuộc trò chuyện
      this.addMessageToConversation(userId, 'assistant', content);
      
      if (content.toLowerCase().trim() === 'chào bạn' || content.length < 6) {
        content = `Hii~ mình là ${this.displayModelName} và mình ở đây nếu bạn cần gì nè 💬 Cứ thoải mái nói chuyện như bạn bè nha! ${content}`;
      }
      
      // Đôi khi chủ động đề cập tới phiên bản model (khoảng 10% các câu trả lời)
      if (Math.random() < 0.1 && content.length < 100) {
        content += ` (Mình là ${this.displayModelName} - một phiên bản của Luna) 💖`;
        content += ` (Trả lời bởi ${this.displayModelName} 💫)`;
      }
      
      return content;
    } catch (error) {
      console.error(`Lỗi khi gọi X.AI API:`, error.message);
      if (error.response) {
        console.error('Chi tiết lỗi:', JSON.stringify(error.response.data, null, 2));
      }
      return `Xin lỗi, tôi không thể kết nối với dịch vụ AI. Lỗi: ${error.message}`;
    }
  }
  
  /**
   * Nhận phản hồi mã từ API
   */
  async getCodeCompletion(prompt) {
    try {
      const codingSystemPrompt = `${this.systemPrompt} Bạn cũng là trợ lý lập trình với tên mô hình ${this.displayModelName}. Cung cấp ví dụ mã và giải thích. Luôn đưa ra mã trong khối code và có comment đầy đủ.`;
      
      // Sử dụng Axios với cấu hình bảo mật
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');
      
      const response = await axiosInstance.post('/v1/chat/completions', {
        model: this.defaultModel, // Sử dụng grok-3 cho cuộc gọi API thực tế
        max_tokens: 4096,
        messages: [
          { role: 'system', content: codingSystemPrompt },
          { role: 'user', content: prompt }
        ]
      });
      
      return response.data.choices[0].message.content;
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
      
      // Kiểm tra cụ thể việc từ chối kiểm duyệt nội dung
      if (error.response && 
          error.response.data && 
          error.response.data.error &&
          error.response.data.error.includes("Generated image rejected by content moderation")) {
        return "Xin lỗi, mình không thể tạo hình ảnh này. Nội dung bạn yêu cầu không tuân thủ nguyên tắc kiểm duyệt nội dung. Vui lòng thử chủ đề hoặc mô tả khác.";
      }
      
      // Đối với các lỗi khác, chỉ trả về thông báo lỗi thay vì ném lỗi
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
      
      // Thử lấy danh sách models
      const response = await axiosInstance.get('/v1/models');
      
      console.log('Kết nối thành công với X.AI API!');
      if (response.data && response.data.data) {
        console.log(`Đang sử dụng model API: ${this.defaultModel}`);
        console.log(`Hiển thị cho người dùng: ${this.displayModelName}`);
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
      // Lấy nội dung gốc của tin nhắn
      const originalContent = message.content;
      console.log("Nội dung gốc của tin nhắn Discord:", originalContent);
      
      // Xử lý nội dung đơn giản
      let cleanContent = message.cleanContent || originalContent;
      console.log("Nội dung đã xử lý của tin nhắn Discord:", cleanContent);
      
      return {
        cleanContent: cleanContent,
        hasMentions: false
      };
    } catch (error) {
      console.error("Lỗi khi xử lý tin nhắn Discord:", error);
      // Trả về đối tượng mặc định nếu có lỗi
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
    // Xử lý và làm sạch nội dung
    const processedMessage = await this.processDiscordMessage(message);
    
    // Kiểm tra lệnh reset cuộc trò chuyện
    if (processedMessage.cleanContent.toLowerCase() === '/reset' || 
        processedMessage.cleanContent.toLowerCase() === 'reset conversation') {
      this.clearConversationHistory(message.author.id);
      return "Đã xóa lịch sử cuộc trò chuyện của chúng ta. Bắt đầu cuộc trò chuyện mới nào! 😊";
    }
    
    // Sử dụng nội dung đã làm sạch để gửi đến API, kèm theo message object
    return await this.getCompletion(processedMessage.cleanContent, message);
  }

  /**
   * Trả về tên mô hình được hiển thị cho người dùng
   * @returns {string} - Tên mô hình hiển thị
   */
  getModelName() {
    return this.displayModelName;
  }
}

module.exports = new GrokClient();
