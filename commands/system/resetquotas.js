const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const MessageService = require('../../services/TokenService.js');
const logger = require('../../utils/logger.js');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetquotas')
    .setDescription('Reset lượt nhắn tin cho người dùng (chỉ dành cho owner)')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Người dùng cần reset lượt nhắn tin đã sử dụng')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Loại reset')
        .setRequired(true)
        .addChoices(
          { name: 'Hàng ngày', value: 'daily' },
          { name: 'Hàng tuần', value: 'weekly' },
          { name: 'Hàng tháng', value: 'monthly' },
          { name: 'Tất cả', value: 'all' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const ownerId = process.env.OWNER_ID;
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ 
        content: 'Bạn không có quyền sử dụng lệnh này!', 
        ephemeral: true 
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const targetUser = interaction.options.getUser('user');
      const resetType = interaction.options.getString('type');

      await MessageService.resetUserMessages(targetUser.id, resetType);

      const stats = await MessageService.getUserMessageStats(targetUser.id);

      const resetTypeNames = {
        daily: 'hàng ngày',
        weekly: 'hàng tuần',
        monthly: 'hàng tháng',
        all: 'tất cả'
      };

      const embed = new EmbedBuilder()
        .setTitle('Reset lượt nhắn tin đã sử dụng thành công')
        .setColor('#00ff00')
        .addFields(
          { name: 'Người dùng', value: `${targetUser.tag}`, inline: true },
          { name: 'Loại reset', value: resetTypeNames[resetType], inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: 'Lượt hôm nay', value: `${stats.usage.daily.toLocaleString()} lượt`, inline: true },
          { name: 'Lượt tuần này', value: `${stats.usage.weekly.toLocaleString()} lượt`, inline: true },
          { name: 'Lượt tháng này', value: `${stats.usage.monthly.toLocaleString()} lượt`, inline: true }
        )
        .setFooter({ text: `Được thực hiện bởi ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      logger.info('ADMIN', `${interaction.user.tag} reset ${resetType} lượt nhắn tin đã sử dụng cho ${targetUser.tag}`);
    } catch (error) {
      logger.error('ADMIN', 'Lỗi khi reset lượt nhắn tin đã sử dụng:', error);
      await interaction.editReply({
        content: `Lỗi khi reset lượt nhắn tin đã sử dụng: ${error.message}`,
        ephemeral: true
      });
    }
  },
};

