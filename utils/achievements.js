const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

// Định nghĩa đường dẫn tới thư mục assets
const ASSETS_PATH = path.join(__dirname, '../assets');
const FONTS_PATH = path.join(ASSETS_PATH, 'fonts');

// Đăng ký fonts với nhiều cách khác nhau để tăng khả năng tương thích với Pango
try {
  // Map giữa weights dạng chữ và số
  const fontWeightMappings = {
    'Thin': 100,
    'ExtraLight': 200,
    'Light': 300,
    'Regular': 400,
    'Medium': 500,
    'SemiBold': 600,
    'Bold': 700,
    'ExtraBold': 800,
    'Black': 900
  };

  // Đăng ký tất cả các biến thể font Montserrat cơ bản với nhiều cách khác nhau
  const fontVariants = [
    { file: 'Montserrat-Regular.otf', weight: 'Regular', style: 'normal' },
    { file: 'Montserrat-Bold.otf', weight: 'Bold', style: 'normal' },
    { file: 'Montserrat-Italic.otf', weight: 'Regular', style: 'italic' },
    { file: 'Montserrat-BoldItalic.otf', weight: 'Bold', style: 'italic' },
    { file: 'Montserrat-Medium.otf', weight: 'Medium', style: 'normal' },
  ];

  // Đăng ký với mỗi cách khác nhau
  for (const variant of fontVariants) {
    try {
      // Cách 1: Đăng ký với tên weight
      registerFont(path.join(FONTS_PATH, variant.file), {
        family: 'Montserrat',
        weight: variant.weight === 'Regular' ? 'normal' : variant.weight.toLowerCase(),
        style: variant.style
      });

      // Cách 2: Đăng ký với số weight
      registerFont(path.join(FONTS_PATH, variant.file), {
        family: 'Montserrat',
        weight: fontWeightMappings[variant.weight].toString(),
        style: variant.style
      });

      // Cách 3: Đăng ký không có rotation
      registerFont(path.join(FONTS_PATH, variant.file), {
        family: 'Montserrat',
        weight: variant.weight === 'Regular' ? 'normal' : variant.weight.toLowerCase(),
        style: variant.style,
        rotate: false
      });
    } catch (err) {
      console.warn(`Không thể đăng ký font ${variant.file}:`, err.message);
    }
  }
  
  console.log('Đã đăng ký font Montserrat thành công');
} catch (err) {
  console.error('Không thể đăng ký font Montserrat:', err.message);
  console.warn('Sẽ sử dụng font dự phòng');
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
function roundRect(ctx, x, y, width, height, radius) {
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
function withShadow(ctx, drawFunc) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
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
function createGradient(ctx, x, y, width, height, color1, color2) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
}

/**
 * Tạo hiệu ứng particle cho hình ảnh
 * @param {CanvasRenderingContext2D} ctx - Context của canvas
 * @param {number} width - Chiều rộng canvas
 * @param {number} height - Chiều cao canvas
 * @param {string} color - Màu sắc particle
 */
function drawParticles(ctx, width, height, color) {
  const particleCount = 30;
  
  ctx.save();
  ctx.globalAlpha = 0.6;
  
  for (let i = 0; i < particleCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 4 + 1;
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  
  // Thêm một vài đường trang trí
  for (let i = 0; i < 5; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = x1 + Math.random() * 100 - 50;
    const y2 = y1 + Math.random() * 100 - 50;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * Vẽ hình sao trang trí
 * @param {CanvasRenderingContext2D} ctx - Context của canvas
 * @param {number} x - Tọa độ x
 * @param {number} y - Tọa độ y
 * @param {number} size - Kích thước
 * @param {string} color - Màu sắc
 */
function drawStar(ctx, x, y, size, color) {
  ctx.save();
  ctx.beginPath();
  ctx.translate(x, y);
  ctx.rotate(Math.random() * Math.PI * 2);
  
  const spikes = 5;
  const outerRadius = size;
  const innerRadius = size / 2;
  
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (Math.PI * 2) * (i / (spikes * 2));
    const pointX = Math.cos(angle) * radius;
    const pointY = Math.sin(angle) * radius;
    
    if (i === 0) {
      ctx.moveTo(pointX, pointY);
    } else {
      ctx.lineTo(pointX, pointY);
    }
  }
  
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/**
 * Điều chỉnh màu sắc (tối/sáng hơn)
 * @param {string} color - Mã màu hex
 * @param {number} percent - Phần trăm điều chỉnh (-100 đến 100)
 * @returns {string} - Mã màu mới
 */
function adjustColor(color, percent) {
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

/**
 * Tạo canvas thành tựu với thiết kế hiện đại
 * @param {Object} data - Dữ liệu để vẽ thành tựu
 * @returns {Promise<Buffer>} - Buffer chứa hình ảnh thành tựu
 */
async function createAchievementCanvas(data) {
  // Cấu hình canvas
  const width = 800;
  const height = 220;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Màu sắc chủ đạo
  const primaryColor = '#8B5CF6'; // Tím chính
  const accentColor = '#C4B5FD'; // Tím nhạt
  const darkColor = '#1E1B4B'; // Xanh đen
  const lightColor = '#FFFFFF';

  // Vẽ nền với gradient phức tạp
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, '#2E1065');
  bgGradient.addColorStop(1, '#4C1D95');
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
      ctx.moveTo(x, y);
      ctx.lineTo(x + size, y - size/2);
      ctx.lineTo(x + size*1.5, y);
      ctx.lineTo(x + size, y + size/2);
    } else {
      ctx.arc(x, y, size/2, 0, Math.PI * 2);
    }
    ctx.fillStyle = accentColor;
    ctx.fill();
  }
  ctx.restore();

  // Card chính chứa nội dung
  const cardX = 40;
  const cardY = 20;
  const cardW = width - 80;
  const cardH = height - 40;
  
  // Vẽ card với hiệu ứng trong suốt
  ctx.save();
  ctx.globalAlpha = 0.15;
  roundRect(ctx, cardX, cardY, cardW, cardH, 20);
  const cardGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardGradient.addColorStop(0, '#F5F3FF');
  cardGradient.addColorStop(1, '#DDD6FE');
  ctx.fillStyle = cardGradient;
  ctx.fill();
  ctx.restore();

  // Vẽ viền card với gradient
  ctx.strokeStyle = createGradient(ctx, cardX, cardY, cardW, cardH, '#A78BFA', '#7C3AED');
  ctx.lineWidth = 2;
  ctx.stroke();

  try {
    // Vẽ icon thành tựu
    let iconPath = path.join(ASSETS_PATH, 'xp-icon.png');
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(ASSETS_PATH, 'luna-avatar.png');
    }
    const icon = await loadImage(iconPath);
    const iconSize = 160;
    const iconX = 180;
    const iconY = height/2;

    // Hiệu ứng hào quang cho icon
    const glowGradient = ctx.createRadialGradient(
      iconX, iconY, iconSize/4,
      iconX, iconY, iconSize
    );
    glowGradient.addColorStop(0, 'rgba(167, 139, 250, 0.3)');
    glowGradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.1)');
    glowGradient.addColorStop(1, 'rgba(124, 58, 237, 0)');
    
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
    ctx.strokeStyle = createGradient(ctx, iconX - iconSize/2, iconY - iconSize/2, iconSize, iconSize, '#A78BFA', '#7C3AED');
    ctx.lineWidth = 3;
    ctx.stroke();

    // Nội dung bên phải
    const contentX = iconX + iconSize;
    let contentY = 50;

    // Achievement Unlocked text với viền sáng
    ctx.font = '600 24px Montserrat';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#DDD6FE';
    ctx.fillText('Achievement Unlocked', contentX + 30, contentY);

    // Tên thành tựu
    contentY += 45;
    ctx.font = '700 36px Montserrat';
    ctx.fillStyle = lightColor;
    const achievementTitle = data.title || 'First Steps';
    ctx.fillText(achievementTitle, contentX + 30, contentY);

    // Mô tả thành tựu
    contentY += 35;
    ctx.font = '500 20px Montserrat';
    ctx.fillStyle = '#E9D5FF';
    const description = data.description || `Nhận được ${data.points} XP vì tương tác lần đầu!`;
    ctx.fillText(description, contentX + 30, contentY);

    // Khung cấp độ
    contentY += 45;
    withShadow(ctx, () => {
      roundRect(ctx, contentX + 30, contentY - 25, 140, 36, 18);
      const levelGradient = createGradient(
        ctx, 
        contentX + 30, 
        contentY - 25, 
        140, 
        36, 
        '#A78BFA', 
        '#7C3AED'
      );
      ctx.fillStyle = levelGradient;
      ctx.fill();
    });

    // Text cấp độ
    ctx.font = '600 18px Montserrat';
    ctx.fillStyle = lightColor;
    ctx.fillText(`Cấp độ ${data.level}`, contentX + 50, contentY);

    // Khung XP
    withShadow(ctx, () => {
      roundRect(ctx, contentX + 190, contentY - 25, 180, 36, 18);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
    });

    // Text XP
    ctx.fillStyle = lightColor;
    ctx.fillText(`+${data.points} XP`, contentX + 210, contentY);

  } catch (err) {
    console.error('Lỗi khi tạo canvas:', err);
  }

  return canvas.toBuffer();
}

