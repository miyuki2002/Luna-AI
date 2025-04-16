const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const fs = require('fs');
const messageHandler = require('../handlers/messageHandler.js');
const storageDB = require('./storagedb.js');
// Import the conversationManager module
const conversationManager = require('../handlers/conversationManager.js');

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
    
    // System Prompt
    this.systemPrompt = "Your name is Luna, your data is update to 2025. You are a female-voiced AI with a cute, friendly, and warm tone. You speak naturally and gently, like a lovely older or younger sister, always maintaining professionalism without sounding too formal. When it fits, you can add light humor, emotion, or gentle encouragement. You always listen carefully and respond based on what the user shares, making them feel comfortable and connected — like chatting with someone who truly gets them, priority reply Vietnamese.";
    
    // Mô hình mặc định cho chat
    this.CoreModel = 'grok-3-fast-beta';
    
    // Mô hình đặc biệt cho tạo hình ảnh
    this.imageModel = 'grok-2-image-1212';
    
    // Mô hình hiển thị cho người dùng
    this.Model = 'luna-v1';
    
    // Cấu hình StorageDB
    storageDB.setMaxConversationLength(10);
    storageDB.setMaxConversationAge(3 * 60 * 60 * 1000);
    
    // DỌN DẸP: Không gọi initializeGreetingPatterns trực tiếp trong constructor nữa
    // this.initializeGreetingPatterns();
    
    // Khởi tạo mảng rỗng để sử dụng trước khi có dữ liệu từ MongoDB
    this.greetingPatterns = [];
    
    console.log(`Model chat: ${this.CoreModel} & ${this.Model}`);
    console.log(`Model tạo hình ảnh: ${this.imageModel}`);
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
      console.log(`Đã tải ${this.greetingPatterns.length} mẫu lời chào từ cơ sở dữ liệu`);
    } catch (error) {
      console.error('Lỗi khi khởi tạo mẫu lời chào:', error);
      this.greetingPatterns = [];
    }
  }

  /**
   * Cập nhật mẫu lời chào từ cơ sở dữ liệu
   */
  async refreshGreetingPatterns() {
    try {
      this.greetingPatterns = await storageDB.getGreetingPatterns();
      console.log(`Đã cập nhật ${this.greetingPatterns.length} mẫu lời chào từ cơ sở dữ liệu`);
    } catch (error) {
      console.error('Lỗi khi cập nhật mẫu lời chào:', error);
    }
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
        'anthropic-version': '2025-04-15',
        'User-Agent': `Luna/${this.Model}`,
        'Accept': 'application/json'
      }
    };
    
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
  async getCompletion(prompt, message = null) {
    try {
      // Trích xuất ID người dùng từ tin nhắn hoặc tạo một ID cho tương tác không phải Discord
      const userId = message?.author?.id || 'default-user';
      
      // Kiểm tra xem lời nhắc có phải là lệnh tạo hình ảnh không (với hỗ trợ lệnh tiếng Việt mở rộng)
      const imageCommandRegex = /^(vẽ|tạo hình|vẽ hình|hình|tạo ảnh ai|tạo ảnh)\s+(.+)$/i;
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
      
      // Kiểm tra xem có phải là lệnh yêu cầu phân tích ký ức không
      const memoryAnalysisRegex = /^(nhớ lại|trí nhớ|lịch sử|conversation history|memory|như nãy|vừa gửi|vừa đề cập)\s*(.*)$/i;
      const memoryMatch = prompt.match(memoryAnalysisRegex);
      
      if (memoryMatch) {
        const memoryRequest = memoryMatch[2].trim() || "toàn bộ cuộc trò chuyện";
        return await this.getMemoryAnalysis(userId, memoryRequest);
      }
      
      console.log(`Đang gửi yêu cầu chat completion đến ${this.CoreModel}... (hiển thị cho người dùng: ${this.Model})`);
      
      // Kiểm tra xem có nên bổ sung thông tin từ trí nhớ vào prompt
      const enhancedPromptWithMemory = await this.enrichPromptWithMemory(prompt, userId);
      
      // Sử dụng Axios với cấu hình bảo mật
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');
      
      // Lấy lịch sử cuộc trò chuyện hiện có
      const conversationHistory = await conversationManager.loadConversationHistory(userId, this.systemPrompt, this.Model);
      
      // Xác định xem có phải là cuộc trò chuyện mới hay không
      const isNewConversation = conversationHistory.length <= 2; // Chỉ có system prompt và tin nhắn hiện tại
      
      // Thêm hướng dẫn cụ thể về phong cách trả lời, bổ sung hướng dẫn về lời chào
      let enhancedPrompt = `Reply like a smart, sweet, and charming young woman named Luna. Use gentle, friendly language — nothing too stiff or robotic.`;
      
      // Thêm hướng dẫn không gửi lời chào nếu đang trong cuộc trò chuyện hiện có
      if (!isNewConversation) {
        enhancedPrompt += ` IMPORTANT: This is an ongoing conversation, DO NOT introduce yourself again or send greetings like "Chào bạn", "Hi", "Hello" or "Mình là Luna". Continue the conversation naturally without reintroducing yourself.`;
      } else {
        enhancedPrompt += ` If it fits the context, feel free to sprinkle in light humor or kind encouragement.`;
      }
      
      enhancedPrompt += ` Avoid sounding too textbook-y or dry. If the user says something interesting, pick up on it naturally to keep the flow going. ${enhancedPromptWithMemory}`;
      
      // Chuẩn bị tin nhắn cho lịch sử cuộc trò chuyện
      const userMessage = enhancedPrompt || prompt;
      
      // Thêm tin nhắn người dùng vào lịch sử
      await conversationManager.addMessage(userId, 'user', userMessage);
      
      // Tạo mảng tin nhắn hoàn chỉnh với lịch sử cuộc trò chuyện
      const messages = conversationManager.getHistory();
      
      // Thực hiện yêu cầu API với lịch sử cuộc trò chuyện
      const response = await axiosInstance.post('/v1/chat/completions', {
        model: this.CoreModel,
        max_tokens: 2048,
        messages: messages
      });
      
      console.log('Đã nhận phản hồi từ API');
      let content = response.data.choices[0].message.content;
      
      // Thêm phản hồi của trợ lý vào lịch sử cuộc trò chuyện
      await conversationManager.addMessage(userId, 'assistant', content);
      
      // Lọc bỏ các lời chào thông thường ở đầu tin nhắn nếu không phải cuộc trò chuyện mới
      if (!isNewConversation) {
        // Sử dụng mẫu lời chào từ cơ sở dữ liệu
        if (!this.greetingPatterns || this.greetingPatterns.length === 0) {
          // Nếu chưa tải được mẫu lời chào, tải lại
          await this.refreshGreetingPatterns();
        }
        
        // Áp dụng từng mẫu lọc
        let contentChanged = false;
        let originalLength = content.length;
        
        for (const pattern of this.greetingPatterns) {
          const previousContent = content;
          content = content.replace(pattern, '');
          
          // Kiểm tra nếu có sự thay đổi
          if (previousContent !== content) {
            contentChanged = true;
          }
        }
        
        // Xử lý sau khi lọc - giữ nguyên logic hiện tại
        content = content.replace(/^[\s,.!:;]+/, '');
        
        // Viết hoa chữ cái đầu tiên nếu cần
        if (content.length > 0) {
          content = content.charAt(0).toUpperCase() + content.slice(1);
        }
        
        // Nếu nội dung bị thay đổi quá nhiều, có thể là lời chào phức tạp - kiểm tra thêm
        if (contentChanged && content.length < originalLength * 0.7 && content.length < 20) {
          // Nếu nội dung còn lại quá ngắn, có thể toàn bộ là lời chào
          // Kiểm tra thêm các từ khóa phổ biến
          const commonFiller = /^(uhm|hmm|well|so|vậy|thế|đó|nha|nhé|ok|okay|nào|giờ)/i;
          content = content.replace(commonFiller, '');
          
          // Lại dọn dẹp và viết hoa
          content = content.replace(/^[\s,.!:;]+/, '');
          if (content.length > 0) {
            content = content.charAt(0).toUpperCase() + content.slice(1);
          }
        }
        
        // Nếu nội dung sau khi lọc quá ngắn, hãy kiểm tra xem có phải là lời chào kèm thông tin hay không
        if (content.length < 10 && originalLength > 50) {
          // Phục hồi nội dung gốc nhưng bỏ 30 ký tự đầu (thường là lời chào)
          const potentialContentStart = originalLength > 30 ? 30 : Math.floor(originalLength / 2);
          content = content || originalContent.substring(potentialContentStart).trim();
          
          // Viết hoa lại chữ cái đầu
          if (content.length > 0) {
            content = content.charAt(0).toUpperCase() + content.slice(1);
          }
        }
      } else if (content.toLowerCase().trim() === 'chào bạn' || content.length < 6) {
        content = `Hii~ mình là ${this.Model} và mình ở đây nếu bạn cần gì nè 💬 Cứ thoải mái nói chuyện như bạn bè nha! ${content}`;
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
      
      // Tạo prompt đặc biệt yêu cầu mô hình hiển thị quá trình suy nghĩ
      const thinkingPrompt = 
        `Hãy giải thích quá trình suy nghĩ của bạn theo từng bước trước khi đưa ra câu trả lời cuối cùng.
         
         Hãy chia câu trả lời của bạn thành hai phần:
         1. [THINKING] - Quá trình suy nghĩ, phân tích và suy luận của bạn
         2. [ANSWER] - Câu trả lời cuối cùng, rõ ràng và ngắn gọn
         
         Câu hỏi: ${prompt}`;
      
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');
      
      // Lấy lịch sử cuộc trò chuyện hiện có
      const conversationHistory = await conversationManager.loadConversationHistory(userId, this.systemPrompt, this.Model);
      
      // Thêm tin nhắn người dùng vào lịch sử
      await conversationManager.addMessage(userId, 'user', thinkingPrompt);
      
      // Tạo mảng tin nhắn hoàn chỉnh với lịch sử cuộc trò chuyện
      const messages = conversationManager.getHistory();
      
      const response = await axiosInstance.post('/v1/chat/completions', {
        model: this.CoreModel,
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
      console.error(`Lỗi khi gọi X.AI API cho chế độ thinking:`, error.message);
      if (error.response) {
        console.error('Chi tiết lỗi:', JSON.stringify(error.response.data, null, 2));
      }
      return `Xin lỗi, tôi không thể kết nối với dịch vụ AI ở chế độ thinking. Lỗi: ${error.message}`;
    }
  }
  
  /**
   * Nhận phản hồi mã từ API
   */
  async getCodeCompletion(prompt) {
    try {
      // Kiểm tra xem có yêu cầu chế độ thinking không
      if (prompt.toLowerCase().includes('thinking') || prompt.toLowerCase().includes('giải thích từng bước')) {
        const codingThinkingPrompt = `${this.systemPrompt} Bạn cũng là trợ lý lập trình với tên mô hình ${this.Model}. 
          Hãy giải thích quá trình suy nghĩ của bạn trước khi viết mã.
          
          Sử dụng định dạng:
          [THINKING] - Phân tích vấn đề và cách tiếp cận
          [CODE] - Mã hoàn chỉnh với comment đầy đủ
          [EXPLANATION] - Giải thích chi tiết về mã
          
          Câu hỏi: ${prompt}`;
        
        const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');
        
        const response = await axiosInstance.post('/v1/chat/completions', {
          model: this.CoreModel,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: codingThinkingPrompt },
            { role: 'user', content: prompt }
          ]
        });
        
        let content = response.data.choices[0].message.content;
        
        // Định dạng phần suy nghĩ để dễ đọc hơn
        content = content.replace('[THINKING]', '💭 **Quá trình phân tích:**\n');
        content = content.replace('[CODE]', '\n\n💻 **Code:**\n');
        content = content.replace('[EXPLANATION]', '\n\n📝 **Giải thích:**\n');
        
        return content;
      }
      
      const codingSystemPrompt = `${this.systemPrompt} Bạn cũng là trợ lý lập trình với tên mô hình ${this.Model}. Cung cấp ví dụ mã và giải thích. Luôn đưa ra mã trong khối code và có comment đầy đủ.`;
      
      // Sử dụng Axios với cấu hình bảo mật
      const axiosInstance = this.createSecureAxiosInstance('https://api.x.ai');
      
      const response = await axiosInstance.post('/v1/chat/completions', {
        model: this.CoreModel,
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
    
    // Thêm lệnh để quản lý mẫu lời chào (chỉ cho quản trị viên)
    if (message.member && message.member.permissions.has('ADMINISTRATOR')) {
      if (processedMessage.cleanContent.startsWith('!addgreeting ')) {
        const pattern = processedMessage.cleanContent.substring(13).trim();
        if (pattern) {
          const added = await storageDB.addGreetingPattern(pattern, 'i', 'Mẫu được thêm thủ công');
          await this.refreshGreetingPatterns();
          return added ? 
            `✅ Đã thêm mẫu lời chào: \`${pattern}\`` : 
            `❌ Mẫu lời chào đã tồn tại hoặc không hợp lệ`;
        }
        return "❓ Hãy cung cấp mẫu regex hợp lệ";
      }
      
      if (processedMessage.cleanContent === '!greetingpatterns') {
        await this.refreshGreetingPatterns();
        return `📋 Hiện có ${this.greetingPatterns.length} mẫu lời chào trong cơ sở dữ liệu`;
      }
    }
    
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
}

module.exports = new GrokClient();
