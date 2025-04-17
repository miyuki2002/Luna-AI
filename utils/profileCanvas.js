const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs').promises;

// Định nghĩa đường dẫn tới thư mục assets
const ASSETS_PATH = path.join(__dirname, '../assets');

class ProfileCanvas {
  constructor() {
    // Đăng ký fonts nếu có
    this.initializeFonts();
    
    // Các màu và gradient mặc định
    this.colors = {
      primary: {
        light: '#7F5AF0', // Tím sáng
        dark: '#4B23A8'   // Tím đậm
      },
      secondary: {
        light: '#00D1FF', // Xanh sáng
        dark: '#0089A8'   // Xanh đậm
      },
      background: {
        light: '#16161A', // Đen nhạt
        dark: '#0D0D0F'   // Đen đậm
      },
      text: {
        primary: '#FFFFFE', // Trắng
        secondary: '#94A1B2', // Xám nhạt
        accent: '#7F5AF0'    // Tím
      },
      accent: '#FF8906', // Cam
      success: '#2CB67D', // Xanh lá
      error: '#E53170'    // Đỏ hồng
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
        
        // Đăng ký fonts hiện đại
        registerFont(path.join(fontsPath, 'Montserrat-Regular.ttf'), { family: 'Montserrat' });
        registerFont(path.join(fontsPath, 'Montserrat-Bold.ttf'), { family: 'Montserrat', weight: 'bold' });
        registerFont(path.join(fontsPath, 'Montserrat-Medium.ttf'), { family: 'Montserrat', weight: '500' });
        
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
   * Tạo hiệu ứng bo góc cho hình chữ nhật
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {number} x - Tọa độ x
   * @param {number} y - Tọa độ y
   * @param {number} width - Chiều rộng
   * @param {number} height - Chiều cao
   * @param {number} radius - Bán kính bo góc
   */
  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  
  /**
   * Tạo hiệu ứng đổ bóng
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {Function} drawFunc - Hàm vẽ
   */
  withShadow(ctx, drawFunc) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;
    drawFunc();
    ctx.restore();
  }
  
  /**
   * Tạo gradient màu sắc
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {number} x - Tọa độ x bắt đầu
   * @param {number} y - Tọa độ y bắt đầu
   * @param {number} width - Chiều rộng
   * @param {number} height - Chiều cao
   * @param {string} color1 - Mã màu 1
   * @param {string} color2 - Mã màu 2
   * @returns {CanvasGradient} - Đối tượng gradient
   */
  createGradient(ctx, x, y, width, height, color1, color2) {
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
  }
  
  /**
   * Tạo profile card cho người dùng với thiết kế hiện đại
   * @param {Object} profileData - Dữ liệu profile của người dùng
   * @returns {Promise<Buffer>} - Buffer hình ảnh profile card
   */
  async createProfileCard(profileData) {
    try {
      // Tạo canvas với kích thước 900x420px (tỷ lệ hiện đại hơn)
      const canvas = createCanvas(900, 420);
      const ctx = canvas.getContext('2d');
      
      // Thiết lập font mặc định
      ctx.font = '16px "Montserrat", sans-serif';
      
      // Vẽ nền chính với hiệu ứng gradient
      const bgGradient = this.createGradient(
        ctx, 0, 0, 900, 420,
        this.colors.background.dark,
        this.colors.background.light
      );
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, 900, 420);
      
      // Vẽ các thành phần chính
      await this.drawMainProfileCard(ctx, profileData);
      
      // Trả về buffer hình ảnh
      return canvas.toBuffer('image/png');
    } catch (error) {
      console.error('Lỗi khi tạo profile card:', error);
      throw error;
    }
  }
  
