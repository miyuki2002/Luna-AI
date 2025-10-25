const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');
const fontManager = require('../fonts/fonts');
const logger = require('../../utils/logger.js');

const ASSETS_PATH = path.join(__dirname, '../../assets');

class AchievementCanvas {
  constructor() {
    this.initializeFonts();
    this.imageCache = new Map();
    this.colors = this.getColorPalette();
  }

  async initializeFonts() {
    try {
      await fontManager.initialize(ASSETS_PATH);
      logger.info('ACHIEVEMENT', 'Fonts initialized successfully');
    } catch (error) {
      logger.error('ACHIEVEMENT', 'Font initialization failed:', error);
    }
  }

  /**
   * Lấy bảng màu cho achievements
   * @returns {Object} Color palette
   */
  getColorPalette() {
    return {
      primary: '#8B5CF6',
      accent: '#C4B5FD',
      dark: '#1E1B4B',
      light: '#FFFFFF',
      background: {
        start: '#2E1065',
        end: '#4C1D95'
      },
      card: {
        start: '#F5F3FF',
        end: '#DDD6FE'
      },
      glow: {
        inner: 'rgba(167, 139, 250, 0.3)',
        middle: 'rgba(139, 92, 246, 0.1)',
        outer: 'rgba(124, 58, 237, 0)'
      }
    };
  }

  /**
   * Tải hình ảnh với cache
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
      logger.warn('ACHIEVEMENT', `Không thể tải hình ảnh achievement ${path.basename(imagePath)}:`, error.message);
      
      // Fallback to default icon
      const fallbackPath = path.join(ASSETS_PATH, 'luna-avatar.png');
      if (imagePath !== fallbackPath) {
        return this.loadImageWithCache(fallbackPath);
      }
      throw error;
    }
  }

  /**
   * Vẽ hình chữ nhật bo góc
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
      color = 'rgba(0, 0, 0, 0.5)',
      blur = 15,
      offsetX = 0,
      offsetY = 5
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
   * Tạo gradient
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Tọa độ x
   * @param {number} y - Tọa độ y
   * @param {number} width - Chiều rộng
   * @param {number} height - Chiều cao
   * @param {string} color1 - Màu bắt đầu
   * @param {string} color2 - Màu kết thúc
   * @returns {CanvasGradient} Gradient object
   */
  createGradient(ctx, x, y, width, height, color1, color2) {
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
  }

  /**
   * Thiết lập font
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} weight - Font weight
   * @param {number} size - Font size
   * @param {string} style - Font style
   */
  setFont(ctx, weight = 'Regular', size = 16, style = 'normal') {
    ctx.font = fontManager.getFontString(weight, size, style);
  }