/**
 * @param {Object} data - Dữ liệu để vẽ thành tựu
 * @returns {Promise<Buffer>} - Buffer chứa hình ảnh thành tựu
 */
async function createFirstXPAchievement(data) {
  // Chuẩn bị dữ liệu cho canvas thành tựu
  const achievementData = {
    title: 'First Steps',
    description: `Nhận được ${data.points} XP vì tương tác lần đầu!`,
    points: data.points,
    level: data.level,
    totalXp: data.totalXp,
    avatarURL: data.avatarURL,
    username: data.username
  };
  
  // Sử dụng hàm tạo canvas chung
  return createAchievementCanvas(achievementData);
}

/**
 * Gửi thông báo thành tựu "First XP" cho người dùng
 * @param {Object} message - Discord message object
 * @param {Object} xpData - Dữ liệu XP đã nhận được
 */
async function sendFirstXPAchievement(message, xpData) {
  try {
    const data = {
      userId: message.author.id,
      username: message.author.username,
      avatarURL: message.author.displayAvatarURL({ extension: 'png' }),
      points: xpData.points,
      level: xpData.level,
      totalXp: xpData.totalXp,
      serverName: message.guild.name
    };
    
    // Tạo hình ảnh thành tựu
    const achievementImage = await createFirstXPAchievement(data);
    
    // Tạo file attachment từ buffer
    const attachment = new AttachmentBuilder(achievementImage, { name: 'achievement.png' });
    
    // Gửi tin nhắn thành tựu chỉ với hình ảnh
    await message.channel.send({ files: [attachment] });
    console.log(`Đã gửi thành tựu "First XP" cho ${message.author.tag} trong ${message.guild.name}`);
    
  } catch (error) {
    console.error('Lỗi khi gửi thành tựu First XP:', error);
  }
}

