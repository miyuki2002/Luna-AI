const storageDB = require('../services/storagedb.js');
const ProfileDB = require('../services/profiledb.js');
const logger = require('../utils/logger.js');
require('dotenv').config();

async function handleResetdbInteraction(interaction) {
  if (!interaction.isButton()) return;

  const { customId, user } = interaction;
  const ownerId = process.env.OWNER_ID;

  if (user.id !== ownerId) {
    return interaction.reply({
      content: 'Bạn không có quyền thực hiện hành động này!',
      ephemeral: true,
    });
  }

  try {
    if (customId === 'resetdb_confirm') {
      await interaction.deferReply({ ephemeral: true });

      logger.info('RESETDB', `Owner ${user.tag} đã xác nhận reset database`);

      const success = await storageDB.resetDatabase();

      if (success) {
        await interaction.editReply({
          content:
            '✅ **Đã reset database thành công!**\n\n' +
            '> Tất cả dữ liệu đã được xóa\n' +
            '> Database đã được tạo lại\n' +
            '> Bot sẽ không còn nhớ cuộc trò chuyện trước đây\n\n' +
            '**Hệ thống đã sẵn sàng sử dụng!**',
          components: [],
        });

        logger.info('RESETDB', 'Database đã được reset thành công');
      } else {
        await interaction.editReply({
          content:
            '❌ **Lỗi khi reset database!**\n\n' +
            '> Có lỗi xảy ra trong quá trình reset\n' +
            '> Vui lòng kiểm tra logs để biết thêm chi tiết\n' +
            '> Liên hệ admin nếu vấn đề tiếp tục',
          components: [],
        });

        logger.error('RESETDB', 'Lỗi khi reset database');
      }
    } else if (customId === 'resetdb_cancel') {
      await interaction.update({
        content:
          '❌ **Đã hủy reset database!**\n\n' +
          '> Không có thay đổi nào được thực hiện\n' +
          '> Database vẫn giữ nguyên\n' +
          '> Tất cả dữ liệu được bảo toàn\n\n' +
          '**Hệ thống hoạt động bình thường!**',
        components: [],
      });

      logger.info('RESETDB', `Owner ${user.tag} đã hủy reset database`);
    } else if (customId === 'resetuser_confirm') {
      await interaction.deferReply({ ephemeral: true });

      logger.info(
        'RESETUSER',
        `Owner ${user.tag} đã xác nhận reset user database`,
      );

      try {
        const profileCollection = await ProfileDB.getProfileCollection();
        const result = await profileCollection.deleteMany({});

        await interaction.editReply({
          content:
            '✅ **Đã reset user database thành công!**\n\n' +
            `> Đã xóa ${result.deletedCount} user profiles\n` +
            '> Tất cả XP, level, achievements đã bị xóa\n' +
            '> Users sẽ phải đồng ý consent lại\n' +
            '> Hệ thống đã sẵn sàng cho users mới\n\n' +
            '**User database đã được reset hoàn toàn!**',
          components: [],
        });

        logger.info('RESETUSER', `Đã xóa ${result.deletedCount} user profiles`);
      } catch (error) {
        await interaction.editReply({
          content:
            '❌ **Lỗi khi reset user database!**\n\n' +
            '> Có lỗi xảy ra trong quá trình reset\n' +
            '> Vui lòng kiểm tra logs để biết thêm chi tiết\n' +
            '> Liên hệ admin nếu vấn đề tiếp tục',
          components: [],
        });

        logger.error('RESETUSER', 'Lỗi khi reset user database:', error);
      }
    } else if (customId === 'resetuser_cancel') {
      await interaction.update({
        content:
          '❌ **Đã hủy reset user database!**\n\n' +
          '> Không có thay đổi nào được thực hiện\n' +
          '> User profiles vẫn giữ nguyên\n' +
          '> Tất cả dữ liệu users được bảo toàn\n\n' +
          '**Hệ thống hoạt động bình thường!**',
        components: [],
      });

      logger.info('RESETUSER', `Owner ${user.tag} đã hủy reset user database`);
    }
  } catch (error) {
    logger.error('RESETDB', `Lỗi khi xử lý resetdb interaction:`, error);

    try {
      await interaction.followUp({
        content: '❌ Có lỗi xảy ra khi xử lý yêu cầu. Vui lòng thử lại sau!',
        ephemeral: true,
      });
    } catch (followUpError) {
      logger.error('RESETDB', 'Lỗi khi gửi follow-up message:', followUpError);
    }
  }
}

module.exports = {
  handleResetdbInteraction,
};
