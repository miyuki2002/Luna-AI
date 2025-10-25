const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs').promises;
const fontManager = require('../fonts/fonts');
const stringUtils = require('../../utils/string');
const logger = require('../../utils/logger.js');

// Định nghĩa đường dẫn tới thư mục assets
const ASSETS_PATH = path.join(__dirname, '../../assets');

class ProfileCanvas {
  constructor() {
    this.initializeFonts();
    this.colors = this.getColorPalette();
    this.imageCache = new Map();
    this.gradientCache = new Map();
    this.defaultConfig = {
      width: 900,
      height: 420,
      cornerRadius: 20,
      shadowBlur: 15,
      shadowOffset: { x: 0, y: 5 }
    };
  }

  /**
   * Khởi tạo fonts với error handling
   */
  async initializeFonts() {
    try {
      await fontManager.initialize(ASSETS_PATH);
      logger.info('PROFILE_CANVAS', 'Fonts initialized successfully');
    } catch (error) {
      logger.error('PROFILE_CANVAS', 'Font initialization failed:', error);
    }
  }

  /**
   * Lấy bảng màu tối ưu
   * @returns {Object} Color palette
   */
  getColorPalette() {
    return {
      primary: { light: '#7F5AF0', dark: '#4B23A8' },
      secondary: { light: '#00D1FF', dark: '#0089A8' },
      background: { light: '#1A1A25', dark: '#0D0D1A' },
      text: { primary: '#FFFFFE', secondary: '#B8C0D0', accent: '#7F5AF0' },
      accent: '#FF8906',
      success: '#2CB67D',
      error: '#E53170'
    };
  }

  /**
   * Tải hình ảnh với cache và error handling
   * @param {string} imagePath - Đường dẫn hình ảnh
   * @returns {Promise<Image>} Hình ảnh đã tải
   */
  async loadImageWithCache(imagePath) {
    if (this.imageCache.has(imagePath)) {
      return this.imageCache.get(imagePath);
    }

    try {
      const image = await loadImage(imagePath);
      this.imageCache.set(imagePath, image);
      return image;
    } catch (error) {
      logger.warn('PROFILE_CANVAS', `Không thể tải hình ảnh ${path.basename(imagePath)}:`, error.message);
      
      // Fallback to default avatar
      const fallbackPath = path.join(ASSETS_PATH, 'luna-avatar.png');
      if (imagePath !== fallbackPath) {
        return this.loadImageWithCache(fallbackPath);
      }
      throw error;
    }
  }