/**
 * Tạo canvas thành tựu cấp độ mới
 * @param {Object} data - Dữ liệu để vẽ thành tựu
 * @returns {Promise<Buffer>} - Buffer chứa hình ảnh thành tựu
 */
async function createLevelUpAchievement(data) {
  // Chuẩn bị dữ liệu cho canvas thành tựu
  const achievementData = {
    title: 'Level Up!',
    description: `Bạn đã đạt được cấp độ ${data.level}!`,
    points: data.points,
    level: data.level,
    totalXp: data.totalXp,
    avatarURL: data.avatarURL,
    username: data.username
  };
  
  // Sử dụng hàm tạo canvas chung
  return createAchievementCanvas(achievementData);
}

/**
 * Gửi thông báo thành tựu cấp độ mới cho người dùng
 * @param {Object} message - Discord message object
 * @param {Object} xpData - Dữ liệu XP đã nhận được
 */
async function sendLevelUpAchievement(message, xpData) {
  try {
    const data = {
      userId: message.author.id,
      username: message.author.username,
      avatarURL: message.author.displayAvatarURL({ extension: 'png' }),
      points: xpData.points,
      level: xpData.level,
      totalXp: xpData.totalXp,
      serverName: message.guild.name
    };
    
    // Tạo hình ảnh thành tựu
    const achievementImage = await createLevelUpAchievement(data);
    
    // Tạo file attachment từ buffer
    const attachment = new AttachmentBuilder(achievementImage, { name: 'level-up.png' });
    
    // Gửi tin nhắn thành tựu chỉ với hình ảnh
    await message.channel.send({ files: [attachment] });
    console.log(`Đã gửi thông báo lên cấp cho ${message.author.tag} trong ${message.guild.name}`);
    
  } catch (error) {
    console.error('Lỗi khi gửi thông báo lên cấp:', error);
  }
}

/**
 * Kiểm tra các thành tựu
 * @param {Object} message - Discord message object
 * @param {Object} xpData - Dữ liệu XP đã nhận được
 */
async function checkAchievements(message, xpData) {
  try {
    // Kiểm tra nếu đây là lần đầu tiên nhận XP trong server này
    if (xpData.isFirstXP) {
      await sendFirstXPAchievement(message, xpData);
    }
    
    // Kiểm tra nếu người dùng vừa lên cấp
    if (xpData.leveledUp) {
      await sendLevelUpAchievement(message, xpData);
    }
    
    // Có thể thêm các thành tựu khác ở đây trong tương lai
    
  } catch (error) {
    console.error('Lỗi khi kiểm tra thành tựu:', error);
  }
}

module.exports = {
  checkAchievements,
  sendFirstXPAchievement,
  createFirstXPAchievement,
  sendLevelUpAchievement,
  createLevelUpAchievement,
  createAchievementCanvas // Xuất hàm để sử dụng cho các thành tựu khác trong tương lai
};