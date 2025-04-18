const { AttachmentBuilder } = require('discord.js');
const ProfileDB = require('../services/profiledb');
const profileCanvas = require('../services/canvas/profileCanvas');

/**
 * Xử lý lệnh hiển thị profile
 * @param {Object} interaction - Tương tác Discord
 */
async function handleProfileCommand(interaction) {
  await interaction.deferReply();
    
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const member = await interaction.guild.members.fetch(targetUser.id).catch(() => interaction.member);
  
  if (member.user.bot) {
    return interaction.editReply(`❌ Bot không thể nhận XP!`);
  }
  
  try {
    // Sử dụng hàm getProfile từ ProfileDB
    const doc = await ProfileDB.getProfile(member.id);
    
    // Kiểm tra cẩn thận cấu trúc dữ liệu
    if (!doc || !doc.data || !doc.data.xp || !Array.isArray(doc.data.xp)) {
      return interaction.editReply(`❌ **${member.user.username}** chưa có dữ liệu XP nào!`);
    }
    
    // Tìm dữ liệu XP cho server hiện tại
    const serverData = doc.data.xp.find(x => x.id === interaction.guild.id);
    
    if (!serverData) {
      return interaction.editReply(`❌ **${member.user.username}** chưa bắt đầu nhận XP trong server này!`);
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
    
    // Chuẩn bị dữ liệu để vẽ profile
    const profileData = {
      username: member.user.username,
      discriminator: member.user.discriminator,
      avatarURL: member.user.displayAvatarURL({ extension: 'png', size: 512 }),
      serverName: interaction.guild.name,
      level: serverData.level,
      currentXP: serverData.xp,
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
    
    // Tạo hình ảnh profile card
    const cardBuffer = await profileCanvas.createProfileCard(profileData);
    
    // Tạo attachment từ buffer
    const attachment = new AttachmentBuilder(cardBuffer, { name: 'profile.png' });
    
    // Phản hồi với hình ảnh
    await interaction.editReply({
      files: [attachment]
    });
  } catch (error) {
    console.error('Lỗi khi xử lý lệnh profile:', error);
    
    await interaction.editReply({ 
      content: `❌ [LỖI CSDL]: Cơ sở dữ liệu phản hồi lỗi: ${error.name}`
    });
  }
}

module.exports = { handleProfileCommand };
