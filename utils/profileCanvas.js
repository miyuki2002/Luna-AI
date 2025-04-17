const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs').promises;

// Định nghĩa đường dẫn tới thư mục assets
const ASSETS_PATH = path.join(__dirname, '../assets');

class ProfileCanvas {
  constructor() {
    // Đăng ký fonts nếu có
    this.initializeFonts();
    
    // Các màu mặc định
    this.colors = {
      pink: '#FFB6C1',
      darkPink: '#FF69B4',
      white: '#FFFFFF',
      black: '#000000',
      gray: '#808080',
      purple: '#9370DB'
    };
    
    // Cache các hình ảnh thường dùng
    this.imageCache = {};
  }
  
  /**
   * Đăng ký fonts cho canvas
   */
  async initializeFonts() {
    try {
      const fontsPath = path.join(ASSETS_PATH, 'fonts');
      
      // Kiểm tra xem thư mục fonts có tồn tại không
      try {
        await fs.access(fontsPath);
        
        // Đăng ký fonts tùy chỉnh nếu có
        registerFont(path.join(fontsPath, 'Roboto-Regular.ttf'), { family: 'Roboto' });
        registerFont(path.join(fontsPath, 'Roboto-Bold.ttf'), { family: 'Roboto', weight: 'bold' });
        
        console.log('Đã đăng ký fonts thành công');
      } catch (err) {
        console.log('Thư mục fonts không tồn tại, sẽ sử dụng fonts mặc định');
      }
    } catch (error) {
      console.error('Lỗi khi đăng ký fonts:', error);
    }
  }
  
  /**
   * Tải hình ảnh từ đường dẫn hoặc sử dụng cache
   * @param {string} imagePath - Đường dẫn tới hình ảnh
   * @returns {Promise<Image>} - Đối tượng hình ảnh đã tải
   */
  async loadImageWithCache(imagePath) {
    try {
      if (this.imageCache[imagePath]) {
        return this.imageCache[imagePath];
      }
      
      const image = await loadImage(imagePath);
      this.imageCache[imagePath] = image;
      return image;
    } catch (error) {
      console.error(`Lỗi khi tải hình ảnh ${imagePath}:`, error);
      throw error;
    }
  }
  
  /**
   * Tạo profile card cho người dùng
   * @param {Object} profileData - Dữ liệu profile của người dùng
   * @returns {Promise<Buffer>} - Buffer hình ảnh profile card
   */
  async createProfileCard(profileData) {
    try {
      // Tạo canvas với kích thước 800x400px
      const canvas = createCanvas(800, 400);
      const ctx = canvas.getContext('2d');
      
      // Vẽ nền
      await this.drawBackground(ctx, profileData.customization);
      
      // Vẽ khung bên trái (thông tin người dùng)
      await this.drawLeftPanel(ctx, profileData);
      
      // Vẽ khung bên phải (thông tin chi tiết)
      await this.drawRightPanel(ctx, profileData);
      
      // Trả về buffer hình ảnh
      return canvas.toBuffer('image/png');
    } catch (error) {
      console.error('Lỗi khi tạo profile card:', error);
      throw error;
    }
  }
  
