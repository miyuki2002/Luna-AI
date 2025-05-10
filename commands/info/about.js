const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const NeuralNetworks = require('../../services/NeuralNetworks');
const { formatUptime } = require('../../utils/string');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const os = require('os');
const fs = require('fs');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('about')
		.setDescription('Hiển thị thông tin chi tiết về Luna bot'),
	
	async execute(interaction) {
		await interaction.deferReply();
		
		try {
			// Lấy thông tin cơ bản
			const modelName = NeuralNetworks.Model || "Anthropic Claude";
			const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
			const serverCount = interaction.client.guilds.cache.size;
			const userCount = interaction.client.users.cache.size;
			
			// Tạo canvas cho thẻ thông tin với kích thước nhỏ hơn để giảm tải
			const canvas = createCanvas(900, 500);
			const ctx = canvas.getContext('2d');
			
			// Nền đơn giản để tránh lỗi gradient trên một số máy chủ
			ctx.fillStyle = '#1e1e2e';
			ctx.fillRect(0, 0, 900, 500);
			
			// Vẽ viền
			ctx.strokeStyle = 'rgba(155, 89, 182, 0.5)';
			ctx.lineWidth = 2;
			ctx.strokeRect(10, 10, 880, 480);
			
			// Vẽ đường trang trí đơn giản
			ctx.strokeStyle = '#9B59B6';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(50, 130);
			ctx.lineTo(850, 130);
			ctx.stroke();
			
			ctx.beginPath();
			ctx.moveTo(50, 370);
			ctx.lineTo(850, 370);
			ctx.stroke();
			
			// Load và vẽ ảnh Luna
			let avatarImage;
			try {
				// Thử tải từ URL thay vì từ file để tránh lỗi file system
				avatarImage = await loadImage(interaction.client.user.displayAvatarURL({ extension: 'png', size: 256 }));
			} catch (error) {
				console.error('Error loading avatar:', error);
				// Không xử lý lỗi ở đây, chỉ không hiển thị avatar
			}
			
			// Vẽ avatar nếu tải được
			if (avatarImage) {
				// Vẽ avatar đơn giản không cần clip path để tránh lỗi
				ctx.drawImage(avatarImage, 50, 50, 70, 70);
			}
			
			// Tên bot - sử dụng font hệ thống
			ctx.font = 'bold 40px Sans';
			ctx.fillStyle = '#FFFFFF';
			ctx.fillText('Luna AI', 140, 85);
			
			// Mô tả
			ctx.font = '20px Sans';
			ctx.fillStyle = '#AE86FD';
			ctx.fillText('Trợ lý AI thông minh của bạn', 140, 110);
			
			// Vẽ khung thông tin kỹ thuật
			drawSimpleInfoBox(ctx, 50, 150, 380, 200, 'Thông tin kỹ thuật', [
				{ icon: '[AI]', label: 'Model AI', value: modelName },
				{ icon: '[⏰]', label: 'Uptime', value: formatUptime(process.uptime(), false) },
				{ icon: '[JS]', label: 'Node', value: process.version },
				{ icon: '[MB]', label: 'Memory', value: `${memoryUsage} MB` },
				{ icon: '[#]', label: 'Servers', value: serverCount.toString() }
			]);
			
			// Vẽ khung tính năng
			drawSimpleInfoBox(ctx, 450, 150, 400, 200, 'Tính năng', [
				{ icon: '[>]', label: 'Trò chuyện AI', value: 'Mention @Luna' },
				{ icon: '[+]', label: 'Tạo hình ảnh', value: 'vẽ [mô tả]' },
				{ icon: '[<>]', label: 'Lập trình', value: 'code [yêu cầu]' },
				{ icon: '[x]', label: 'Quản lý tin nhắn', value: 'xóa lịch sử' }
			]);
			
			// Thông tin liên hệ
			ctx.font = 'bold 24px Sans';
			ctx.fillStyle = '#FFFFFF';
			const contactText = 'Liên hệ & Hỗ trợ';
			const contactWidth = ctx.measureText(contactText).width;
			ctx.fillText(contactText, 450 - contactWidth / 2, 400);
			
			// Footer
			ctx.font = '16px Sans';
			ctx.fillStyle = '#94A1B2';
			const footerText = `Luna Bot v1.0.2 • Developed by s4ory • ${new Date().toISOString().split('T')[0]}`;
			const footerWidth = ctx.measureText(footerText).width;
			ctx.fillText(footerText, 450 - footerWidth / 2, 470);
			
			// Tạo attachment từ canvas
			const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'about-luna.png' });
			
			// Tạo embed đơn giản để hiển thị ảnh
			const aboutEmbed = new EmbedBuilder()
				.setColor(0x9B59B6)
				.setImage('attachment://about-luna.png')
				.setFooter({ text: 'Sử dụng các nút bên dưới để tìm hiểu thêm về Luna' });
			
			// Các nút tương tác
			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setLabel('Mời Luna')
					.setEmoji('✉️')
					.setURL(`https://discord.com/api/oauth2/authorize?client_id=${interaction.client.user.id}&permissions=8&scope=bot%20applications.commands`)
					.setStyle(ButtonStyle.Link),
					
				new ButtonBuilder()
					.setLabel('Tài liệu')
					.setEmoji('📚')
					.setURL('https://github.com/miyuki2002/Luna-AI')
					.setStyle(ButtonStyle.Link),
					
				new ButtonBuilder()
					.setLabel('Hỗ trợ')
					.setEmoji('💬')
					.setURL('https://discord.gg/52hSMAt')
					.setStyle(ButtonStyle.Link),
					
				new ButtonBuilder()
					.setLabel('Website')
					.setEmoji('🌐')
					.setURL('https://lunabot.art')
					.setStyle(ButtonStyle.Link)
			);
			
			// Phản hồi với embed và các nút
			await interaction.editReply({ 
				embeds: [aboutEmbed], 
				files: [attachment],
				components: [row]
			});
			
		} catch (error) {
			console.error('Lỗi tạo hình ảnh about:', error);
			
			// Fallback về embed đơn giản nếu có lỗi
			const fallbackEmbed = new EmbedBuilder()
				.setColor(0x9B59B6)
				.setTitle('✨ Luna AI - Trợ lý thông minh của bạn')
				.setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 }))
				.setDescription('*Luna là trợ lý AI thân thiện, luôn sẵn sàng trò chuyện và giúp đỡ bạn với khả năng trí tuệ nhân tạo tiên tiến.*')
				.addFields(
					{ name: 'Model AI', value: NeuralNetworks.Model || "Anthropic Claude", inline: true },
					{ name: 'Runtime', value: formatUptime(process.uptime(), true), inline: true },
					{ name: 'Servers', value: `${interaction.client.guilds.cache.size}`, inline: true },
					{ name: 'Memory', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
					{ name: 'Node.js', value: process.version, inline: true }
				)
				.setFooter({ text: `Luna Bot v1.0.2 • Developed by s4ory` })
				.setTimestamp();
				
			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setLabel('Mời Luna')
					.setEmoji('✉️')
					.setURL(`https://discord.com/api/oauth2/authorize?client_id=${interaction.client.user.id}&permissions=8&scope=bot%20applications.commands`)
					.setStyle(ButtonStyle.Link),
				
				new ButtonBuilder()
					.setLabel('Hỗ trợ')
					.setEmoji('💬')
					.setURL('https://discord.gg/52hSMAt')
					.setStyle(ButtonStyle.Link)
			);
			
			await interaction.editReply({ 
				embeds: [fallbackEmbed],
				components: [row]
			});
		}
	},
};

