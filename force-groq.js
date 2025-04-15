/**
 * Script để buộc sử dụng Groq API thay vì Grok API
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');

// Tạo agent HTTPS bỏ qua SSL
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

async function testGroqAPI() {
  console.log('Đang kiểm tra kết nối với Groq API...');
  
  // Sử dụng khóa API từ biến môi trường
  const apiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
  
  if (!apiKey) {
    console.error('❌ Không tìm thấy khóa API (GROQ_API_KEY hoặc GROK_API_KEY)');
    return false;
  }
  
  try {
    const response = await axios.get('https://api.groq.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      httpsAgent
    });
    
    console.log('✅ Kết nối thành công với Groq API!');
    console.log('Các model có sẵn:');
    response.data.data.forEach(model => {
      console.log(`- ${model.id}`);
    });
    
    // Thử một lời gọi hoàn chỉnh
    console.log('\nĐang thử gửi một prompt đơn giản đến Groq API...');
    const chatResponse = await axios.post('https://api.groq.com/v1/chat/completions', {
      model: 'mixtral-8x7b-32768',
      messages: [
        { role: 'system', content: 'Bạn là trợ lý AI hữu ích tên là Luna.' },
        { role: 'user', content: 'Xin chào!' }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      httpsAgent
    });
    
    console.log('\nPhản hồi từ Groq API:');
    console.log(chatResponse.data.choices[0].message.content);
    
    return true;
  } catch (error) {
    console.error('❌ Lỗi khi kết nối với Groq API:', error.message);
    if (error.response) {
      console.error('Chi tiết lỗi:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function updateEnvFile() {
  console.log('\nCập nhật biến môi trường...');
  const envPath = path.join(__dirname, '.env');
  
  try {
    if (!fs.existsSync(envPath)) {
      console.error('❌ Không tìm thấy file .env');
      return;
    }
    
    // Đọc nội dung hiện tại
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Đảm bảo chúng ta có NODE_TLS_REJECT_UNAUTHORIZED=0
    if (!envContent.includes('NODE_TLS_REJECT_UNAUTHORIZED=')) {
      envContent += '\n# Bỏ qua xác thực SSL\nNODE_TLS_REJECT_UNAUTHORIZED=0\n';
    }
    
    // Ghi lại nội dung
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Đã cập nhật file .env');
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật file .env:', error.message);
  }
}

async function main() {
  console.log('=== Kiểm tra và cấu hình Groq API ===');
  const success = await testGroqAPI();
  
  if (success) {
    await updateEnvFile();
    console.log('\n✅ Mọi thứ đã sẵn sàng để sử dụng Groq API với bot Discord!');
    console.log('Khởi động bot bằng lệnh: npm start');
  } else {
    console.log('\n❌ Không thể kết nối với Groq API.');
    console.log('Vui lòng kiểm tra lại khóa API và kết nối mạng của bạn.');
  }
}

// Chạy script
main().catch(console.error);
