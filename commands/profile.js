const { SlashCommandBuilder } = require('@discordjs/builders');
const { AttachmentBuilder } = require('discord.js');
const ProfileDB = require('../services/profiledb');
const mongoClient = require('../services/mongoClient');
const text = require('../utils/string');
const { createCanvas, loadImage } = require('canvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Shows the current xp, level, rank, and other details of a user')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('The user whose profile you want to view')
        .setRequired(false)),
    
  async execute(interaction) {
    await interaction.deferReply();
    
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => interaction.member);
    
    if (member.user.bot) {
      return interaction.editReply(`❌ Bots cannot earn XP!`);
    }
    
    try {
      const profileCollection = await ProfileDB.getProfileCollection();
      const doc = await profileCollection.findOne({ _id: member.id });
      
      if (!doc || !doc.data.xp.some(x => x.id === interaction.guild.id)) {
        return interaction.editReply(`❌ **${member.user.tag}** has not started earning XP in this server yet!`);
      }
      
      const allProfiles = await profileCollection.find({ 'data.xp.id': interaction.guild.id }).toArray();
      const server_rank = allProfiles
        .sort((A, B) => 
          B.data.xp.find(x => x.id === interaction.guild.id).xp - 
          A.data.xp.find(x => x.id === interaction.guild.id).xp)
        .findIndex(x => x._id === doc._id) + 1;
      
      const server_data = doc.data.xp.find(x => x.id === interaction.guild.id);
      const cap = (50 * Math.pow(server_data.level, 2)) + (250 * server_data.level);
      const lowerLim = (50 * Math.pow(server_data.level - 1, 2)) + (250 * (server_data.level - 1));
      const range = cap - lowerLim;
      const currxp = server_data.xp - lowerLim;
      const percentDiff = currxp / range;
      
      const canvas = createCanvas(800, 600);
      const ctx = canvas.getContext('2d');
      const color = doc.data.profile.color || 'rgb(255,182,193)';

      // Load images
      const hat = doc.data.profile.hat ? await loadImage(doc.data.profile.hat) : null;
      const emblem = doc.data.profile.emblem ? await loadImage(doc.data.profile.emblem) : null;
      const wreath = doc.data.profile.wreath ? await loadImage(doc.data.profile.wreath) : null;
      const def = await loadImage(doc.data.profile.background || 'https://i.imgur.com/57eRI6H.jpg');
      const defpattern = await loadImage(doc.data.profile.pattern || 'https://i.imgur.com/nx5qJUb.png');
      const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 512 }));

      // Vẽ nền màu cho toàn bộ canvas
      ctx.fillStyle = '#36393f'; // Discord background color
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Vẽ pattern nếu có
      ctx.globalAlpha = 0.3;
      ctx.drawImage(defpattern, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;

      // Vẽ hình nền profile
      ctx.drawImage(def, 300, 65, 475, 250);

      // Vẽ bảng xếp hạng thông tin bên trái
      ctx.beginPath();
      ctx.moveTo(25, 65);
      ctx.lineTo(275, 65);
      ctx.lineTo(275, 315);
      ctx.lineTo(25, 315);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 40;
      ctx.shadowOffsetX = 10;
      ctx.shadowOffsetY = 10;
      ctx.fill();
      
      // add the bio card
      ctx.beginPath();
      ctx.moveTo(300, 315);
      ctx.lineTo(canvas.width - 5, 315);
      ctx.lineTo(canvas.width - 5, canvas.height - 25);
      ctx.lineTo(300, canvas.height - 25);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 40;
      ctx.shadowOffsetX = -10;
      ctx.shadowOffsetY = -40;
      ctx.fill();

      // Vẽ tên người dùng
      ctx.beginPath();
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.textAlign = 'center';
      ctx.fillText(member.user.username, 150, 350, 240);

      // Hiển thị tag Discord
      ctx.beginPath();
      ctx.font = '16px sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(`#${member.user.discriminator || 'none'}`, 150, 375, 240);
      
      // Hiển thị rank
      ctx.beginPath();
      ctx.font = 'bold 36px sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(`#${server_rank}`, 150, 425, 100);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText('RANK', 150, 450, 100);

      // add bio outline
      ctx.beginPath();
      ctx.moveTo(370, 338);
      ctx.lineTo(canvas.width - 40, 338);
      ctx.arcTo(canvas.width - 20, 338, canvas.width - 20, 358, 20);
      ctx.lineTo(canvas.width - 20, 378);
      ctx.arcTo(canvas.width - 20, 398, canvas.width - 40, 398, 20);
      ctx.lineTo(330, 398);
      ctx.arcTo(310, 398, 310, 378, 20);
      ctx.lineTo(310, 358);
      ctx.arcTo(310, 338, 330, 338, 20);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.stroke();

      // add bio title
      ctx.beginPath();
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.textAlign = 'left';
      ctx.fillText('BIO', 330, 345, 50);

      // add bio text to bio card
      ctx.beginPath();
      ctx.font = '15px sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.textAlign = 'center';
      ctx.fillText(doc.data.profile.bio, 555, 368, 490);

      // Hiển thị thông tin kinh tế (nếu có)
      if (doc.data.economy) {
        // Tiêu đề phần kinh tế
        ctx.beginPath();
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.textAlign = 'left';
        ctx.fillText('ECONOMY', 330, 430, 100);
        
        // Hiển thị số dư tài khoản
        ctx.beginPath();
        ctx.font = '15px sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillText(`💰 Wallet: ${doc.data.economy.wallet || 0}`, 350, 455, 200);
        ctx.fillText(`🏦 Bank: ${doc.data.economy.bank || 0}`, 550, 455, 200);
      }
      
      // Hiển thị ngày sinh (nếu có)
      if (doc.data.profile.birthday) {
        ctx.beginPath();
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.textAlign = 'left';
        ctx.fillText('BIRTHDAY', 330, 490, 100);
        
        ctx.beginPath();
        ctx.font = '15px sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillText(`🎂 ${doc.data.profile.birthday}`, 350, 515, 200);
      }
      
      // Hiển thị XP progress bar
      ctx.beginPath();
      ctx.moveTo(330, 540);
      ctx.lineTo(canvas.width - 40, 540);
      ctx.lineTo(canvas.width - 40, 570);
      ctx.lineTo(330, 570);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fill();
      
      // XP progress fill
      ctx.beginPath();
      ctx.moveTo(330, 540);
      ctx.lineTo(330 + ((canvas.width - 40 - 330) * percentDiff), 540);
      ctx.lineTo(330 + ((canvas.width - 40 - 330) * percentDiff), 570);
      ctx.lineTo(330, 570);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      
      // XP và level text
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      
      // Hiển thị level
      ctx.fillText(`Level ${server_data.level}`, canvas.width - 200, 560, 100);
      
      // Hiển thị XP
      ctx.fillText(`${currxp}/${range} XP`, 430, 560, 150);
      
      // Hiển thị emblem (nếu có)
      if (emblem) {
        ctx.beginPath();
        ctx.drawImage(emblem, 700, 420, 80, 80);
      }
      
      // add avatar
      ctx.beginPath();
      ctx.arc(150, 225, 75, 0, Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.closePath();
      ctx.save();
      ctx.clip();
      ctx.drawImage(avatar, 75, 150, 150, 150);
      ctx.restore();

      // add wreath
      if (wreath) {
        ctx.beginPath();
        ctx.drawImage(wreath, 60, 145, 180, 180);
      }

      if (hat) {
        ctx.beginPath();
        ctx.drawImage(hat, 60, 85, 180, 180);
      }

      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'profile.png' });
      
      return interaction.editReply({ files: [attachment] });
    } catch (err) {
      console.error(err);
      return interaction.editReply(`❌ [DATABASE_ERR]: The database responded with error: ${err.name}`);
    }
  }
};
