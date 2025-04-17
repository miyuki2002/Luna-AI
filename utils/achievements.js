const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

// Định nghĩa đường dẫn tới thư mục assets
const ASSETS_PATH = path.join(__dirname, '../assets');

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
  const width = 900;
  const height = 320;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Màu sắc chủ đạo
  const primaryColor = '#7F5AF0'; // Màu tím
  const accentColor = '#FFD166'; // Màu vàng đậm
  const darkColor = '#16161A'; // Nền tối
  const lightColor = '#FFFFFE'; // Màu sáng (text)
  
  // Vẽ nền chính
  const bgGradient = createGradient(ctx, 0, 0, width, height, darkColor, '#242629');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);
  
  // Thêm hiệu ứng particles
  drawParticles(ctx, width, height, adjustColor(primaryColor, 30));
  
  // Vẽ khung chính
  withShadow(ctx, () => {
    roundRect(ctx, 20, 20, width - 40, height - 40, 20);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
  });
  
  // Vẽ banner "Achievement Unlocked"
  withShadow(ctx, () => {
    roundRect(ctx, width / 2 - 250, 20, 500, 60, 15);
    ctx.fillStyle = createGradient(ctx, width / 2 - 250, 20, 500, 60, primaryColor, adjustColor(primaryColor, -20));
    ctx.fill();
  });
  
  // Tiêu đề "ACHIEVEMENT UNLOCKED"
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillStyle = lightColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ACHIEVEMENT UNLOCKED!', width / 2, 50);
  
  try {
    // Vẽ icon thành tựu
    let iconPath = path.join(ASSETS_PATH, 'xp-icon.png');
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(ASSETS_PATH, 'luna-avatar.png');
    }
    
    const icon = await loadImage(iconPath);
    const iconSize = 120;
    const iconX = 100;
    const iconY = height / 2 + 10;
    
    // Vẽ hào quang xung quanh icon
    ctx.save();
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 3; i++) {
      const glowSize = iconSize + 10 * (i + 1);
      ctx.beginPath();
      ctx.arc(iconX, iconY, glowSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();
    }
    ctx.restore();
    
    // Vẽ các ngôi sao xung quanh icon
    for (let i = 0; i < 5; i++) {
      const starX = iconX + Math.cos(i * Math.PI * 2 / 5) * (iconSize / 1.5);
      const starY = iconY + Math.sin(i * Math.PI * 2 / 5) * (iconSize / 1.5);
      const starSize = 10 + Math.random() * 8;
      drawStar(ctx, starX, starY, starSize, accentColor);
    }
    
    // Vẽ icon trong khung tròn
    ctx.save();
    withShadow(ctx, () => {
      ctx.beginPath();
      ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = createGradient(ctx, iconX - iconSize/2, iconY - iconSize/2, iconSize, iconSize, primaryColor, adjustColor(primaryColor, 30));
      ctx.fill();
    });
    
    // Vẽ icon avatar
    ctx.beginPath();
    ctx.arc(iconX, iconY, iconSize / 2 - 5, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(icon, iconX - iconSize/2 + 5, iconY - iconSize/2 + 5, iconSize - 10, iconSize - 10);
    ctx.restore();
    
    // Vẽ viền tròn cho icon
    ctx.lineWidth = 3;
    ctx.strokeStyle = accentColor;
    ctx.beginPath();
    ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
    ctx.stroke();
    
  } catch (err) {
    console.error('Không thể tải hình ảnh icon:', err);
  }
  
  // Vẽ avatar người dùng
  try {
    if (data.avatarURL) {
      const avatar = await loadImage(data.avatarURL);
      const avatarSize = 60;
      
      // Vẽ khung avatar
      withShadow(ctx, () => {
        ctx.beginPath();
        ctx.arc(width - 60, 50, avatarSize / 2, 0, Math.PI * 2);
        const avatarBorderGradient = createGradient(ctx, width - 90, 20, 60, 60, adjustColor(accentColor, -20), accentColor);
        ctx.fillStyle = avatarBorderGradient;
        ctx.fill();
      });
      
      // Vẽ avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(width - 60, 50, avatarSize / 2 - 3, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar, width - 90, 20, 60, 60);
      ctx.restore();
    }
  } catch (err) {
    console.error('Không thể tải avatar người dùng:', err);
  }
  
  // Vẽ thông tin thành tựu (bên phải)
  const infoX = width / 2 + 60;
  let infoY = 120;
  
  // Tên thành tựu
  ctx.font = 'bold 40px Arial, sans-serif';
  const achievementTitle = data.title || 'First Steps';
  ctx.fillStyle = accentColor;
  ctx.textAlign = 'left';
  ctx.fillText(achievementTitle, infoX, infoY);
  
  // Vẽ đường gạch trang trí dưới tên thành tựu
  ctx.beginPath();
  ctx.moveTo(infoX, infoY + 15);
  ctx.lineTo(infoX + ctx.measureText(achievementTitle).width * 0.8, infoY + 15);
  ctx.lineWidth = 3;
  ctx.strokeStyle = adjustColor(accentColor, -20);
  ctx.stroke();
  
  infoY += 50;
  
  // Mô tả thành tựu
  const description = data.description || `Bạn đã nhận được ${data.points} XP đầu tiên trong ${data.serverName}!`;
  
  ctx.font = '22px Arial, sans-serif';
  ctx.fillStyle = lightColor;
  
  // Hiển thị mô tả (tối đa 2 dòng)
  const words = description.split(' ');
  let line = '';
  const maxLineWidth = width - infoX - 30;
  let lineCount = 0;
  
  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxLineWidth && line !== '') {
      ctx.fillText(line, infoX, infoY);
      line = word + ' ';
      infoY += 30;
      lineCount++;
      
      if (lineCount >= 2) break;
    } else {
      line = testLine;
    }
  }
  
  if (lineCount < 2) {
    ctx.fillText(line, infoX, infoY);
    infoY += 30;
  }
  
  infoY += 10;
  
  // Vẽ khung thông tin cấp độ
  withShadow(ctx, () => {
    roundRect(ctx, infoX, infoY, 300, 50, 10);
    const levelGradient = createGradient(ctx, infoX, infoY, 300, 50, adjustColor(primaryColor, -20), adjustColor(primaryColor, 20));
    ctx.fillStyle = levelGradient;
    ctx.fill();
  });
  
  // Hiển thị thông tin cấp độ
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillStyle = lightColor;
  ctx.textAlign = 'center';
  ctx.fillText(`Đã đạt Cấp độ ${data.level}`, infoX + 150, infoY + 30);
  
  infoY += 70;
  
  // Vẽ khung thông tin XP
  withShadow(ctx, () => {
    roundRect(ctx, infoX, infoY, 300, 50, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();
  });
  
  // Hiển thị thông tin XP
  ctx.fillStyle = lightColor;
  ctx.font = '18px Arial, sans-serif';
  ctx.fillText(`Tổng XP: ${data.totalXp} | Đã nhận: +${data.points} XP`, infoX + 150, infoY + 30);
  
  // Thêm label "NEW" ở góc
  ctx.save();
  ctx.translate(width - 110, 130);
  ctx.rotate(-Math.PI / 12);
  
  roundRect(ctx, -50, -15, 100, 30, 5);
  ctx.fillStyle = accentColor;
  ctx.fill();
  
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillStyle = darkColor;
  ctx.textAlign = 'center';
  ctx.fillText('NEW!', 0, 5);
  ctx.restore();
  
  return canvas.toBuffer();
}

