/**
 * Tiện ích hỗ trợ xử lý API và kết nối
 */
const https = require('https');
const dns = require('dns');

/**
 * Kiểm tra kết nối đến một máy chủ
 * @param {string} hostname - Tên miền cần kiểm tra
 * @param {number} port - Cổng kết nối
 * @returns {Promise<boolean>} - Trả về true nếu kết nối thành công
 */
async function checkConnection(hostname, port) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname,
      port,
      path: '/',
      method: 'HEAD',
      timeout: 5000,
      rejectUnauthorized: false,
    }, (res) => {
      resolve(true);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

/**
 * Kiểm tra phân giải DNS
 * @param {string} hostname - Tên miền cần kiểm tra 
 * @returns {Promise<string[]|null>} - Trả về danh sách IP hoặc null nếu không phân giải được
 */
async function checkDns(hostname) {
  return new Promise((resolve) => {
    dns.resolve(hostname, (err, addresses) => {
      if (err) {
        resolve(null);
      } else {
        resolve(addresses);
      }
    });
  });
}

module.exports = {
  checkConnection,
  checkDns
};
