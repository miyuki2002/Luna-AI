const EventEmitter = require('events');

class InitSystem extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
    this.services = {
      mongodb: false,
      greetingPatterns: false,
      commands: false,
      api: false,
      profiles: false,
      conversationHistory: false,
      guildProfiles: false  // Thêm service guildProfiles
    };
  }

  markReady(service) {
    if (!this.services.hasOwnProperty(service)) {
      console.warn(`Không nhận dạng được service: ${service}`);
      return;
    }
    
    this.services[service] = true;
    console.log(`✓ Service ${service} đã sẵn sàng`);
    
    // Kiểm tra xem tất cả services đã sẵn sàng chưa
    if (Object.values(this.services).every(status => status)) {
      this.initialized = true;
      console.log('🚀 Tất cả services đã sẵn sàng, hệ thống đang khởi động...');
      this.emit('ready');
    }
  }

  async waitForReady() {
    if (this.initialized) {
      return true;
    }
    
    return new Promise(resolve => {
      this.once('ready', () => {
        resolve(true);
      });
    });
  }

  getStatus() {
    return {
      initialized: this.initialized,
      services: {...this.services}
    };
  }
}

module.exports = new InitSystem();
