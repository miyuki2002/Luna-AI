const { SlashCommandBuilder } = require('@discordjs/builders');
const { AttachmentBuilder } = require('discord.js');
const Profile = require('../../services/profiledb');
const text = require('../../util/string');
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
      const doc = await Profile.findOne({ _id: member.id });
      
      if (!doc || !doc.data.xp.some(x => x.id === interaction.guild.id)) {
        return interaction.editReply(`❌ **${member.user.tag}** has not started earning XP in this server yet!`);
      }
      
      const server_rank = await Profile.find({ 'data.xp.id': interaction.guild.id })
        .then(docs => Promise.resolve(docs.sort((A, B) => 
          B.data.xp.find(x => x.id === interaction.guild.id).xp - 
          A.data.xp.find(x => x.id === interaction.guild.id).xp)))
        .then(sorted => sorted.findIndex(x => x._id === doc._id) + 1);
      
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

      // add the wallpaper
      ctx.drawImage(def, 300, 65, 475, 250);

      // ...existing code...
      
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

      // ...existing code...

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
      ctx.fillText('BIO', 330, 345, 50);

      // ...existing code...

      // add bio text to bio card
      ctx.beginPath();
      ctx.font = '15px sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.textAlign = 'center';
      ctx.fillText(doc.data.profile.bio, 555, 368, 490);

      // Add all components (birthday, balance, emblem, etc.)
      // ...existing code...
      
      // add avatar
      ctx.beginPath();
      ctx.arc(150, 225, 75, 0, Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
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
        ctx.drawImage(hat, 0, 0, 300, 300);
      }

      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'profile.png' });
      
      return interaction.editReply({ files: [attachment] });
    } catch (err) {
      console.error(err);
      return interaction.editReply(`❌ [DATABASE_ERR]: The database responded with error: ${err.name}`);
    }
  }
};
