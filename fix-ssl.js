/**
 * Script để chẩn đoán và khắc phục các vấn đề SSL
 */
require('dotenv').config();
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { checkApiStatus } = require('./utils/apiHelper');

// Danh sách các API endpoint để kiểm tra
const API_ENDPOINTS = [
  'api.grok.ai',
  'api.groq.com',
  'api.openai.com'
];

// Tạo thư mục logs nếu chưa tồn tại
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Hàm chính để chẩn đoán vấn đề
async function diagnoseSslIssues() {
  console.log('Bắt đầu chẩn đoán vấn đề kết nối API...');
  
  // Ghi lại thông tin môi trường
  const nodeVersion = process.version;
  const osInfo = {
    platform: process.platform,
    release: process.release,
    version: process.version
  };
  
  console.log(`Phiên bản Node.js: ${nodeVersion}`);
  console.log(`Hệ điều hành: ${osInfo.platform}`);
  
  // Kiểm tra các endpoint API
  console.log('\nKiểm tra kết nối tới các API endpoint:');
  const results = [];
  
  for (const endpoint of API_ENDPOINTS) {
    const status = await checkApiStatus(endpoint);
    results.push(status);
    
    console.log(`\n- ${endpoint}:`);
    console.log(`  DNS phân giải: ${status.dnsResolved ? 'Thành công' : 'Thất bại'}`);
    if (status.dnsResolved) {
      console.log(`  IP addresses: ${status.ipAddresses.join(', ')}`);
    }
    console.log(`  Kết nối HTTPS: ${status.canConnect ? 'Thành công' : 'Thất bại'}`);
  }
  
  // Lưu kết quả vào file log
  const logFile = path.join(logDir, `api-diagnosis-${new Date().toISOString().replace(/:/g, '-')}.json`);
  fs.writeFileSync(logFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    nodeVersion,
    osInfo,
    apiResults: results
  }, null, 2));
  
  console.log(`\nKết quả chẩn đoán đã được lưu vào: ${logFile}`);
  
  // Kiểm tra khả năng kết nối bỏ qua SSL
  console.log('\nĐang thử kết nối với cấu hình SSL đặc biệt...');
  
  // Tạo một instance axios với tùy chọn bỏ qua lỗi SSL
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });
  
  try {
    // Thử kết nối với API mặc định
    const response = await axios.get(`https://${API_ENDPOINTS[0]}/v1/models`, {
      httpsAgent,
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`
      },
      timeout: 5000
    });
    
    console.log('✅ Kết nối thành công khi bỏ qua xác thực SSL!');
    console.log('👉 Đề xuất: Cập nhật GrokClient để bỏ qua xác thực SSL (đã thực hiện trong bản cập nhật)');
  } catch (error) {
    console.log('❌ Vẫn không thể kết nối ngay cả khi bỏ qua SSL.');
    console.log(`Lỗi: ${error.message}`);
    
    // Thử endpoint thay thế
    try {
      console.log('\nĐang thử kết nối với endpoint thay thế...');
      const altResponse = await axios.get(`https://${API_ENDPOINTS[1]}/v1/models`, {
        httpsAgent,
        headers: {
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`
        },
        timeout: 5000
      });
      
      console.log('✅ Kết nối thành công với API thay thế!');
      console.log('👉 Đề xuất: Thay đổi baseURL trong GrokClient sang API thay thế (đã thực hiện trong bản cập nhật)');
    } catch (altError) {
      console.log('❌ Không thể kết nối với API thay thế.');
      console.log(`Lỗi: ${altError.message}`);
    }
  }
  
  console.log('\n=== Kết luận ===');
  console.log('1. Đã cập nhật mã nguồn để xử lý lỗi SSL');
  console.log('2. Kiểm tra xem mạng có chặn kết nối đến các API không');
  console.log('3. Xác minh khóa API của bạn có hợp lệ và đúng định dạng không');
  console.log('4. Khởi động lại bot sau khi cập nhật mã nguồn');
}

// Chạy chẩn đoán
diagnoseSslIssues().catch(console.error);
