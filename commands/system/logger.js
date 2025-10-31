const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger.js');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logger')
    .setDescription('Quản lý cài đặt hệ thống ghi log (chỉ dành cho owner)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Xem trạng thái hiện tại của hệ thống ghi log')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Bật hệ thống ghi log')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Tắt hệ thống ghi log')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('level')
        .setDescription('Đặt mức độ ghi log')
        .addStringOption(option =>
          option.setName('level')
            .setDescription('Mức độ ghi log')
            .setRequired(true)
            .addChoices(
              { name: 'Debug - Chi tiết nhất', value: 'debug' },
              { name: 'Info - Thông tin chung', value: 'info' },
              { name: 'Warning - Cảnh báo', value: 'warn' },
              { name: 'Error - Lỗi', value: 'error' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('category')
        .setDescription('Bật/tắt ghi log cho một danh mục')
        .addStringOption(option =>
          option.setName('category')
            .setDescription('Danh mục ghi log')
            .setRequired(true)
            .addChoices(
              { name: 'MONITOR - Hệ thống giám sát tin nhắn', value: 'MONITOR' },
              { name: 'NEURAL - Hệ thống AI/NeuralNetworks', value: 'NEURAL' },
              { name: 'COMMAND - Xử lý lệnh', value: 'COMMAND' },
              { name: 'DATABASE - Thao tác cơ sở dữ liệu', value: 'DATABASE' },
              { name: 'SYSTEM - Thông tin hệ thống', value: 'SYSTEM' },
              { name: 'CHAT - Chức năng trò chuyện', value: 'CHAT' },
              { name: 'API - Gọi API', value: 'API' }
            )
        )
        .addBooleanOption(option =>
          option.setName('enabled')
            .setDescription('Bật/tắt ghi log cho danh mục')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset')
        .setDescription('Khôi phục cài đặt ghi log về mặc định')
    ),

  async execute(interaction) {
    const ownerId = process.env.OWNER_ID;
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ 
        content: 'Bạn không có quyền sử dụng lệnh này!', 
        ephemeral: true 
      });
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'status': {
        const config = logger.getConfig();
        const categories = Object.entries(config.categories)
          .map(([category, enabled]) => `${category}: ${enabled ? '✅' : '❌'}`)
          .join('\n');

        await interaction.reply({
          content: `**Trạng thái hệ thống ghi log:**\n` +
            `Trạng thái: ${config.enabled ? '✅ Đang bật' : '❌ Đã tắt'}\n` +
            `Mức độ: ${config.level.toUpperCase()}\n` +
            `Hiển thị thời gian: ${config.showTimestamp ? '✅' : '❌'}\n\n` +
            `**Danh mục:**\n${categories}`,
          ephemeral: true
        });
        break;
      }

      case 'enable': {
        logger.setEnabled(true);
        await interaction.reply({
          content: '✅ Đã bật hệ thống ghi log',
          ephemeral: true
        });
        break;
      }

      case 'disable': {
        logger.setEnabled(false);
        await interaction.reply({
          content: '❌ Đã tắt hệ thống ghi log',
          ephemeral: true
        });
        break;
      }

      case 'level': {
        const level = interaction.options.getString('level');
        logger.setLevel(level);
        await interaction.reply({
          content: `✅ Đã đặt mức độ ghi log thành: ${level.toUpperCase()}`,
          ephemeral: true
        });
        break;
      }

      case 'category': {
        const category = interaction.options.getString('category');
        const enabled = interaction.options.getBoolean('enabled');
        logger.setCategoryEnabled(category, enabled);
        await interaction.reply({
          content: `✅ Đã ${enabled ? 'bật' : 'tắt'} ghi log cho danh mục: ${category}`,
          ephemeral: true
        });
        break;
      }

      case 'reset': {
        logger.resetConfig();
        await interaction.reply({
          content: '✅ Đã khôi phục cài đặt ghi log về mặc định',
          ephemeral: true
        });
        break;
      }
    }
  },
};
