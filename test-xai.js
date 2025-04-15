/**
 * Test kết nối trực tiếp đến X.AI API
 */
require('dotenv').config();
const axios = require('axios');

// Lấy API key từ môi trường
const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
if (!apiKey) {
  console.error('Không tìm thấy API key trong biến môi trường');
  process.exit(1);
}

// Test với cấu trúc tin nhắn cơ bản
async function testBasicMessage() {
  console.log('Kiểm tra kết nối với X.AI API...');
  
  try {
    const response = await axios({
      method: 'post',
      url: 'https://api.x.ai/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: 'grok-3-beta',
        messages: [
          { role: 'user', content: 'Xin chào, bạn là ai?' }
        ],
        max_tokens: 100
      }
    });
    
    console.log('Phản hồi thành công:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.choices && response.data.choices.length > 0) {
      console.log('\nNội dung phản hồi:');
      console.log(response.data.choices[0].message.content);
    }
    
    return true;
  } catch (error) {
    console.error('Lỗi khi gọi API:', error.message);
    if (error.response) {
      console.error('Chi tiết lỗi:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Test với system message
async function testSystemMessage() {
  console.log('\nKiểm tra kết nối với system message...');
  
  try {
    const response = await axios({
      method: 'post',
      url: 'https://api.x.ai/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: 'grok-3-beta',
        messages: [
          { role: 'system', content: 'Bạn là Luna, một trợ lý AI. Trả lời bằng tiếng Việt.' },
          { role: 'user', content: 'Xin chào, bạn là ai?' }
        ],
        max_tokens: 100
      }
    });
    
    console.log('Phản hồi thành công:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.choices && response.data.choices.length > 0) {
      console.log('\nNội dung phản hồi:');
      console.log(response.data.choices[0].message.content);
    }
    
    return true;
  } catch (error) {
    console.error('Lỗi khi gọi API với system message:', error.message);
    if (error.response) {
      console.error('Chi tiết lỗi:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Liệt kê các models có sẵn
async function listModels() {
  console.log('\nLấy danh sách models từ X.AI API...');
  
  try {
    const response = await axios({
      method: 'get',
      url: 'https://api.x.ai/v1/models',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Danh sách models:');
    if (response.data && response.data.data) {
      response.data.data.forEach(model => {
        console.log(`- ${model.id}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách models:', error.message);
    if (error.response) {
      console.error('Chi tiết lỗi:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Chạy các tests
async function runTests() {
  await listModels();
  await testBasicMessage();
  await testSystemMessage();
}

runTests().catch(console.error);
