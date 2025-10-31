const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetuserdb')
    .setDescription('Xóa tất cả user profiles (chỉ dành cho owner)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const ownerId = process.env.OWNER_ID;
    
    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: 'Bạn không có quyền sử dụng lệnh này!',
        ephemeral: true,
      });
    }

    const confirmButton = new ButtonBuilder()
      .setCustomId('resetuser_confirm')
      .setLabel('Đồng ý')
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId('resetuser_cancel')
      .setLabel('Từ chối')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    const warningMessage = [
      '⚠️ **XÁC NHẬN RESET USER DATABASE** ⚠️',
      '',
      'Bạn có chắc chắn muốn xóa tất cả user profiles không?',
      '',
      '**Cảnh báo:**',
      '> Tất cả user profiles sẽ bị xóa vĩnh viễn',
      '> Không thể khôi phục sau khi reset',
      '> Tất cả XP, level, achievements sẽ mất',
      '> Users sẽ phải đồng ý consent lại',
      '',
      '**Hành động này không thể hoàn tác!**',
    ].join('\n');

    await interaction.reply({
      content: warningMessage,
      components: [row],
      ephemeral: true,
    });
  },
};