  /**
   * Tạo gradient với cache
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} config - Cấu hình gradient
   * @returns {CanvasGradient} Gradient object
   */
  createCachedGradient(ctx, config) {
    const key = JSON.stringify(config);
    
    if (this.gradientCache.has(key)) {
      return this.gradientCache.get(key);
    }

    const { x, y, width, height, color1, color2, type = 'linear' } = config;
    
    let gradient;
    if (type === 'radial') {
      gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(width, height) / 2);
    } else {
      gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    }
    
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    
    this.gradientCache.set(key, gradient);
    return gradient;
  }

  /**
   * Vẽ hình chữ nhật bo góc tối ưu
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Tọa độ x
   * @param {number} y - Tọa độ y
   * @param {number} width - Chiều rộng
   * @param {number} height - Chiều cao
   * @param {number} radius - Bán kính bo góc
   */
  drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  /**
   * Áp dụng hiệu ứng đổ bóng
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Function} drawFunction - Hàm vẽ
   * @param {Object} shadowConfig - Cấu hình đổ bóng
   */
  applyShadow(ctx, drawFunction, shadowConfig = {}) {
    const {
      color = 'rgba(0, 0, 0, 0.4)',
      blur = this.defaultConfig.shadowBlur,
      offsetX = this.defaultConfig.shadowOffset.x,
      offsetY = this.defaultConfig.shadowOffset.y
    } = shadowConfig;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = offsetX;
    ctx.shadowOffsetY = offsetY;
    drawFunction();
    ctx.restore();
  }

  /**
   * Thiết lập font với fallback
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} weight - Font weight
   * @param {number} size - Font size
   * @param {string} style - Font style
   */
  setFont(ctx, weight = 'Regular', size = 16, style = 'normal') {
    ctx.font = fontManager.getFontString(weight, size, style);
  }

  /**
   * Tạo profile card chính - entry point
   * @param {Object} profileData - Dữ liệu profile
   * @returns {Promise<Buffer>} Buffer hình ảnh
   */
  async createProfileCard(profileData) {
    try {
      const canvas = createCanvas(this.defaultConfig.width, this.defaultConfig.height);
      const ctx = canvas.getContext('2d');

      // Thiết lập font mặc định
      this.setFont(ctx);

      // Vẽ các thành phần theo thứ tự tối ưu
      await this.renderBackground(ctx);
      await this.renderUserSection(ctx, profileData);
      await this.renderProfileSection(ctx, profileData);
      await this.renderXPSection(ctx, profileData);

      return canvas.toBuffer('image/png');
    } catch (error) {
      logger.error('PROFILE_CANVAS', 'Lỗi khi tạo profile card:', error);
      throw error;
    }
  }

  /**
   * Vẽ nền canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  async renderBackground(ctx) {
    const { width, height } = this.defaultConfig;

    // Gradient nền chính
    const bgGradient = this.createCachedGradient(ctx, {
      x: 0, y: 0, width, height,
      color1: this.colors.background.dark,
      color2: this.colors.background.light
    });
    
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Banner overlay nếu có
    try {
      const bannerImage = await this.loadImageWithCache(path.join(ASSETS_PATH, 'luna-banner.png'));
      ctx.globalAlpha = 0.8;
      ctx.drawImage(bannerImage, 0, 0, width, height);
      ctx.globalAlpha = 1.0;

      // Overlay để tăng độ tương phản
      const overlay = this.createCachedGradient(ctx, {
        x: 0, y: 0, width, height,
        color1: 'rgba(10, 10, 25, 0.7)',
        color2: 'rgba(10, 10, 25, 0.9)'
      });
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, width, height);
    } catch (error) {
      logger.warn('PROFILE_CANVAS', 'Không thể tải banner, sử dụng nền mặc định');
    }
  }

  /**
   * Vẽ phần thông tin người dùng (bên trái)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} profileData - Dữ liệu profile
   */
  async renderUserSection(ctx, profileData) {
    const primaryColor = profileData.customization?.color || this.colors.primary.light;
    const cardBounds = { x: 30, y: 50, width: 300, height: 320 };

    // Vẽ card container
    this.applyShadow(ctx, () => {
      this.drawRoundRect(ctx, cardBounds.x, cardBounds.y, cardBounds.width, cardBounds.height, 20);
      
      const glassEffect = this.createCachedGradient(ctx, {
        x: cardBounds.x, y: cardBounds.y, width: cardBounds.width, height: cardBounds.height,
        color1: 'rgba(255, 255, 255, 0.1)',
        color2: 'rgba(255, 255, 255, 0.05)'
      });
      ctx.fillStyle = glassEffect;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Header
    this.setFont(ctx, 'Bold', 24);
    ctx.fillStyle = this.colors.text.primary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('USER PROFILE', 180, 80);

    // Server name
    const serverName = stringUtils.normalizeText(profileData.serverName) || 'Discord Server';
    this.setFont(ctx, 'Regular', 16);
    ctx.fillStyle = this.colors.text.secondary;
    ctx.fillText(serverName, 180, 110);

    // Avatar
    await this.renderAvatar(ctx, profileData, primaryColor);

    // Username
    this.setFont(ctx, 'Bold', 24);
    ctx.fillStyle = this.colors.text.primary;
    ctx.fillText(profileData.username || 'User', 180, 260, 280);

    // Discriminator
    if (profileData.discriminator && profileData.discriminator !== '0') {
      this.setFont(ctx, 'Regular', 16);
      ctx.fillStyle = this.colors.text.secondary;
      ctx.fillText(`#${profileData.discriminator}`, 180, 285);
    }

    // Level info compact
    this.renderLevelInfo(ctx, profileData, primaryColor);
  }

  /**
   * Vẽ avatar với hiệu ứng
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} profileData - Dữ liệu profile
   * @param {string} primaryColor - Màu chủ đạo
   */
  async renderAvatar(ctx, profileData, primaryColor) {
    const avatarCenter = { x: 180, y: 180 };
    const avatarRadius = 60;

    // Vẽ khung avatar với gradient
    this.applyShadow(ctx, () => {
      ctx.beginPath();
      ctx.arc(avatarCenter.x, avatarCenter.y, avatarRadius, 0, Math.PI * 2);
      
      const avatarGlow = this.createCachedGradient(ctx, {
        x: avatarCenter.x - avatarRadius, y: avatarCenter.y - avatarRadius,
        width: avatarRadius * 2, height: avatarRadius * 2,
        color1: primaryColor,
        color2: this.adjustColor(primaryColor, 30),
        type: 'radial'
      });
      ctx.fillStyle = avatarGlow;
      ctx.fill();
    });

    // Vẽ avatar image
    try {
      const avatarImage = await this.loadImageWithCache(
        profileData.avatarURL || path.join(ASSETS_PATH, 'luna-avatar.png')
      );
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCenter.x, avatarCenter.y, avatarRadius - 5, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        avatarImage,
        avatarCenter.x - avatarRadius + 5,
        avatarCenter.y - avatarRadius + 5,
        (avatarRadius - 5) * 2,
        (avatarRadius - 5) * 2
      );
      ctx.restore();
    } catch (error) {
      logger.warn('PROFILE_CANVAS', 'Không thể vẽ avatar:', error.message);
    }
  }

  /**
   * Vẽ thông tin level compact
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} profileData - Dữ liệu profile
   * @param {string} primaryColor - Màu chủ đạo
   */
  renderLevelInfo(ctx, profileData, primaryColor) {
    const y = 330;
    const buttonHeight = 30;
    const buttonRadius = 15;

    // Level button
    this.applyShadow(ctx, () => {
      this.drawRoundRect(ctx, 55, y, 80, buttonHeight, buttonRadius);
      const levelGradient = this.createCachedGradient(ctx, {
        x: 55, y, width: 80, height: buttonHeight,
        color1: primaryColor,
        color2: this.adjustColor(primaryColor, 30)
      });
      ctx.fillStyle = levelGradient;
      ctx.fill();
    });

    this.setFont(ctx, 'Bold', 16);
    ctx.fillStyle = this.colors.text.primary;
    ctx.textAlign = 'center';
    ctx.fillText(`LVL ${profileData.level || 1}`, 95, y + 15);

    // Server rank
    this.applyShadow(ctx, () => {
      this.drawRoundRect(ctx, 145, y, 80, buttonHeight, buttonRadius);
      ctx.fillStyle = 'rgba(10, 10, 30, 0.6)';
      ctx.fill();
    });

    ctx.fillStyle = this.colors.text.primary;
    ctx.fillText(`#${profileData.rank?.server || '?'}`, 185, y + 15);

    // Global rank
    this.applyShadow(ctx, () => {
      this.drawRoundRect(ctx, 235, y, 80, buttonHeight, buttonRadius);
      ctx.fillStyle = 'rgba(10, 10, 30, 0.6)';
      ctx.fill();
    });

    ctx.fillStyle = this.colors.text.primary;
    ctx.fillText(`G#${profileData.rank?.global || '?'}`, 275, y + 15);
  }

  /**
   * Vẽ phần thông tin profile (bên phải)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} profileData - Dữ liệu profile
   */
  async renderProfileSection(ctx, profileData) {
    const primaryColor = profileData.customization?.color || this.colors.primary.light;
    const cardBounds = { x: 360, y: 50, width: 510, height: 320 };

    // Profile card container
    this.applyShadow(ctx, () => {
      this.drawRoundRect(ctx, cardBounds.x, cardBounds.y, cardBounds.width, cardBounds.height, 20);
      
      const glassEffect = this.createCachedGradient(ctx, {
        x: cardBounds.x, y: cardBounds.y, width: cardBounds.width, height: cardBounds.height,
        color1: 'rgba(255, 255, 255, 0.08)',
        color2: 'rgba(255, 255, 255, 0.04)'
      });
      ctx.fillStyle = glassEffect;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Top rank badge nếu có
    if (profileData.rank?.server <= 3) {
      const rankLabels = ['', '🥇 TOP #1', '🥈 TOP #2', '🥉 TOP #3'];
      const rankLabel = rankLabels[profileData.rank.server] || '';
      
      this.setFont(ctx, 'Bold', 24);
      ctx.fillStyle = this.colors.text.primary;
      ctx.textAlign = 'right';
      ctx.fillText(rankLabel, 850, 80);
    }

    // Bio section
    this.setFont(ctx, 'Bold', 20);
    ctx.textAlign = 'left';
    ctx.fillStyle = primaryColor;
    ctx.fillText('BIO', 380, 120);

    // Bio content
    this.applyShadow(ctx, () => {
      this.drawRoundRect(ctx, 380, 130, 470, 60, 10);
      ctx.fillStyle = 'rgba(10, 10, 30, 0.4)';
      ctx.fill();
    });

    this.setFont(ctx, 'Regular', 16);
    ctx.fillStyle = this.colors.text.primary;
    const bio = profileData.bio || 'No bio written.';
    this.wrapText(ctx, bio, 400, 155, 430, 20);
  }

  /**
   * Vẽ phần XP bar
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} profileData - Dữ liệu profile
   */
  async renderXPSection(ctx, profileData) {
    // XP bar implementation sẽ được thêm vào đây
    // Tạm thời để trống để tối ưu performance
  }

  /**
   * Wrap text trong giới hạn width
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} text - Text cần wrap
   * @param {number} x - Tọa độ x
   * @param {number} y - Tọa độ y
   * @param {number} maxWidth - Chiều rộng tối đa
   * @param {number} lineHeight - Chiều cao dòng
   */
  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  }

  /**
   * Điều chỉnh màu sắc
   * @param {string} color - Màu gốc
   * @param {number} amount - Mức độ điều chỉnh
   * @returns {string} Màu đã điều chỉnh
   */
  adjustColor(color, amount) {
    const usePound = color[0] === '#';
    const col = usePound ? color.slice(1) : color;
    const num = parseInt(col, 16);
    
    let r = (num >> 16) + amount;
    let g = (num >> 8 & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;
    
    r = r > 255 ? 255 : r < 0 ? 0 : r;
    g = g > 255 ? 255 : g < 0 ? 0 : g;
    b = b > 255 ? 255 : b < 0 ? 0 : b;
    
    return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
  }

  /**
   * Dọn dẹp cache
   */
  clearCache() {
    this.imageCache.clear();
    this.gradientCache.clear();
  }

  /**
   * Lấy thống kê cache
   * @returns {Object} Thống kê cache
   */
  getCacheStats() {
    return {
      images: this.imageCache.size,
      gradients: this.gradientCache.size,
      fontStats: fontManager.getStats()
    };
  }
}

// Export singleton instance
module.exports = new ProfileCanvas();
