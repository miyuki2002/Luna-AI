const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const slashCommandIntegration = require('../../services/SlashCommandIntegrationService');
const logger = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban_new')
    .setDescription('Ban một thành viên khỏi server (Guild Agent)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Thành viên cần ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Lý do ban')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('Số ngày xóa tin nhắn (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    try {
      // Use SlashCommandIntegrationService
      const options = {
        user: interaction.options.getUser('user'),
        reason: interaction.options.getString('reason'),
        days: interaction.options.getInteger('days')
      };

      const result = await slashCommandIntegration.handleSlashCommand(
        interaction, 
        'ban', 
        options
      );

      // Log command usage
      slashCommandIntegration.addCommandToHistory(interaction.user.id, {
        command: 'ban',
        target: options.user?.tag,
        reason: options.reason,
        success: result.success
      });

    } catch (error) {
      logger.error('BAN_COMMAND', 'Error in ban command:', error);
      await interaction.editReply({ 
        content: `❌ Lỗi khi thực hiện lệnh ban: ${error.message}` 
      });
    }
  }
};
