const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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
    this.defaultModel = 'grok-3-beta';
    
    // Mô hình đặc biệt cho tạo hình ảnh
    this.imageModel = 'grok-2-image-1212';
    
    console.log(`Đang sử dụng Anthropic SDK với X.AI API và mô hình: ${this.defaultModel}`);
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
        'Content-Type': 'application/json'
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
   * Nhận phản hồi trò chuyện từ API
   */
  async getCompletion(prompt) {
    try {
      // Trích xuất bất kỳ đề cập người dùng nào từ lời nhắc
      const mentions = this.extractMentions(prompt);
      if (mentions.length > 0) {
        console.log(`Phát hiện đề cập trong tin nhắn: ${mentions.join(', ')}`);
        // Xóa các đề cập để tránh nhầm lẫn trong quá trình xử lý AI
        const originalPrompt = prompt;
        prompt = this.removeMentions(prompt);
        console.log(`Tin nhắn trước: "${originalPrompt}"`);
        console.log(`Tin nhắn sau khi loại bỏ đề cập: "${prompt}"`);
      }
      
      // Kiểm tra xem lời nhắc có phải là lệnh tạo hình ảnh không (với hỗ trợ lệnh tiếng Việt mở rộng)
      const imageCommandRegex = /^(\/image|vẽ|tạo hình|vẽ hình|hình)\s+(.+)$/i;
      const imageMatch = prompt.match(imageCommandRegex);
      
      if (imageMatch) {
        // Trích xuất mô tả hình ảnh (bây giờ trong nhóm 2)
        const imagePrompt = imageMatch[2];
        const commandUsed = imageMatch[1];
        console.log(`Detected image generation command "${commandUsed}". Prompt: ${imagePrompt}`);
        
        // Tạo hình ảnh và trả về trực tiếp URL
        return await this.generateImage(imagePrompt);
      }
      
      console.log(`Đang gửi yêu cầu chat completion đến ${this.defaultModel}...`);
      
      // Sử dụng Axios với cấu hình bảo mật
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');
      axiosInstance.defaults.headers['anthropic-version'] = '2023-06-01';
      
      // Thêm hướng dẫn cụ thể về phong cách trả lời
      const enhancedPrompt = `Reply like a smart, sweet, and charming young woman. Use gentle, friendly language — nothing too stiff or robotic. If it fits the context, feel free to sprinkle in light humor or kind encouragement. Avoid sounding too textbook-y or dry. If the user says something interesting, pick up on it naturally to keep the flow going. ${prompt}`;
      
      const response = await axiosInstance.post('/v1/chat/completions', {
        model: this.defaultModel,
        max_tokens: 2048,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: enhancedPrompt }
        ]
      });
      
      console.log('Đã nhận phản hồi từ API');
      let content = response.data.choices[0].message.content;
      
      
      if (content.toLowerCase().trim() === 'chào bạn' || content.length < 4) {
        content = `Hii~ mình ở đây nếu bạn cần gì nè 💬 Cứ thoải mái nói chuyện như bạn bè nha! ${content}`;
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
   * Trích xuất đề cập @username từ văn bản
   * @param {string} text - Văn bản đầu vào để trích xuất đề cập
   * @returns {Array} - Mảng tên người dùng đã được đề cập
   */
  extractMentions(text) {
    if (!text) {
      return [];
    }
    
    // Mở rộng regex để phát hiện nhiều loại đề cập khác nhau
    // Bao gồm các định dạng phổ biến từ nhiều nền tảng
    const patterns = [
      /@([\w.-]+)/g,                 // Định dạng cơ bản: @username
      /@"([^"]+)"/g,                 // Định dạng có dấu ngoặc kép: @"User Name"
      /@'([^']+)'/g,                 // Định dạng có dấu ngoặc đơn: @'User Name'
      /<@!?(\d+)>/g,                 // Định dạng Discord: <@123456789>
      /\[(@[^\]]+)\]/g,              // Định dạng có ngoặc vuông: [@username]
      /@(\S+)/g                      // Bắt bất kỳ chuỗi không khoảng trắng nào theo sau @ 
    ];
    
    const matches = [];
    
    // Kiểm tra từng pattern và thu thập kết quả
    patterns.forEach(pattern => {
      let match;
      const patternCopy = new RegExp(pattern.source, pattern.flags);
      
      while ((match = patternCopy.exec(text)) !== null) {
        matches.push(match[1]);
      }
    });
    
    return [...new Set(matches)]; // Remove duplicates
  }

  /**
   * Xóa đề cập @username khỏi văn bản
   * @param {string} text - Văn bản đầu vào để xóa đề cập
   * @returns {string} - Văn bản đã xóa đề cập
   */
  removeMentions(text) {
    // Cập nhật các pattern xóa để khớp với tất cả các loại đề cập đã phát hiện
    const patterns = [
      /@[\w.-]+\s?/g,
      /@"[^"]+"\s?/g,
      /@'[^']+'\s?/g,
      /<@!?\d+>\s?/g,
      /\[@[^\]]+\]\s?/g,
      /@\S+\s?/g
    ];
    
    let result = text;
    patterns.forEach(pattern => {
      result = result.replace(pattern, '');
    });
    
    return result.trim();
  }
  
  /**
   * Nhận phản hồi mã từ API
   */
  async getCodeCompletion(prompt) {
    try {
      const codingSystemPrompt = `${this.systemPrompt} Bạn cũng là trợ lý lập trình. Cung cấp ví dụ mã và giải thích. Luôn đưa ra mã trong khối code và có comment đầy đủ.`;
      
      // Sử dụng Axios với cấu hình bảo mật
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');
      axiosInstance.defaults.headers['anthropic-version'] = '2023-06-01';
      
      const response = await axiosInstance.post('/v1/chat/completions', {
        model: this.defaultModel,
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
        const models = response.data.data.map(m => m.id).join(', ');
        console.log('Các model có sẵn:', models);
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
   * Xử lý đề cập từ tin nhắn Discord
   * @param {Discord.Message} message - Đối tượng tin nhắn Discord
   * @returns {Object} - Thông tin về đề cập và nội dung đã xử lý
   */
  async processDiscordMessage(message) {
    try {
      // Lấy nội dung gốc của tin nhắn
      const originalContent = message.content;
      console.log("Discord message original content:", originalContent);
      
      // Thu thập thông tin đề cập sử dụng Discord.js API
      const mentionedUsers = Array.from(message.mentions.users.values());
      const mentionedRoles = Array.from(message.mentions.roles.values());
      const mentionedChannels = Array.from(message.mentions.channels.values());
      
      // Log thông tin đề cập
      if (mentionedUsers.length > 0) {
        console.log(`Discord mentions - Users: ${mentionedUsers.map(u => u.username).join(', ')}`);
      }
      if (mentionedRoles.length > 0) {
        console.log(`Discord mentions - Roles: ${mentionedRoles.map(r => r.name).join(', ')}`);
      }
      if (mentionedChannels.length > 0) {
        console.log(`Discord mentions - Channels: ${mentionedChannels.map(c => c.name).join(', ')}`);
      }
      
      // Xóa đề cập sử dụng Discord.js cleanContent
      let cleanContent = message.cleanContent;
      
      // Nếu cleanContent không hoạt động đúng, thủ công thay thế các định dạng đề cập của Discord
      if (cleanContent.includes('<@') || cleanContent.includes('<#') || cleanContent.includes('<@&')) {
        cleanContent = originalContent
          .replace(/<@!?(\d+)>/g, '') // Xóa user mentions
          .replace(/<#(\d+)>/g, '')   // Xóa channel mentions
          .replace(/<@&(\d+)>/g, '')  // Xóa role mentions
          .trim();
      }
      
      console.log("Discord message clean content:", cleanContent);
      
      // Tạo danh sách tên đề cập để trả về
      const mentions = [
        ...mentionedUsers.map(user => user.username),
        ...mentionedRoles.map(role => `role:${role.name}`),
        ...mentionedChannels.map(channel => `channel:${channel.name}`)
      ];
      
      // Trả về cả danh sách đề cập và nội dung đã làm sạch
      return {
        mentions: mentions,
        cleanContent: cleanContent,
        hasMentions: mentions.length > 0
      };
    } catch (error) {
      console.error("Lỗi khi xử lý tin nhắn Discord:", error);
      // Trả về đối tượng mặc định nếu có lỗi
      return {
        mentions: [],
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
    // Xử lý đề cập và làm sạch nội dung
    const processedMessage = await this.processDiscordMessage(message);
    
    // Sử dụng nội dung đã làm sạch để gửi đến API
    return await this.getCompletion(processedMessage.cleanContent);
  }
}

module.exports = new GrokClient();