/**
 * Tạo canvas thành tựu "First XP" với thiết kế hiện đại
 * @param {Object} data - Dữ liệu để vẽ thành tựu
 * @returns {Promise<Buffer>} - Buffer chứa hình ảnh thành tựu
 */
async function createFirstXPAchievement(data) {
  // Chuẩn bị dữ liệu cho canvas thành tựu
  const achievementData = {
    title: 'First Steps',
    description: `Bạn đã nhận được ${data.points} XP đầu tiên trong ${data.serverName}!`,
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
    
    // Tạo embed message
    const embed = new EmbedBuilder()
      .setColor('#7F5AF0')
      .setTitle('🏆 Thành tựu mới mở khóa!')
      .setDescription(`Chúc mừng ${message.author}! Bạn vừa nhận được XP đầu tiên trong **${message.guild.name}**!`)
      .setImage('attachment://achievement.png')
      .setFooter({ text: 'Tiếp tục gửi tin nhắn để nhận thêm XP và lên cấp!' })
      .setTimestamp();
    
    // Gửi tin nhắn thành tựu
    await message.channel.send({ embeds: [embed], files: [attachment] });
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
    description: `Bạn đã đạt được cấp độ ${data.level} trong ${data.serverName}!`,
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
    
    // Tạo embed message
    const embed = new EmbedBuilder()
      .setColor('#7F5AF0')
      .setTitle('⭐ Level Up!')
      .setDescription(`Chúc mừng ${message.author}! Bạn vừa đạt cấp độ ${xpData.level} trong **${message.guild.name}**!`)
      .setImage('attachment://level-up.png')
      .setFooter({ text: 'Tiếp tục tương tác để nhận thêm XP và lên cấp!' })
      .setTimestamp();
    
    // Gửi tin nhắn thành tựu
    await message.channel.send({ embeds: [embed], files: [attachment] });
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