  /**
   * Vẽ profile card chính
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {Object} profileData - Dữ liệu profile của người dùng
   */
  async drawMainProfileCard(ctx, profileData) {
    // Lấy dữ liệu tùy chỉnh của người dùng hoặc sử dụng giá trị mặc định
    const customColor = profileData.customization?.color;
    const primaryColor = customColor || this.colors.primary.light;
    
    // PHẦN 1: BANNER HEADER (30% chiều cao)
    await this.drawHeaderSection(ctx, profileData, primaryColor);
    
    // PHẦN 2: THÔNG TIN NGƯỜI DÙNG (bên trái)
    await this.drawUserInfoSection(ctx, profileData, primaryColor);
    
    // PHẦN 3: THÔNG TIN PROFILE (bên phải)
    await this.drawProfileInfoSection(ctx, profileData, primaryColor);
    
    // PHẦN 4: THANH XP
    await this.drawXPBar(ctx, profileData, primaryColor);
  }
  
  /**
   * Vẽ phần header
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {Object} profileData - Dữ liệu profile của người dùng
   * @param {string} primaryColor - Màu chủ đạo
   */
  async drawHeaderSection(ctx, profileData, primaryColor) {
    // Vẽ banner header
    try {
      // Nếu người dùng có banner tùy chỉnh
      let bannerImage;
      if (profileData.customization?.banner) {
        try {
          bannerImage = await loadImage(profileData.customization.banner);
        } catch (err) {
          console.warn('Không thể tải banner tùy chỉnh:', err);
        }
      }
      
      // Nếu không có banner tùy chỉnh, sử dụng gradient
      if (!bannerImage) {
        // Tạo gradient từ màu chính
        const gradient = this.createGradient(
          ctx, 0, 0, 900, 120,
          primaryColor,
          this.adjustColor(primaryColor, -30) // Tối hơn 30%
        );
        
        // Vẽ banner gradient với bo góc
        this.withShadow(ctx, () => {
          this.roundRect(ctx, 20, 20, 860, 120, 15);
          ctx.fillStyle = gradient;
          ctx.fill();
        });
        
        // Thêm hiệu ứng overlay
        ctx.globalAlpha = 0.1;
        for (let i = 0; i < 5; i++) {
          const size = 80 + Math.random() * 60;
          const x = Math.random() * 800;
          const y = Math.random() * 80 + 20;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        // Vẽ banner tùy chỉnh
        this.withShadow(ctx, () => {
          this.roundRect(ctx, 20, 20, 860, 120, 15);
          ctx.save();
          ctx.clip();
          ctx.drawImage(bannerImage, 20, 20, 860, 120);
          
          // Overlay để làm cho banner tối hơn
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(20, 20, 860, 120);
          ctx.restore();
        });
      }
      
      // Vẽ huy hiệu server rank nếu top 3
      if (profileData.rank?.server <= 3) {
        const rankBadgeSize = 60;
        const rankLabel = ['', '🥇 #1', '🥈 #2', '🥉 #3'][profileData.rank.server];
        
        // Vẽ huy hiệu rank
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(830, 60, rankBadgeSize / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Vẽ chữ rank
        ctx.font = 'bold 24px "Montserrat"';
        ctx.fillStyle = this.colors.text.primary;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rankLabel, 830, 60);
      }
      
      // Vẽ tiêu đề profile
      ctx.font = 'bold 28px "Montserrat"';
      ctx.fillStyle = this.colors.text.primary;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('USER PROFILE', 40, 60);
      
      // Vẽ tên server
      ctx.font = '16px "Montserrat"';
      ctx.fillStyle = this.colors.text.secondary;
      ctx.fillText(profileData.serverName || 'Discord Server', 40, 90);
      
    } catch (error) {
      console.error('Lỗi khi vẽ header:', error);
    }
  }
  
  /**
   * Vẽ phần thông tin người dùng
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {Object} profileData - Dữ liệu profile của người dùng
   * @param {string} primaryColor - Màu chủ đạo
   */
  async drawUserInfoSection(ctx, profileData, primaryColor) {
    try {
      // Vẽ card thông tin người dùng
      this.withShadow(ctx, () => {
        this.roundRect(ctx, 20, 100, 300, 280, 15);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fill();
      });
      
      // Tải avatar
      let avatarImage;
      try {
        avatarImage = await loadImage(profileData.avatarURL || path.join(ASSETS_PATH, 'luna-avatar.png'));
      } catch (err) {
        console.warn('Không thể tải avatar:', err);
      }
      
      // Vẽ vòng tròn avatar
      this.withShadow(ctx, () => {
        // Vẽ khung avatar
        ctx.beginPath();
        ctx.arc(170, 180, 60, 0, Math.PI * 2);
        ctx.fillStyle = this.createGradient(ctx, 110, 120, 120, 120, primaryColor, this.adjustColor(primaryColor, 20));
        ctx.fill();
        
        if (avatarImage) {
          // Vẽ avatar
          ctx.save();
          ctx.beginPath();
          ctx.arc(170, 180, 55, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatarImage, 115, 125, 110, 110);
          ctx.restore();
        }
      });
      
      // Vẽ wreath (vòng nguyệt quế) nếu có
      if (profileData.customization?.wreath) {
        try {
          const wreathImage = await this.loadImageWithCache(
            path.join(ASSETS_PATH, 'wreaths', `${profileData.customization.wreath}.png`)
          );
          ctx.drawImage(wreathImage, 100, 110, 140, 140);
        } catch (err) {
          console.warn('Không thể tải wreath:', err);
        }
      }
      
      // Vẽ tên người dùng
      ctx.font = 'bold 24px "Montserrat"';
      ctx.textAlign = 'center';
      ctx.fillStyle = this.colors.text.primary;
      ctx.fillText(
        profileData.username || 'User',
        170,
        260,
        280
      );
      
      // Vẽ discriminator nếu có
      if (profileData.discriminator && profileData.discriminator !== '0') {
        ctx.font = '16px "Montserrat"';
        ctx.fillStyle = this.colors.text.secondary;
        ctx.fillText(`#${profileData.discriminator}`, 170, 285);
      }
      
      // Vẽ các badge (huy hiệu)
      await this.drawBadges(ctx, profileData);
      
      // Vẽ level và xếp hạng
      this.drawCompactLevelInfo(ctx, profileData, primaryColor);
      
    } catch (error) {
      console.error('Lỗi khi vẽ thông tin người dùng:', error);
    }
  }
  
  /**
   * Vẽ phần thông tin profile
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {Object} profileData - Dữ liệu profile của người dùng
   * @param {string} primaryColor - Màu chủ đạo
   */
  async drawProfileInfoSection(ctx, profileData, primaryColor) {
    try {
      // Vẽ card thông tin profile
      this.withShadow(ctx, () => {
        this.roundRect(ctx, 340, 160, 540, 220, 15);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fill();
      });
      
      // Vẽ tiêu đề BIO
      ctx.font = 'bold 20px "Montserrat"';
      ctx.textAlign = 'left';
      ctx.fillStyle = primaryColor;
      ctx.fillText('BIO', 360, 190);
      
      // Vẽ bio card
      this.withShadow(ctx, () => {
        this.roundRect(ctx, 360, 200, 500, 60, 10);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fill();
      });
      
      // Vẽ nội dung bio
      ctx.font = '16px "Montserrat"';
      ctx.fillStyle = this.colors.text.primary;
      const bio = profileData.bio || 'No bio written.';
      
      // Cắt bio nếu quá dài
      if (bio.length > 70) {
        ctx.fillText(bio.substring(0, 67) + '...', 370, 235, 480);
      } else {
        ctx.fillText(bio, 370, 235, 480);
      }
      
      // Vẽ phần trên bên phải: Birthday + Network
      // Vẽ tiêu đề BIRTHDAY
      ctx.font = 'bold 20px "Montserrat"';
      ctx.fillStyle = primaryColor;
      ctx.fillText('BIRTHDAY', 360, 290);
      
      // Vẽ birthday card
      this.withShadow(ctx, () => {
        this.roundRect(ctx, 360, 300, 240, 50, 10);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fill();
      });
      
      // Vẽ nội dung birthday
      ctx.font = '16px "Montserrat"';
      ctx.fillStyle = this.colors.text.primary;
      ctx.fillText(
        profileData.birthday || 'Not specified',
        370,
        330,
        220
      );
      
      // Vẽ tiêu đề NETWORK
      ctx.font = 'bold 20px "Montserrat"';
      ctx.fillStyle = primaryColor;
      ctx.fillText('NETWORK', 620, 290);
      
      // Vẽ network card
      this.withShadow(ctx, () => {
        this.roundRect(ctx, 620, 300, 240, 50, 10);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fill();
      });
      
      // Vẽ các biểu tượng mạng xã hội
      const networkIcons = ['🌐', '💬', '🕹️', '📱'];
      const spacing = 50;
      
      for (let i = 0; i < networkIcons.length; i++) {
        ctx.font = '20px "Montserrat"';
        ctx.fillStyle = this.colors.text.primary;
        ctx.fillText(networkIcons[i], 650 + i * spacing, 330);
      }
      
      // Vẽ emblem nếu có
      if (profileData.customization?.emblem) {
        try {
          const emblemImage = await this.loadImageWithCache(
            path.join(ASSETS_PATH, 'emblems', `${profileData.customization.emblem}.png`)
          );
          ctx.drawImage(emblemImage, 800, 180, 60, 60);
        } catch (err) {
          console.warn('Không thể tải emblem:', err);
        }
      }
      
    } catch (error) {
      console.error('Lỗi khi vẽ thông tin profile:', error);
    }
  }
  
  /**
   * Vẽ thanh XP
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {Object} profileData - Dữ liệu profile của người dùng
   * @param {string} primaryColor - Màu chủ đạo
   */
  async drawXPBar(ctx, profileData, primaryColor) {
    try {
      // Tính toán XP
      const level = profileData.level || 1;
      const currXp = profileData.currentXP || 0;
      const maxXp = (50 * Math.pow(level, 2)) + (250 * level);
      const prevLevelXp = (50 * Math.pow(level - 1, 2)) + (250 * (level - 1));
      const levelRange = maxXp - prevLevelXp;
      const levelProgress = currXp - prevLevelXp;
      const percentComplete = Math.min(1, Math.max(0, levelProgress / levelRange));
      
      // Vẽ thanh XP
      const barWidth = 860;
      const barHeight = 15;
      const startX = 20;
      const startY = 390;
      
      // Vẽ nền thanh XP
      this.withShadow(ctx, () => {
        this.roundRect(ctx, startX, startY, barWidth, barHeight, barHeight / 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
      });
      
      // Vẽ phần đã hoàn thành
      if (percentComplete > 0) {
        const progressBarWidth = barWidth * percentComplete;
        this.roundRect(ctx, startX, startY, progressBarWidth, barHeight, barHeight / 2);
        
        // Tạo gradient cho thanh XP
        const gradient = this.createGradient(
          ctx, startX, startY, progressBarWidth, barHeight,
          primaryColor,
          this.adjustColor(primaryColor, 30) // Sáng hơn 30%
        );
        
        ctx.fillStyle = gradient;
        ctx.fill();
      }
      
      // Vẽ thông tin XP (text)
      ctx.font = 'bold 14px "Montserrat"';
      ctx.textAlign = 'left';
      ctx.fillStyle = this.colors.text.primary;
      ctx.fillText(`Level ${level}`, startX, startY - 10);
      
      ctx.textAlign = 'right';
      ctx.fillText(
        `${levelProgress}/${levelRange} XP (${Math.round(percentComplete * 100)}%)`,
        startX + barWidth,
        startY - 10
      );
      
    } catch (error) {
      console.error('Lỗi khi vẽ thanh XP:', error);
    }
  }
  
  /**
   * Vẽ thông tin level, rank dạng nhỏ gọn
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {Object} profileData - Dữ liệu profile của người dùng
   * @param {string} primaryColor - Màu chủ đạo
   */
  drawCompactLevelInfo(ctx, profileData, primaryColor) {
    // Xếp hạng server
    const serverRank = profileData.rank?.server || '?';
    const globalRank = profileData.rank?.global || '?';
    
    // Vẽ level
    this.withShadow(ctx, () => {
      this.roundRect(ctx, 40, 330, 80, 30, 15);
      ctx.fillStyle = this.createGradient(ctx, 40, 330, 80, 30, primaryColor, this.adjustColor(primaryColor, 30));
      ctx.fill();
    });
    
    ctx.font = 'bold 16px "Montserrat"';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.colors.text.primary;
    ctx.fillText(`LVL ${profileData.level || 1}`, 80, 350);
    
    // Vẽ server rank
    this.withShadow(ctx, () => {
      this.roundRect(ctx, 130, 330, 80, 30, 15);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
    });
    
    ctx.fillStyle = this.colors.text.primary;
    ctx.fillText(`#${serverRank}`, 170, 350);
    
    // Vẽ global rank
    this.withShadow(ctx, () => {
      this.roundRect(ctx, 220, 330, 80, 30, 15);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
    });
    
    ctx.fillStyle = this.colors.text.primary;
    ctx.fillText(`G#${globalRank}`, 260, 350);
  }
  
  /**
   * Vẽ các huy hiệu thành tựu
   * @param {CanvasRenderingContext2D} ctx - Context của canvas
   * @param {Object} profileData - Dữ liệu profile của người dùng
   */
  async drawBadges(ctx, profileData) {
    try {
      // Lấy badges từ dữ liệu nếu có
      const badges = profileData.badges || [];
      
      // Vị trí và kích thước badge
      const badgeSize = 30;
      const startX = 80;
      const startY = 300;
      const spacing = 40;
      
      // Số lượng badges tối đa hiển thị
      const maxBadges = 5;
      
      // Nếu có badges, vẽ từng badge
      for (let i = 0; i < Math.min(badges.length, maxBadges); i++) {
        const badge = badges[i];
        const x = startX + i * spacing;
        
        // Vẽ nền badge
        this.withShadow(ctx, () => {
          ctx.beginPath();
          ctx.arc(x, startY, badgeSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fill();
        });
        
        // Vẽ icon badge nếu có
        try {
          if (badge.icon) {
            const badgeIcon = await this.loadImageWithCache(badge.icon);
            ctx.drawImage(badgeIcon, x - badgeSize / 2, startY - badgeSize / 2, badgeSize, badgeSize);
          } else {
            // Nếu không có icon, vẽ emoji đại diện
            ctx.font = '16px "Montserrat"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = this.colors.text.primary;
            ctx.fillText(badge.emoji || '🏆', x, startY);
          }
        } catch (err) {
          console.warn('Không thể tải badge icon:', err);
          // Vẽ badge fallback
          ctx.font = '16px "Montserrat"';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = this.colors.text.primary;
          ctx.fillText('🏆', x, startY);
        }
      }
      
      // Nếu có nhiều badges hơn số tối đa
      if (badges.length > maxBadges) {
        const x = startX + maxBadges * spacing;
        
        // Vẽ nền badge
        this.withShadow(ctx, () => {
          ctx.beginPath();
          ctx.arc(x, startY, badgeSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fill();
        });
        
        // Vẽ số lượng badges còn lại
        ctx.font = 'bold 14px "Montserrat"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this.colors.text.primary;
        ctx.fillText(`+${badges.length - maxBadges}`, x, startY);
      }
      
    } catch (error) {
      console.error('Lỗi khi vẽ badges:', error);
    }
  }
  
  /**
   * Điều chỉnh màu sắc (tối/sáng hơn)
   * @param {string} color - Mã màu hex
   * @param {number} percent - Phần trăm điều chỉnh (-100 đến 100)
   * @returns {string} - Mã màu mới
   */
  adjustColor(color, percent) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = Math.round(R * (100 + percent) / 100);
    G = Math.round(G * (100 + percent) / 100);
    B = Math.round(B * (100 + percent) / 100);

    R = (R < 255) ? R : 255;
    G = (G < 255) ? G : 255;
    B = (B < 255) ? B : 255;

    R = (R > 0) ? R : 0;
    G = (G > 0) ? G : 0;
    B = (B > 0) ? B : 0;

    const RR = ((R.toString(16).length === 1) ? '0' + R.toString(16) : R.toString(16));
    const GG = ((G.toString(16).length === 1) ? '0' + G.toString(16) : G.toString(16));
    const BB = ((B.toString(16).length === 1) ? '0' + B.toString(16) : B.toString(16));

    return '#' + RR + GG + BB;
  }
}

// Tạo và xuất instance duy nhất
const profileCanvas = new ProfileCanvas();
module.exports = profileCanvas;
