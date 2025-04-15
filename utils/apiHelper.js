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

/**
 * Báo cáo trạng thái kết nối
 * @param {string} apiHost - Tên miền API
 * @returns {Promise<object>} - Thông tin về kết nối
 */
async function checkApiStatus(apiHost) {
  console.log(`Đang kiểm tra kết nối tới ${apiHost}...`);
  
  const dnsResult = await checkDns(apiHost);
  const canConnect = await checkConnection(apiHost, 443);
  
  return {
    host: apiHost,
    dnsResolved: !!dnsResult,
    ipAddresses: dnsResult || [],
    canConnect: canConnect,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  checkConnection,
  checkDns,
  checkApiStatus
};