// Hàm vẽ khung thông tin đơn giản
function drawSimpleInfoBox(ctx, x, y, width, height, title, items) {
	// Khung nền đơn giản
	ctx.fillStyle = 'rgba(155, 89, 182, 0.1)';
	ctx.fillRect(x, y, width, height);
	
	// Khung viền
	ctx.strokeStyle = 'rgba(155, 89, 182, 0.3)';
	ctx.lineWidth = 1;
	ctx.strokeRect(x, y, width, height);
	
	// Tiêu đề
	ctx.font = 'bold 20px Sans';
	ctx.fillStyle = '#FFFFFF';
	ctx.fillText(title, x + 15, y + 25);
	
	// Vẽ dòng ngăn cách
	ctx.strokeStyle = 'rgba(155, 89, 182, 0.5)';
	ctx.beginPath();
	ctx.moveTo(x + 15, y + 35);
	ctx.lineTo(x + width - 15, y + 35);
	ctx.stroke();
	
	// Vẽ các mục thông tin
	let yOffset = y + 60;
	ctx.font = '16px Sans';
	
	items.forEach(item => {
		// Icon
		ctx.fillStyle = '#FFFFFF';
		ctx.fillText(item.icon, x + 20, yOffset);
		
		// Label
		ctx.fillStyle = '#AE86FD';
		ctx.fillText(item.label + ':', x + 50, yOffset);
		
		// Value
		ctx.fillStyle = '#FFFFFF';
		const labelWidth = ctx.measureText(item.label + ': ').width;
		ctx.fillText(item.value, x + 50 + labelWidth, yOffset);
		
		yOffset += 30;
	});
}

