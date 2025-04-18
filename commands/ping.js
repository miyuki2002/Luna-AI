const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const NeuralNetworks = require('../services/NeuralNetworks');
const mongoClient = require('../services/mongoClient');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Kiểm tra độ trễ và trạng thái kết nối của bot'),
	
	async execute(interaction) {
		// Đo thời gian phản hồi ban đầu
		const sent = await interaction.deferReply({ fetchReply: true });
		const pingLatency = sent.createdTimestamp - interaction.createdTimestamp;
		
		// Kiểm tra độ trễ WebSocket API của Discord
		const wsLatency = interaction.client.ws.ping;

		// Kiểm tra kết nối đến MongoDB
		let mongoStatus = "Đang kiểm tra...";
		try {
			const startTime = Date.now();
			await mongoClient.ping();
			const mongoLatency = Date.now() - startTime;
			mongoStatus = `🟢 Kết nối (${mongoLatency}ms)`;
		} catch (error) {
			mongoStatus = "🔴 Ngắt kết nối";
		}

		// Kiểm tra kết nối đến X.AI API
		let aiStatus = "Đang kiểm tra...";
		try {
			const startTime = Date.now();
			const connected = await NeuralNetworks.testConnection();
			const aiLatency = Date.now() - startTime;
			aiStatus = connected ? `🟢 Kết nối (${aiLatency}ms)` : "🟠 Lỗi";
		} catch (error) {
			aiStatus = "🔴 Ngắt kết nối";
		}

		// Tạo một embed đẹp mắt với thông tin về độ trễ và trạng thái
		const statusEmbed = new EmbedBuilder()
			.setColor(0x00bfff)
			.setTitle('📊 Thông tin độ trễ và trạng thái')
			.addFields(
				{ 
					name: '🤖 Bot', 
					value: `⌛ Độ trễ: ${pingLatency}ms\n📡 WebSocket: ${wsLatency}ms`, 
					inline: false 
				},
				{ 
					name: '📦 Cơ sở dữ liệu', 
					value: mongoStatus, 
					inline: true 
				},
				{ 
					name: '🧠 AI Service', 
					value: aiStatus, 
					inline: true 
				}
			)
			.setFooter({ 
				text: `Luna Bot v1.0.0 • ${getNiceUptime(process.uptime())}`,
			})
			.setTimestamp();

		await interaction.editReply({ embeds: [statusEmbed] });
	},
};

/**
 * Chuyển đổi thời gian hoạt động (giây) thành định dạng dễ đọc
 * @param {number} uptime - Thời gian hoạt động tính bằng giây
 * @returns {string} - Chuỗi thời gian định dạng dễ đọc
 */
function getNiceUptime(uptime) {
	const days = Math.floor(uptime / 86400);
	const hours = Math.floor((uptime % 86400) / 3600);
	const minutes = Math.floor((uptime % 3600) / 60);
	
	let uptimeString = '';
	
	if (days > 0) {
		uptimeString += `${days}d `;
	}
	
	if (hours > 0 || days > 0) {
		uptimeString += `${hours}h `;
	}
	
	uptimeString += `${minutes}m`;
	
	return `Uptime: ${uptimeString}`;
}
