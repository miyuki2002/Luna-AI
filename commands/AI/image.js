const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const NeuralNetworks = require('../../services/NeuralNetworks');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Vẽ một hình ảnh từ trí tưởng tượng của bạn')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Hãy mô tả bức tranh bạn muốn tôi vẽ')
        .setRequired(true)),

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');

    try {
      // Truyền đối tượng interaction vào generateImage để hiển thị tiến trình
      const imageResult = await NeuralNetworks.generateImage(prompt, interaction);
      const attachment = new AttachmentBuilder(imageResult.buffer, { name: 'generated-image.png' });
      let replyContent = `🎨 Bức tranh theo ý bạn.\n\n > "${prompt}"`;
      
      await interaction.followUp({
        content: replyContent,
        files: [attachment]
      });
    } catch (error) {
      logger.error('COMMAND', 'Lỗi khi tạo hình ảnh:', error);
      
    }
  },
};
