const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

class GrokClient {
  constructor() {
    // Lấy API key từ biến môi trường
    this.apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
    
    if (!this.apiKey) {
      throw new Error('XAI_API_KEY hoặc GROK_API_KEY không được đặt trong biến môi trường');
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
   * Nhận phản hồi trò chuyện từ API
   */
  async getCompletion(prompt) {
    try {
      // Trích xuất bất kỳ đề cập người dùng nào từ lời nhắc
      const mentions = this.extractMentions(prompt);
      if (mentions.length > 0) {
        console.log(`Detected mentions in message: ${mentions.join(', ')}`);
        // Xóa các đề cập để tránh nhầm lẫn trong quá trình xử lý AI
        prompt = this.removeMentions(prompt);
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
      
      // Sử dụng Axios trực tiếp thay vì SDK để đảm bảo định dạng tin nhắn chính xác
      const axiosInstance = axios.create({
        baseURL: 'https://api.x.ai',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        }
      });
      
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
    const mentionRegex = /@(\w+)/g;
    const matches = text.match(mentionRegex);
    
    if (!matches) return [];
    
    // Xóa ký hiệu @ và trả về chỉ tên người dùng
    return matches.map(mention => mention.substring(1));
  }
  
  /**
   * Xóa đề cập @username khỏi văn bản
   * @param {string} text - Văn bản đầu vào để xóa đề cập
   * @returns {string} - Văn bản đã xóa đề cập
   */
  removeMentions(text) {
    return text.replace(/@\w+\s?/g, '').trim();
  }
  
  /**
   * Nhận phản hồi mã từ API
   */
  async getCodeCompletion(prompt) {
    try {
      const codingSystemPrompt = `${this.systemPrompt} Bạn cũng là trợ lý lập trình. Cung cấp ví dụ mã và giải thích. Luôn đưa ra mã trong khối code và có comment đầy đủ.`;
      
      const axiosInstance = axios.create({
        baseURL: 'https://api.x.ai',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        }
      });
      
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
      
      const axiosInstance = axios.create({
        baseURL: 'https://api.x.ai',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
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
      
      const axiosInstance = axios.create({
        baseURL: 'https://api.x.ai',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
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
}

module.exports = new GrokClient();
