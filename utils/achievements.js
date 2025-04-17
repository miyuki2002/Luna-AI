const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

/**
 * Tạo canvas thành tựu "First XP"
 * @param {Object} data - Dữ liệu để vẽ thành tựu
 * @returns {Promise<Buffer>} - Buffer chứa hình ảnh thành tựu
 */
async function createFirstXPAchievement(data) {
  // Cấu hình canvas
  const width = 800;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Nền gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1a237e');
  gradient.addColorStop(1, '#4527a0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Thêm hiệu ứng ánh sáng
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.beginPath();
  ctx.arc(width - 100, 80, 100, 0, 2 * Math.PI);
  ctx.fill();
  
  // Thiết lập font chữ
  ctx.textAlign = 'center';
  
  // Vẽ icon thành tựu
  try {
    // Sử dụng icon từ assets nếu tồn tại, nếu không sử dụng hình ảnh mặc định
    let iconPath = path.join(__dirname, '../assets/xp-icon.png');
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(__dirname, '../assets/luna-avatar.png');
    }
    
    const icon = await loadImage(iconPath);
    
    // Vẽ icon hình tròn
    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 150, 80, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    ctx.drawImage(icon, 70, 70, 160, 160);
    ctx.restore();
    
    // Vẽ viền tròn cho icon
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(150, 150, 80, 0, Math.PI * 2);
    ctx.stroke();
  } catch (err) {
    console.error('Không thể tải hình ảnh icon:', err);
  }
  
  // Tiêu đề thành tựu
  ctx.font = 'bold 40px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('ACHIEVEMENT UNLOCKED!', width / 2, 70);
  
  // Tên thành tựu
  ctx.font = 'bold 36px Arial';
  ctx.fillStyle = '#ffd54f';
  ctx.fillText('First Steps', width / 2, 130);
  
  // Mô tả thành tựu
  ctx.font = '24px Arial';
  ctx.fillStyle = '#e0e0e0';
  ctx.fillText(`Bạn đã nhận được ${data.points} XP đầu tiên trong ${data.serverName}!`, width / 2, 180);
  
  // Xu hướng tiến triển
  ctx.fillStyle = '#4db6ac';
  ctx.fillText(`Đã đạt Cấp độ ${data.level}`, width / 2, 220);
  
  // XP mới
  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Tổng XP: ${data.totalXp} | Đã nhận: +${data.points} XP`, width / 2, 260);
  
  return canvas.toBuffer();
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
      .setColor('#7289DA')
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
    
    // Có thể thêm các thành tựu khác ở đây trong tương lai
    
  } catch (error) {
    console.error('Lỗi khi kiểm tra thành tựu:', error);
  }
}

module.exports = {
  checkAchievements,
  sendFirstXPAchievement,
  createFirstXPAchievement
};