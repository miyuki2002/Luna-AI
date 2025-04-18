const { SlashCommandBuilder } = require('@discordjs/builders');
const { AttachmentBuilder } = require('discord.js');
const ProfileDB = require('../services/profiledb');
const mongoClient = require('../services/mongoClient');
const profileCanvas = require('../utils/profileCanvas'); // Sử dụng class ProfileCanvas

// Utility function to standardize font specification
function getStandardFont(size, weight = 'normal', fontFamily = 'Montserrat') {
  // Use CSS-style font specification that's compatible with Pango
  return `${weight} ${size}px "${fontFamily}", Arial, sans-serif`;
}

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
      // Sử dụng hàm getProfile từ ProfileDB
      const doc = await ProfileDB.getProfile(member.id);
      
      // Kiểm tra cẩn thận cấu trúc dữ liệu
      if (!doc || !doc.data || !doc.data.xp || !Array.isArray(doc.data.xp)) {
        return interaction.editReply(`❌ **${member.user.username}** has no XP data yet!`);
      }
      
      // Tìm dữ liệu XP cho server hiện tại
      const serverData = doc.data.xp.find(x => x.id === interaction.guild.id);
      
      if (!serverData) {
        return interaction.editReply(`❌ **${member.user.username}** has not started earning XP in this server yet!`);
      }
      
      // Lấy collection để tính xếp hạng
      const profileCollection = await ProfileDB.getProfileCollection();
      
      // Lấy tất cả profile có XP trong server này
      const allProfiles = await profileCollection.find({
        "data.xp": { $elemMatch: { id: interaction.guild.id } }
      }).toArray();
      
      // Sắp xếp và tìm thứ hạng
      const server_rank = allProfiles
        .sort((A, B) => {
          const aData = A.data.xp.find(x => x.id === interaction.guild.id);
          const bData = B.data.xp.find(x => x.id === interaction.guild.id);
          return (bData?.xp || 0) - (aData?.xp || 0);
        })
        .findIndex(x => x._id === doc._id) + 1;
      
      // Lấy thứ hạng toàn cầu (tất cả server)
      const allGlobalProfiles = await profileCollection.find().toArray();
      const globalRank = allGlobalProfiles
        .map(profile => {
          let totalXP = 0;
          if (profile.data.xp && Array.isArray(profile.data.xp)) {
            totalXP = profile.data.xp.reduce((sum, xpData) => sum + xpData.xp, 0);
          }
          return { id: profile._id, totalXP };
        })
        .sort((a, b) => b.totalXP - a.totalXP)
        .findIndex(x => x.id === doc._id) + 1;
      
      // Tính toán tổng XP và level cho server hiện tại
      const currentXP = serverData.xp;
      const level = serverData.level;
      
      // Chuẩn bị dữ liệu để vẽ profile
      const profileData = {
        username: member.user.username,
        discriminator: member.user.discriminator,
        avatarURL: member.user.displayAvatarURL({ extension: 'png', size: 512 }),
        serverName: interaction.guild.name,
        level: level,
        currentXP: currentXP,
        bio: doc.data.profile?.bio || "No bio written.",
        birthday: doc.data.profile?.birthday,
        rank: {
          server: server_rank,
          global: globalRank
        },
        customization: {
          color: doc.data.profile?.color || '#7F5AF0', // Màu tím mặc định
          banner: doc.data.profile?.background,
          pattern: doc.data.profile?.pattern,
          wreath: doc.data.profile?.wreath,
          emblem: doc.data.profile?.emblem,
        },
        // Thêm thông tin huy hiệu nếu có
        badges: doc.data.achievements ? 
          doc.data.achievements
            .filter(a => a.unlocked)
            .map(a => ({ name: a.name, emoji: a.emoji, icon: a.icon })) 
          : []
      };
      
      // Sử dụng class ProfileCanvas để tạo hình profile
      const profileBuffer = await profileCanvas.createProfileCard(profileData);
      
      // Gửi hình profile
      const attachment = new AttachmentBuilder(profileBuffer, { name: 'profile.png' });
      return interaction.editReply({ files: [attachment] });
      
    } catch (err) {
      console.error(err);
      return interaction.editReply(`❌ [DATABASE_ERR]: The database responded with error: ${err.name}`);
    }
  }
};