  /**
   * Vẽ nền cho profile card
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {Object} customization - Tùy chỉnh profile của người dùng
   */
  async drawBackground(ctx, customization) {
    try {
      // Vẽ hình nền mặc định màu hồng
      ctx.fillStyle = customization.color || this.colors.pink;
      ctx.fillRect(0, 0, 800, 400);
      
      // Nếu có pattern, vẽ pattern
      if (customization.pattern) {
        try {
          const patternPath = path.join(ASSETS_PATH, 'patterns', `${customization.pattern}.png`);
          const patternImage = await this.loadImageWithCache(patternPath);
          
          // Tạo pattern và vẽ lên nền
          const pattern = ctx.createPattern(patternImage, 'repeat');
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, 800, 400);
        } catch (err) {
          console.warn('Không tìm thấy pattern:', err);
        }
      } else {
        // Pattern mặc định với thỏ và sao
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '24px "Roboto"';
        
        // Vẽ hoa văn đơn giản (sao và emoji thỏ)
        const stars = ['★', '☆', '✩', '✧'];
        const bunny = '🐰';
        for (let i = 0; i < 20; i++) {
          const x = Math.random() * 350;
          const y = Math.random() * 400;
          const symbol = i % 5 === 0 ? bunny : stars[i % stars.length];
          ctx.fillText(symbol, x, y);
        }
      }
      
      // Vẽ đường phân cách giữa hai panel
      ctx.fillStyle = this.colors.white;
      ctx.fillRect(320, 0, 5, 400);
      
      // Vẽ khung tiêu đề "TIP" ở góc trên bên phải
      ctx.fillStyle = this.colors.pink;
      ctx.fillRect(575, 0, 225, 75);
      
      ctx.fillStyle = this.colors.white;
      ctx.font = 'bold 35px "Roboto"';
      ctx.textAlign = 'center';
      ctx.fillText('TIP', 650, 45);
      
      ctx.font = 'bold 40px "Roboto"';
      ctx.fillText('1', 760, 45);
      
    } catch (error) {
      console.error('Lỗi khi vẽ nền:', error);
      throw error;
    }
  }
  
  /**
   * Vẽ panel bên trái (thông tin người dùng)
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {Object} profileData - Dữ liệu profile của người dùng
   */
  async drawLeftPanel(ctx, profileData) {
    try {
      // Vẽ khung hình đại diện
      ctx.beginPath();
      ctx.arc(160, 150, 80, 0, Math.PI * 2);
      ctx.fillStyle = this.colors.white;
      ctx.fill();
      ctx.closePath();
      
      // Vẽ hình đại diện người dùng
      try {
        // Thử tải avatar của user (đây chỉ là ví dụ, bạn cần thay thế đường dẫn)
        const avatarPath = path.join(ASSETS_PATH, 'avatars', `${profileData.userId}.png`);
        const avatar = await this.loadImageWithCache(avatarPath);
        
        // Vẽ avatar trong khung tròn
        ctx.save();
        ctx.beginPath();
        ctx.arc(160, 150, 75, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, 85, 75, 150, 150);
        ctx.restore();
      } catch (err) {
        // Nếu không có avatar, vẽ chữ cái đầu tiên của tên
        ctx.font = 'bold 60px "Roboto"';
        ctx.fillStyle = this.colors.pink;
        ctx.textAlign = 'center';
        ctx.fillText(
          (profileData.username || 'U').charAt(0).toUpperCase(), 
          160, 
          170
        );
      }
      
      // Vẽ vòng nguyệt quế nếu có
      if (profileData.customization.wreath) {
        try {
          const wreathPath = path.join(ASSETS_PATH, 'wreaths', `${profileData.customization.wreath}.png`);
          const wreath = await this.loadImageWithCache(wreathPath);
          ctx.drawImage(wreath, 70, 60, 180, 180);
        } catch (err) {
          console.warn('Không tìm thấy wreath:', err);
        }
      }
      
      // Vẽ tên người dùng
      ctx.font = 'bold 32px "Roboto"';
      ctx.fillStyle = this.colors.white;
      ctx.textAlign = 'center';
      ctx.fillText(profileData.username || 'User', 160, 270);
      
      // Vẽ tag discriminator
      ctx.font = '18px "Roboto"';
      ctx.fillText(`#${profileData.discriminator || '0000'}`, 160, 295);
      
      // Vẽ các huy hiệu thành tựu
      this.drawBadges(ctx, profileData);
      
      // Vẽ thông tin cấp độ
      this.drawLevelInfo(ctx, profileData);
    } catch (error) {
      console.error('Lỗi khi vẽ panel bên trái:', error);
      throw error;
    }
  }
  
  /**
   * Vẽ panel bên phải (thông tin chi tiết)
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {Object} profileData - Dữ liệu profile của người dùng
   */
  async drawRightPanel(ctx, profileData) {
    try {
      const startX = 340;
      let currentY = 120;
      
      // Vẽ tiêu đề BIO
      ctx.font = 'bold 24px "Roboto"';
      ctx.fillStyle = this.colors.white;
      ctx.textAlign = 'left';
      ctx.fillText('BIO', startX, currentY);
      
      // Vẽ khung bio
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(startX, currentY + 10, 440, 60);
      
      // Vẽ nội dung bio
      ctx.font = '18px "Roboto"';
      ctx.fillStyle = this.colors.white;
      const bio = profileData.bio || 'No bio written.';
      
      // Cắt bio nếu quá dài
      if (bio.length > 60) {
        ctx.fillText(bio.substring(0, 57) + '...', startX + 10, currentY + 45);
      } else {
        ctx.fillText(bio, startX + 10, currentY + 45);
      }
      
      // Cập nhật vị trí Y
      currentY += 100;
      
      // Vẽ tiêu đề BIRTHDAY
      ctx.font = 'bold 24px "Roboto"';
      ctx.fillText('BIRTHDAY', startX, currentY);
      
      // Vẽ khung birthday
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(startX, currentY + 10, 210, 40);
      
      // Vẽ nội dung birthday
      ctx.font = '18px "Roboto"';
      ctx.fillStyle = this.colors.white;
      ctx.fillText(
        profileData.birthday || 'Not specified', 
        startX + 10, 
        currentY + 35
      );
      
      // Cập nhật vị trí Y
      currentY += 80;
      
      // Vẽ tiêu đề BALANCE
      ctx.font = 'bold 24px "Roboto"';
      ctx.fillText('BALANCE', startX, currentY);
      
      // Vẽ khung wallet
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(startX, currentY + 10, 210, 40);
      
      // Vẽ icon wallet
      ctx.font = '18px "Roboto"';
      ctx.fillStyle = this.colors.white;
      ctx.fillText('💰:', startX + 10, currentY + 35);
      
      // Vẽ số tiền wallet
      ctx.textAlign = 'right';
      ctx.fillText(
        profileData.economy.wallet.toLocaleString(), 
        startX + 200, 
        currentY + 35
      );
      
      // Vẽ khung bank
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(startX + 230, currentY + 10, 210, 40);
      
      // Vẽ icon bank
      ctx.textAlign = 'left';
      ctx.fillText('🏦:', startX + 240, currentY + 35);
      
      // Vẽ số tiền bank
      ctx.textAlign = 'right';
      ctx.fillText(
        profileData.economy.bank.toLocaleString(), 
        startX + 430, 
        currentY + 35
      );
      
      // Vẽ biểu tượng ở góc phải dưới
      if (profileData.customization.emblem) {
        try {
          const emblemPath = path.join(ASSETS_PATH, 'emblems', `${profileData.customization.emblem}.png`);
          const emblem = await this.loadImageWithCache(emblemPath);
          ctx.drawImage(emblem, 660, 290, 100, 100);
        } catch (err) {
          console.warn('Không tìm thấy emblem:', err);
        }
      }
    } catch (error) {
      console.error('Lỗi khi vẽ panel bên phải:', error);
      throw error;
    }
  }
  
  /**
   * Vẽ các huy hiệu thành tựu
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {Object} profileData - Dữ liệu profile của người dùng
   */
  drawBadges(ctx, profileData) {
    const badges = [
      { x: 60, y: 350 },
      { x: 120, y: 350 },
      { x: 180, y: 350 },
      { x: 240, y: 350 }
    ];
    
    // Vẽ nền cho các huy hiệu
    badges.forEach(badge => {
      ctx.beginPath();
      ctx.arc(badge.x, badge.y, 25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
      ctx.closePath();
    });
    
    // Ở đây sẽ vẽ các huy hiệu thật sự nếu người dùng có
    // Ví dụ:
    // if (profileData.badges && profileData.badges.length > 0) {
    //   profileData.badges.forEach((badge, index) => {
    //     if (index < badges.length) {
    //       // Vẽ badge
    //     }
    //   });
    // }
  }
  
  /**
   * Vẽ thông tin cấp độ
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {Object} profileData - Dữ liệu profile của người dùng
   */
  drawLevelInfo(ctx, profileData) {
    // Vẽ vòng tròn cấp độ
    ctx.beginPath();
    ctx.arc(60, 450, 40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
    ctx.closePath();
    
    // Vẽ chữ LVL
    ctx.font = 'bold 16px "Roboto"';
    ctx.fillStyle = this.colors.pink;
    ctx.textAlign = 'center';
    ctx.fillText('LVL', 60, 440);
    
    // Vẽ số cấp độ
    ctx.font = 'bold 24px "Roboto"';
    ctx.fillText(profileData.level.toString(), 60, 470);
    
    // Vẽ xếp hạng máy chủ
    ctx.beginPath();
    ctx.arc(160, 450, 40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
    ctx.closePath();
    
    // Vẽ thứ hạng
    let serverRank = profileData.rank?.server || 'N/A';
    if (Number.isInteger(serverRank)) {
      if (serverRank === 1) serverRank = '1st';
      else if (serverRank === 2) serverRank = '2nd';
      else if (serverRank === 3) serverRank = '3rd';
      else serverRank = `${serverRank}th`;
    }
    
    ctx.font = 'bold 16px "Roboto"';
    ctx.fillText(serverRank, 160, 450);
    ctx.font = '12px "Roboto"';
    ctx.fillText('SERVER', 160, 470);
    
    // Vẽ xếp hạng toàn cầu
    ctx.beginPath();
    ctx.arc(260, 450, 40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
    ctx.closePath();
    
    // Vẽ thứ hạng toàn cầu
    let globalRank = profileData.rank?.global || 'N/A';
    if (Number.isInteger(globalRank)) {
      if (globalRank === 1) globalRank = '1st';
      else if (globalRank === 2) globalRank = '2nd';
      else if (globalRank === 3) globalRank = '3rd';
      else globalRank = `${globalRank}th`;
    }
    
    ctx.font = 'bold 16px "Roboto"';
    ctx.fillText(globalRank, 260, 450);
    ctx.font = '12px "Roboto"';
    ctx.fillText('GLOBAL', 260, 470);
  }
}

// Tạo và xuất instance duy nhất
const profileCanvas = new ProfileCanvas();
module.exports = profileCanvas;
