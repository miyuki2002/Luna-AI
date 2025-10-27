const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const AutoUpdateService = require('../../services/AutoUpdateService');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('update')
        .setDescription('Kiểm tra và cập nhật bot từ GitHub (chỉ dành cho owner)'),
    
    async execute(interaction) {
        const ownerId = process.env.OWNER_ID;
        if (interaction.user.id !== ownerId) {
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('Không có quyền')
                .setDescription('Bạn không có quyền sử dụng lệnh này!')
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const autoUpdateService = new AutoUpdateService();  
            const currentVersion = autoUpdateService.getCurrentVersion();

            logger.info('SYSTEM', `Manual update triggered by ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setColor('#4ECDC4')
                .setTitle('Kiểm tra cập nhật')
                .addFields([
                    { name: 'Version hiện tại', value: `v${currentVersion}`, inline: true },
                    { name: 'Trạng thái', value: 'Đang kiểm tra...', inline: true }
                ])
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            const isGitRepo = await autoUpdateService.isGitRepository();
            if (!isGitRepo) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('Cảnh báo')
                    .setDescription('Không phải Git repository, không thể auto-update!')
                    .setTimestamp();
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            const hasUpdate = await autoUpdateService.checkAndUpdate();

            if (hasUpdate) {
                const successEmbed = new EmbedBuilder()
                    .setColor('#4ECDC4')
                    .setTitle('Cập nhật thành công')
                    .setDescription('Đã phát hiện và cập nhật version mới!\nBot sẽ restart trong giây lát...')
                    .addFields([
                        { name: 'Version cũ', value: `v${currentVersion}`, inline: true },
                        { name: 'Trạng thái', value: 'Đang restart...', inline: true }
                    ])
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });
            } else {
                const upToDateEmbed = new EmbedBuilder()
                    .setColor('#4ECDC4')
                    .setTitle('Đã cập nhật')
                    .setDescription('Bot đã ở version mới nhất!')
                    .addFields([
                        { name: 'Version hiện tại', value: `v${currentVersion}`, inline: true },
                        { name: 'Trạng thái', value: 'Up-to-date', inline: true }
                    ])
                    .setTimestamp();

                await interaction.editReply({ embeds: [upToDateEmbed] });
            }

        } catch (error) {
            logger.error('SYSTEM', `Manual update error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('Lỗi cập nhật')
                .setDescription('Đã xảy ra lỗi khi kiểm tra cập nhật!')
                .addFields([
                    { name: 'Lỗi', value: `\`\`\`${error.message}\`\`\``, inline: false }
                ])
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};
