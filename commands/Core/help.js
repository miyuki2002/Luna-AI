const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Hiển thị danh sách lệnh và thông tin trợ giúp'),

  async execute(interaction) {
    const isOwner = interaction.user.id === process.env.OWNER_ID;
    
    // Đọc các thư mục lệnh
    const commandsPath = path.join(__dirname, '../');
    const commandFolders = fs.readdirSync(commandsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    const visibleCategories = commandFolders.filter(folder => {
      if (isOwner) return true;
      return folder !== 'setting';
    });
    
    const select = new StringSelectMenuBuilder()
      .setCustomId('category-select')
      .setPlaceholder('Chọn danh mục lệnh')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Tất cả')
          .setDescription('Xem tất cả các lệnh')
          .setValue('all')
          .setEmoji('📚'),
        
        ...visibleCategories.map(folder => 
          new StringSelectMenuOptionBuilder()
            .setLabel(folder.charAt(0).toUpperCase() + folder.slice(1))
            .setDescription(`Xem lệnh danh mục ${folder}`)
            .setValue(folder)
            .setEmoji(getCategoryEmoji(folder))
        )
      );
    
    const row = new ActionRowBuilder().addComponents(select);
    
    // Tạo embed chào mừng ban đầu
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x9B59B6) // Màu tím
      .setTitle('📚 Trợ giúp lệnh Luna AI')
      .setDescription('Chọn một danh mục từ menu dropdown bên dưới để xem các lệnh.')
      .setFooter({ text: 'Luna AI • Developed by s4ory' })
      .setTimestamp();
    
    // Gửi tin nhắn với menu và embed
    await interaction.reply({
      embeds: [welcomeEmbed],
      components: [row]
    });
    
    // Lấy message sau khi reply
    const message = await interaction.fetchReply();
    
    const collector = message.createMessageComponentCollector({ 
      time: 60000,
      componentType: ComponentType.StringSelect
    });
    
    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ 
          content: 'Bạn không thể sử dụng menu này, vui lòng sử dụng lệnh `/help` để tạo menu riêng.', 
          ephemeral: true 
        });
      }
      
      const category = i.values[0];
      
      if (category === 'setting' && !isOwner) {
        return i.reply({
          content: 'Bạn không có quyền xem danh mục này.',
          ephemeral: true
        });
      }
      
      const helpEmbed = new EmbedBuilder()
        .setColor(0x9B59B6) // Màu tím
        .setTitle(`📚 Trợ giúp lệnh - ${category === 'all' ? 'Tất cả danh mục' : capitalizeFirstLetter(category)}`)
        .setFooter({ text: 'Luna AI • Developed by s4ory' })
        .setTimestamp();
      
      if (category === 'all') {
        helpEmbed.setDescription('Danh sách tất cả các danh mục lệnh có sẵn:');
        
        for (const folder of visibleCategories) {
          const folderPath = path.join(commandsPath, folder);
          const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
          
          // Tạo danh sách lệnh trong danh mục
          const commandList = commandFiles.map(file => {
            const command = require(path.join(folderPath, file));
            return `\`/${command.data.name}\` - ${command.data.description}`;
          }).join('\n');
          
          helpEmbed.addFields({
            name: `${getCategoryEmoji(folder)} ${capitalizeFirstLetter(folder)}`,
            value: commandList || 'Không có lệnh nào trong danh mục này.',
          });
        }
      } else {
        // Hiển thị lệnh trong danh mục cụ thể
        const folderPath = path.join(commandsPath, category);
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        
        helpEmbed.setDescription(`Chi tiết các lệnh trong danh mục **${capitalizeFirstLetter(category)}**:`);
        
        for (const file of commandFiles) {
          const command = require(path.join(folderPath, file));
          
          // Lấy thông tin về các tùy chọn của lệnh
          let optionsInfo = '';
          if (command.data.options && command.data.options.length > 0) {
            optionsInfo = command.data.options.map(option => {
              const required = option.required ? '(bắt buộc)' : '(tùy chọn)';
              return `• \`${option.name}\`: ${option.description} ${required}`;
            }).join('\n');
          }
          
          helpEmbed.addFields({
            name: `/${command.data.name}`,
            value: `${command.data.description}\n${optionsInfo || 'Không có tùy chọn.'}`
          });
        }
      }
      
      await i.update({ embeds: [helpEmbed], components: [row] });
    });
    
    collector.on('end', collected => {
      try {
        // Vô hiệu hóa menu khi hết thời gian
        const disabledRow = new ActionRowBuilder().addComponents(
          select.setDisabled(true)
        );
        
        if (collected.size === 0) {
          interaction.editReply({ 
            content: 'Menu trợ giúp đã hết hạn. Sử dụng `/help` để tạo menu mới.', 
            components: [disabledRow] 
          });
        } else {
          // Chỉ vô hiệu hóa menu
          interaction.editReply({
            components: [disabledRow]
          });
        }
      } catch (error) {
        console.error('Error when disabling the help menu:', error);
      }
    });
  },
};

// Hàm hỗ trợ viết hoa chữ cái đầu
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Hàm lấy emoji tương ứng cho mỗi danh mục
function getCategoryEmoji(category) {
  const emojis = {
    'moderation': '🛡️',
    'info': 'ℹ️',
    'ai': '🤖',
    'setting': '⚙️',
    'fun': '🎮',
    'utility': '🔧'
  };
  
  return emojis[category] || '📁';
}
