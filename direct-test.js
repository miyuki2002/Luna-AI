/**
 * Test kết nối trực tiếp đến Grok API bỏ qua thư viện axios
 */
require('dotenv').config();
const https = require('https');
const tls = require('tls');

// Tắt xác thực SSL
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Lấy API key từ môi trường
const apiKey = process.env.GROK_API_KEY;
if (!apiKey) {
  console.error('Không tìm thấy GROK_API_KEY trong môi trường');
  process.exit(1);
}

// Tạo dữ liệu request
const requestData = JSON.stringify({
  model: 'grok-1',
  messages: [
    { role: 'system', content: 'Bạn là Luna, một trợ lý AI.' },
    { role: 'user', content: 'Xin chào, tôi là ai?' }
  ],
  max_tokens: 100
});

// Cấu hình request
const options = {
  hostname: 'api.grok.ai',
  port: 443,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestData),
    'User-Agent': 'LunaBot-DirectTest/1.0'
  },
  // Cấu hình SSL
  rejectUnauthorized: false,
  checkServerIdentity: () => undefined,
  secureProtocol: 'TLSv1_2_method',
  ciphers: 'ALL',
  secureOptions: tls.SSL_OP_NO_SSLv2 | tls.SSL_OP_NO_SSLv3 | tls.SSL_OP_NO_TLSv1
};

console.log('Đang kết nối trực tiếp đến Grok API...');

// Thực hiện request
const req = https.request(options, (res) => {
  console.log(`Mã trạng thái: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  const chunks = [];
  res.on('data', (chunk) => {
    chunks.push(chunk);
  });
  
  res.on('end', () => {
    const body = Buffer.concat(chunks).toString();
    console.log('Phản hồi từ API:');
    try {
      const parsed = JSON.parse(body);
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.choices && parsed.choices.length > 0) {
        console.log('\nNội dung phản hồi:');
        console.log(parsed.choices[0].message.content);
      }
    } catch (e) {
      console.log('Không thể phân tích phản hồi JSON:', body);
    }
  });
});

req.on('error', (e) => {
  console.error('Lỗi khi gửi request:', e.message);
  console.error(e);
});

// Thêm debug cho SSL
req.on('socket', (socket) => {
  socket.on('secureConnect', () => {
    console.log('Kết nối SSL thành công!');
    console.log('Phiên bản TLS:', socket.getProtocol());
  });
});

// Gửi dữ liệu và kết thúc request
req.write(requestData);
req.end();

console.log('Đã gửi request. Đang chờ phản hồi...');
