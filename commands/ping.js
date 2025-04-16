const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Kiểm tra độ trễ và tình trạng hoạt động của bot'),
	
	async execute(interaction) {
		// Gửi phản hồi ban đầu để đo độ trễ
		const sent = await interaction.reply({ 
			content: '📡 Đang kiểm tra kết nối...', 
			fetchReply: true 
		});

		// Tính toán độ trễ
		const pingLatency = sent.createdTimestamp - interaction.createdTimestamp;
		const apiLatency = Math.round(interaction.client.ws.ping);
		
		// Xác định tình trạng kết nối dựa trên độ trễ
		let connectionStatus;
		if (pingLatency < 200) {
			connectionStatus = '🟢 Tuyệt vời';
		} else if (pingLatency < 400) {
			connectionStatus = '🟡 Ổn định';
		} else {
			connectionStatus = '🔴 Chậm';
		}

		// Chỉnh sửa phản hồi với thông tin đầy đủ
		await interaction.editReply({
			content: `### Thông tin độ trễ của Luna Bot\n` +
					`🏓 Pong!\n` +
					`⏱️ Độ trễ: **${pingLatency}ms** (${connectionStatus})\n` +
					`📶 API: **${apiLatency}ms**\n` +
					`💓 Bot đang hoạt động và sẵn sàng phục vụ!`
		});
	},
};
