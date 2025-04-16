const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const grokClient = require('../services/grokClient');
const os = require('os');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('about')
		.setDescription('Hiển thị thông tin chi tiết về Luna bot'),
	
	async execute(interaction) {
		// Lấy thông tin về model từ grokClient - fix method name
		const modelName = grokClient.displayModelName;
		
		// Tính thời gian hoạt động của bot
		const uptime = process.uptime();
		const days = Math.floor(uptime / 86400);
		const hours = Math.floor((uptime % 86400) / 3600);
		const minutes = Math.floor((uptime % 3600) / 60);
		const uptimeString = `${days} ngày, ${hours} giờ, ${minutes} phút`;
		
		// Lấy thông tin hệ thống
		const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
		const serverCount = interaction.client.guilds.cache.size;
		
		// Tạo embed để hiển thị thông tin
		const aboutEmbed = new EmbedBuilder()
			.setColor(0xb967ff)  // Màu tím nhẹ
			.setTitle('🌙 Giới thiệu về Luna Bot')
			.setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }))
			.setDescription('Luna là bot trợ lý AI tiên tiến với tính cách thân thiện và dễ thương, được thiết kế để trò chuyện tự nhiên và hỗ trợ bạn trong nhiều tác vụ khác nhau với giao diện thân thiện và trực quan.')
			.addFields(
				{ 
					name: '🤖 Thông tin kỹ thuật', 
					value: `• **Model AI**: ${modelName}\n• **Nền tảng**: X.AI (Grok)\n• **Ngôn ngữ chính**: Vietnamese, English`
				},
				{
					name: '📊 Hiệu năng',
					value: `• **Uptime**: ${uptimeString}\n• **Memory**: ${memoryUsage} MB\n• **Servers**: ${serverCount}\n• **Node.js**: ${process.version}`
				},
				{
					name: '💬 Tính năng trò chuyện',
					value: '• Trò chuyện tự nhiên với Luna bằng cách mention (@Luna)\n• Duy trì ngữ cảnh cuộc hội thoại\n• Trả lời thông minh và thân thiện\n• Hỗ trợ tiếng Việt và tiếng Anh'
				},
				{
					name: '🖼️ Tạo hình ảnh AI',
					value: '• Sử dụng lệnh "**vẽ [mô tả]**" để tạo hình ảnh\n• Hỗ trợ nhiều phong cách và chủ đề\n• Tạo hình ảnh chất lượng cao từ mô tả văn bản'
				},
				{
					name: '💻 Hỗ trợ lập trình',
					value: '• Tạo mã nguồn từ mô tả yêu cầu\n• Giải thích mã nguồn hiện có\n• Gỡ lỗi và tối ưu hóa mã'
				},
				{
					name: '📝 Lệnh hữu ích',
					value: '• `/ping` - Kiểm tra độ trễ và trạng thái hoạt động\n• `/about` - Xem thông tin này\n• `/help` - Xem danh sách lệnh đầy đủ\n• `@Luna [tin nhắn]` - Trò chuyện với Luna\n• `xóa lịch sử` - Xóa lịch sử hội thoại'
				},
				{
					name: '🛠️ Quản lý lịch sử',
					value: 'Luna có thể lưu trữ và ghi nhớ ngữ cảnh cuộc trò chuyện để tạo trải nghiệm mượt mà và liên tục. Để xóa lịch sử hội thoại của bạn, chỉ cần gửi tin nhắn "**xóa lịch sử**" hoặc "**reset conversation**".'
				},
				{
					name: '👨‍💻 Nhà phát triển',
					value: 'Luna được phát triển bởi s4ory, với mục tiêu tạo ra một trải nghiệm AI thân thiện và hữu ích cho cộng đồng Discord.'
				},
				{
					name: '🔗 Liên kết & Tài nguyên',
					value: '[GitHub](https://gitlab.com/s4ory/luna) | [Báo cáo lỗi](https://gitlab.com/s4ory/luna/-/issues) | [Website](https://luna.dev)'
				}
			)
			.setFooter({ text: 'Luna Bot v1.0.0' })
			.setTimestamp();

		// Tạo các nút tương tác
		const supportButton = new ButtonBuilder()
			.setLabel('Hỗ trợ')
			.setURL('https://discord.gg/52hSMAt')
			.setStyle(ButtonStyle.Link);
			
		const inviteButton = new ButtonBuilder()
			.setLabel('Thêm Luna vào server')
			.setURL(`https://discord.com/api/oauth2/authorize?client_id=${interaction.client.user.id}&permissions=8&scope=bot%20applications.commands`)
			.setStyle(ButtonStyle.Link);
			
		const docsButton = new ButtonBuilder()
			.setLabel('Tài liệu')
			.setURL('https://luna.dev/docs')
			.setStyle(ButtonStyle.Link);

		const row = new ActionRowBuilder().addComponents(supportButton, inviteButton, docsButton);

		// Phản hồi với embed và các nút - update deprecated option
		await interaction.reply({ 
			embeds: [aboutEmbed], 
			components: [row], 
			flags: [] // Modern approach - empty array means not ephemeral
		});
	},
};
