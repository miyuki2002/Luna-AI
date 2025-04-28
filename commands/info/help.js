const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Hiển thị danh sách lệnh và thông tin trợ giúp')
    .addStringOption(option => 
      option.setName('category')
        .setDescription('Danh mục lệnh cần xem')
        .setRequired(false)
        .addChoices(
          { name: 'Moderation', value: 'moderation' },
          { name: 'Info', value: 'info' },
          { name: 'AI', value: 'ai' },
          { name: 'Setting', value: 'setting' },
          { name: 'Tất cả', value: 'all' }
        )),

  async execute(interaction) {
    const category = interaction.options.getString('category') || 'all';
    
    // Tạo embed cơ bản
    const helpEmbed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('📚 Trợ giúp lệnh')
      .setFooter({ text: 'Sử dụng /help [category] để xem chi tiết từng danh mục' })
      .setTimestamp();
    
    // Đọc các thư mục lệnh
    const commandsPath = path.join(__dirname, '../');
    const commandFolders = fs.readdirSync(commandsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    // Nếu chọn xem tất cả danh mục
    if (category === 'all') {
      helpEmbed.setDescription('Danh sách tất cả các danh mục lệnh có sẵn:');
      
      for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        
        // Tạo danh sách lệnh trong danh mục
        const commandList = commandFiles.map(file => {
          const command = require(path.join(folderPath, file));
          return `\`/${command.data.name}\` - ${command.data.description}`;
        }).join('\n');
        
        helpEmbed.addFields({
          name: `📁 ${folder.charAt(0).toUpperCase() + folder.slice(1)}`,
          value: commandList || 'Không có lệnh nào trong danh mục này.',
        });
      }
    } else {
      // Nếu chọn xem một danh mục cụ thể
      if (!commandFolders.includes(category)) {
        return interaction.reply({
          content: `Danh mục \`${category}\` không tồn tại.`,
          ephemeral: true
        });
      }
      
      const folderPath = path.join(commandsPath, category);
      const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
      
      helpEmbed.setDescription(`Chi tiết các lệnh trong danh mục **${category.charAt(0).toUpperCase() + category.slice(1)}**:`);
      
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
    
    await interaction.reply({ embeds: [helpEmbed] });
  },
};