  /**
   * Vẽ nền achievement
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} width - Chiều rộng canvas
   * @param {number} height - Chiều cao canvas
   */
  renderBackground(ctx, width, height) {
    // Gradient nền chính
    const bgGradient = this.createGradient(
      ctx, 0, 0, width, height,
      this.colors.background.start,
      this.colors.background.end
    );
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Vẽ các hình học mờ cho nền
    ctx.save();
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 5; i++) {
      const size = Math.random() * 150 + 50;
      const x = Math.random() * width;
      const y = Math.random() * height;
      
      ctx.beginPath();
      if (Math.random() > 0.5) {
        // Vẽ kim cương
        ctx.moveTo(x, y);
        ctx.lineTo(x + size, y - size/2);
        ctx.lineTo(x + size*1.5, y);
        ctx.lineTo(x + size, y + size/2);
      } else {
        // Vẽ hình tròn
        ctx.arc(x, y, size/2, 0, Math.PI * 2);
      }
      ctx.fillStyle = this.colors.accent;
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Vẽ card chính
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} cardX - Tọa độ x card
   * @param {number} cardY - Tọa độ y card
   * @param {number} cardW - Chiều rộng card
   * @param {number} cardH - Chiều cao card
   */
  renderMainCard(ctx, cardX, cardY, cardW, cardH) {
    // Vẽ card với hiệu ứng trong suốt
    ctx.save();
    ctx.globalAlpha = 0.15;
    this.drawRoundRect(ctx, cardX, cardY, cardW, cardH, 20);
    
    const cardGradient = this.createGradient(
      ctx, cardX, cardY, cardW, cardH,
      this.colors.card.start,
      this.colors.card.end
    );
    ctx.fillStyle = cardGradient;
    ctx.fill();
    ctx.restore();

    // Vẽ viền card với gradient
    this.drawRoundRect(ctx, cardX, cardY, cardW, cardH, 20);
    ctx.strokeStyle = this.createGradient(
      ctx, cardX, cardY, cardW, cardH,
      '#A78BFA',
      '#7C3AED'
    );
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Vẽ icon achievement
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} iconX - Tọa độ x icon
   * @param {number} iconY - Tọa độ y icon
   * @param {number} iconSize - Kích thước icon
   */
  async renderIcon(ctx, iconX, iconY, iconSize) {
    try {
      // Tìm icon phù hợp
      let iconPath = path.join(ASSETS_PATH, 'xp-icon.png');
      if (!fs.existsSync(iconPath)) {
        iconPath = path.join(ASSETS_PATH, 'luna-avatar.png');
      }
      
      const icon = await this.loadImageWithCache(iconPath);

      // Hiệu ứng hào quang cho icon
      const glowGradient = ctx.createRadialGradient(
        iconX, iconY, iconSize/4,
        iconX, iconY, iconSize
      );
      glowGradient.addColorStop(0, this.colors.glow.inner);
      glowGradient.addColorStop(0.5, this.colors.glow.middle);
      glowGradient.addColorStop(1, this.colors.glow.outer);
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(iconX, iconY, iconSize, 0, Math.PI * 2);
      ctx.fillStyle = glowGradient;
      ctx.fill();
      ctx.restore();

      // Vẽ icon với clip path tròn
      ctx.save();
      ctx.beginPath();
      ctx.arc(iconX, iconY, iconSize/2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(icon, iconX - iconSize/2, iconY - iconSize/2, iconSize, iconSize);
      ctx.restore();

      // Viền icon
      ctx.beginPath();
      ctx.arc(iconX, iconY, iconSize/2, 0, Math.PI * 2);
      ctx.strokeStyle = this.createGradient(
        ctx, iconX - iconSize/2, iconY - iconSize/2, iconSize, iconSize,
        '#A78BFA',
        '#7C3AED'
      );
      ctx.lineWidth = 3;
      ctx.stroke();
    } catch (error) {
      logger.error('ACHIEVEMENT', 'Lỗi khi vẽ icon achievement:', error);
    }
  }

  /**
   * Vẽ nội dung text
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} data - Dữ liệu achievement
   * @param {number} contentX - Tọa độ x nội dung
   * @param {number} contentY - Tọa độ y nội dung
   */
  renderContent(ctx, data, contentX, contentY) {
    let currentY = contentY;

    // Achievement Unlocked text
    this.setFont(ctx, 'SemiBold', 24);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#DDD6FE';
    ctx.fillText('Achievement Unlocked', contentX + 30, currentY);

    // Tên thành tựu
    currentY += 45;
    this.setFont(ctx, 'Bold', 36);
    ctx.fillStyle = this.colors.light;
    const achievementTitle = data.title || 'First Steps';
    ctx.fillText(achievementTitle, contentX + 30, currentY);

    // Mô tả thành tựu
    currentY += 35;
    this.setFont(ctx, 'Medium', 20);
    ctx.fillStyle = '#E9D5FF';
    const description = data.description || `Nhận được ${data.points} XP vì tương tác lần đầu!`;
    ctx.fillText(description, contentX + 30, currentY);

    // Khung cấp độ và XP
    currentY += 45;
    this.renderInfoBoxes(ctx, data, contentX, currentY);
  }

  /**
   * Vẽ các khung thông tin (level và XP)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} data - Dữ liệu achievement
   * @param {number} contentX - Tọa độ x
   * @param {number} y - Tọa độ y
   */
  renderInfoBoxes(ctx, data, contentX, y) {
    // Khung cấp độ
    this.applyShadow(ctx, () => {
      this.drawRoundRect(ctx, contentX + 30, y - 25, 140, 36, 18);
      const levelGradient = this.createGradient(
        ctx, 
        contentX + 30, 
        y - 25, 
        140, 
        36, 
        '#A78BFA', 
        '#7C3AED'
      );
      ctx.fillStyle = levelGradient;
      ctx.fill();
    });

    // Text cấp độ
    this.setFont(ctx, 'SemiBold', 18);
    ctx.fillStyle = this.colors.light;
    ctx.fillText(`Cấp độ ${data.level}`, contentX + 50, y);

    // Khung XP
    this.applyShadow(ctx, () => {
      this.drawRoundRect(ctx, contentX + 190, y - 25, 180, 36, 18);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
    });

    // Text XP
    ctx.fillStyle = this.colors.light;
    ctx.fillText(`+${data.points} XP`, contentX + 210, y);
  }

  /**
   * Tạo achievement canvas chính
   * @param {Object} data - Dữ liệu achievement
   * @returns {Promise<Buffer>} Buffer hình ảnh
   */
  async createAchievementCanvas(data) {
    try {
      // Cấu hình canvas
      const width = 800;
      const height = 220;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Vẽ nền
      this.renderBackground(ctx, width, height);

      // Card chính
      const cardX = 40;
      const cardY = 20;
      const cardW = width - 80;
      const cardH = height - 40;
      
      this.renderMainCard(ctx, cardX, cardY, cardW, cardH);

      // Icon achievement
      const iconSize = 160;
      const iconX = 180;
      const iconY = height/2;
      
      await this.renderIcon(ctx, iconX, iconY, iconSize);

      // Nội dung
      const contentX = iconX + iconSize;
      const contentY = 50;
      
      this.renderContent(ctx, data, contentX, contentY);

      return canvas.toBuffer();
    } catch (error) {
      logger.error('ACHIEVEMENT', 'Lỗi khi tạo achievement canvas:', error);
      throw error;
    }
  }

  /**
   * Dọn dẹp cache
   */
  clearCache() {
    this.imageCache.clear();
  }

  /**
   * Lấy thống kê cache
   * @returns {Object} Thống kê cache
   */
  getCacheStats() {
    return {
      images: this.imageCache.size,
      fontStats: fontManager.getStats()
    };
  }
}

// Tạo instance singleton
const achievementCanvas = new AchievementCanvas();

/**
 * Kiểm tra thành tựu cho người dùng
 * @param {Object} message - Discord message object
 * @param {Object} xpResult - Kết quả XP
 */
async function checkAchievements(message, xpResult) {
  try {
    if (!xpResult.xpAdded) return;

    const achievements = [];

    // Thành tựu lần đầu nhận XP
    if (xpResult.isFirstXP) {
      achievements.push({
        title: 'First Steps',
        description: 'Chào mừng bạn đến với cộng đồng! Bạn đã nhận được XP đầu tiên.',
        points: xpResult.points,
        level: xpResult.level,
        type: 'first_xp'
      });
    }

    // Thành tựu lên cấp
    if (xpResult.level > xpResult.previousLevel) {
      const levelMilestones = [5, 10, 25, 50, 100];
      
      if (levelMilestones.includes(xpResult.level)) {
        achievements.push({
          title: `Level ${xpResult.level} Master`,
          description: `Chúc mừng! Bạn đã đạt cấp độ ${xpResult.level}!`,
          points: xpResult.points,
          level: xpResult.level,
          type: 'level_milestone'
        });
      }
    }

    // Gửi thông báo thành tựu
    for (const achievement of achievements) {
      const achievementBuffer = await achievementCanvas.createAchievementCanvas(achievement);
      const attachment = new AttachmentBuilder(achievementBuffer, { 
        name: 'achievement.png' 
      });

      await message.channel.send({
        content: `🎉 **${message.author.username}** đã mở khóa thành tựu mới!`,
        files: [attachment]
      });
    }
  } catch (error) {
    logger.error('ACHIEVEMENT', 'Lỗi khi kiểm tra thành tựu:', error);
  }
}

module.exports = {
  checkAchievements,
  createAchievementCanvas: (data) => achievementCanvas.createAchievementCanvas(data),
  clearCache: () => achievementCanvas.clearCache(),
  getCacheStats: () => achievementCanvas.getCacheStats()
};