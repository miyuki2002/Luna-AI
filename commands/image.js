const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Tạo một hình ảnh dựa trên mô tả của bạn')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Mô tả hình ảnh bạn muốn tạo')
        .setRequired(true)),
  
  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');
    
    await interaction.deferReply();
    
    try {
      // Tại đây bạn sẽ gọi dịch vụ tạo hình ảnh của bạn
      // Hiện tại, chúng ta chỉ mô phỏng một phản hồi
      await new Promise(resolve => setTimeout(resolve, 3000)); // Mô phỏng thời gian xử lý
      
      await interaction.editReply(`Đã tạo hình ảnh cho: "${prompt}"\n(Chức năng tạo hình ảnh sẽ được triển khai sau)`);
    } catch (error) {
      console.error('Lỗi khi tạo hình ảnh:', error);
      await interaction.editReply('Xin lỗi, đã xảy ra lỗi khi tạo hình ảnh của bạn.');
    }
  },
};
