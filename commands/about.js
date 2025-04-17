const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const NeuralNetworks = require('../services/NeuralNetworks');
const os = require('os');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('about')
		.setDescription('Hiển thị thông tin chi tiết về Luna bot'),
	
	async execute(interaction) {
		// Lấy thông tin về model từ NeuralNetworks
		const modelName = NeuralNetworks.Model;
		
		// Tính thời gian hoạt động của bot
		const uptime = process.uptime();
		const days = Math.floor(uptime / 86400);
		const hours = Math.floor((uptime % 86400) / 3600);
		const minutes = Math.floor((uptime % 3600) / 60);
		const uptimeString = `${days}d ${hours}h ${minutes}m`;
		
		// Lấy thông tin hệ thống
		const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
		const serverCount = interaction.client.guilds.cache.size;
		
		// Tạo embed đẹp mắt và gọn gàng hơn
		const aboutEmbed = new EmbedBuilder()
			.setColor(0xd580ff)  // Màu tím nhạt hơn và đẹp mắt
			.setTitle('✨ Luna AI - Trợ lý thông minh của bạn')
			.setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 }))
			.setDescription('*Luna là trợ lý AI thân thiện và dễ thương, luôn sẵn sàng trò chuyện và giúp đỡ bạn với khả năng trí tuệ nhân tạo tiên tiến.*')
			.addFields(
				{ 
					name: '🤖 **Thông tin kỹ thuật**', 
					value: `• Model: **${modelName}**\n• Runtime: **${uptimeString}**\n• Servers: **${serverCount}**\n• Memory: **${memoryUsage} MB**`,
					inline: true
				},
				{
					name: '🌟 **Tính năng chính**',
					value: '• **Trò chuyện** thông minh (mention @Luna)\n• **Tạo hình ảnh** AI (vẽ/tạo hình)\n• **Hỗ trợ lập trình** và giải quyết vấn đề\n• **Đa ngôn ngữ** (Tiếng Việt & English)',
					inline: true
				},
				{
					name: '📋 **Lệnh hữu ích**',
					value: '• `@Luna [tin nhắn]` - Trò chuyện\n• `vẽ [mô tả]` - Tạo hình ảnh AI\n• `/ping` - Kiểm tra trạng thái\n• `xóa lịch sử` - Đặt lại cuộc trò chuyện',
				}
			)
			.setImage('https://i.imgur.com/KCtaQTH.png') // Banner image - thay bằng URL của bạn
			.setFooter({ 
				text: `Luna Bot v1.0.0 • Node ${process.version}`, 
				iconURL: 'https://i.imgur.com/xEhZnPu.png'  // Logo nhỏ - thay bằng URL của bạn
			})
			.setTimestamp();

		// Các nút tương tác được thiết kế đẹp mắt hơn
		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setLabel('✉️ Mời Luna')
				.setURL(`https://discord.com/api/oauth2/authorize?client_id=${interaction.client.user.id}&permissions=8&scope=bot%20applications.commands`)
				.setStyle(ButtonStyle.Link),
				
			new ButtonBuilder()
				.setLabel('🔍 Tài liệu')
				.setURL('https://lunabot.art/docs')
				.setStyle(ButtonStyle.Link),
				
			new ButtonBuilder()
				.setLabel('💬 Hỗ trợ')
				.setURL('https://discord.gg/52hSMAt')
				.setStyle(ButtonStyle.Link),
				
			new ButtonBuilder()
				.setLabel('🌐 Website')
				.setURL('https://lunabot.art')
				.setStyle(ButtonStyle.Link)
		);

		// Phản hồi với embed và các nút
		await interaction.reply({ 
			embeds: [aboutEmbed], 
			components: [row],
			flags: []
		});
	},
};
