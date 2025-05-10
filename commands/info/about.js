const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const NeuralNetworks = require('../../services/NeuralNetworks');
const { formatUptime } = require('../../utils/string');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Register fonts
registerFont(path.join(__dirname, '../../assets/fonts/Montserrat-Bold.otf'), { family: 'Montserrat', weight: 'bold' });
registerFont(path.join(__dirname, '../../assets/fonts/Montserrat-Medium.otf'), { family: 'Montserrat', weight: 'medium' });
registerFont(path.join(__dirname, '../../assets/fonts/Montserrat-Regular.otf'), { family: 'Montserrat', weight: 'regular' });
registerFont(path.join(__dirname, '../../assets/fonts/Montserrat-SemiBold.otf'), { family: 'Montserrat', weight: 'semibold' });

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
			
			// Tạo canvas cho thẻ thông tin
			const canvas = createCanvas(1100, 630);
			const ctx = canvas.getContext('2d');
			
			// Nền gradient
			const gradient = ctx.createLinearGradient(0, 0, 0, 630);
			gradient.addColorStop(0, '#16161f');
			gradient.addColorStop(1, '#252536');
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, 1100, 630);
			
			// Vẽ hiệu ứng ánh sáng
			ctx.beginPath();
			const glow = ctx.createRadialGradient(550, 250, 50, 550, 250, 400);
			glow.addColorStop(0, 'rgba(174, 134, 253, 0.4)');
			glow.addColorStop(1, 'rgba(174, 134, 253, 0)');
			ctx.fillStyle = glow;
			ctx.fillRect(0, 0, 1100, 630);
			
			// Vẽ đường viền
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
			ctx.lineWidth = 2;
			roundRect(ctx, 20, 20, 1060, 590, 15);
			ctx.stroke();
			
			// Vẽ hiệu ứng đường thẳng trang trí
			drawDecorativeLine(ctx, 50, 160, 1050, 160, '#9B59B6', 0.5);
			drawDecorativeLine(ctx, 50, 450, 1050, 450, '#9B59B6', 0.5);
			
			// Load và vẽ ảnh Luna
			let avatarImage;
			try {
				avatarImage = await loadImage(path.join(__dirname, '../../assets/luna-avatar.png'));
			} catch {
				// Fallback to bot avatar
				avatarImage = await loadImage(interaction.client.user.displayAvatarURL({ extension: 'png', size: 512 }));
			}
			
			// Vẽ avatar trong khung tròn
			ctx.save();
			ctx.beginPath();
			ctx.arc(200, 100, 80, 0, Math.PI * 2, true);
			ctx.closePath();
			ctx.clip();
			ctx.drawImage(avatarImage, 120, 20, 160, 160);
			ctx.restore();
			
			// Tên bot
			ctx.font = 'bold 48px Montserrat';
			ctx.fillStyle = '#FFFFFF';
			ctx.fillText('Luna AI', 320, 90);
			
			// Mô tả
			ctx.font = '28px Montserrat';
			ctx.fillStyle = '#AE86FD';
			ctx.fillText('Trợ lý AI thông minh của bạn', 320, 130);
			
			// Khung thông tin kỹ thuật
			drawInfoBox(ctx, 50, 200, 500, 220, 'Thông tin kỹ thuật', [
				{ icon: '🤖', label: 'Model AI', value: modelName },
				{ icon: '⏰', label: 'Thời gian hoạt động', value: formatUptime(process.uptime(), false) },
				{ icon: '🖥️', label: 'Phiên bản Node', value: process.version },
				{ icon: '📊', label: 'Bộ nhớ sử dụng', value: `${memoryUsage} MB` },
				{ icon: '🏠', label: 'Số lượng server', value: serverCount.toString() }
			]);
			
			// Khung tính năng
			drawInfoBox(ctx, 570, 200, 480, 220, 'Tính năng', [
				{ icon: '💬', label: 'Trò chuyện AI', value: 'Mention @Luna' },
				{ icon: '🎨', label: 'Tạo hình ảnh', value: 'vẽ [mô tả]' },
				{ icon: '🧠', label: 'Hỗ trợ lập trình', value: 'code [yêu cầu]' },
				{ icon: '📋', label: 'Quản lý tin nhắn', value: 'xóa lịch sử' }
			]);
			
			// Thông tin liên hệ
			ctx.font = 'semibold 28px Montserrat';
			ctx.fillStyle = '#FFFFFF';
			ctx.fillText('Liên hệ & Hỗ trợ', 550 - ctx.measureText('Liên hệ & Hỗ trợ').width / 2, 490);
			
			// Các biểu tượng liên hệ
			drawContactIcons(ctx, 550, 540);
			
			// Footer
			ctx.font = 'regular 18px Montserrat';
			ctx.fillStyle = '#94A1B2';
			const footerText = `Luna Bot v1.0.2 • Developed by s4ory • ${new Date().toISOString().split('T')[0]}`;
			ctx.fillText(footerText, 550 - ctx.measureText(footerText).width / 2, 600);
			
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
					{ name: '🔄 Runtime', value: formatUptime(process.uptime(), true), inline: true },
					{ name: '🏠 Servers', value: `${interaction.client.guilds.cache.size}`, inline: true },
					{ name: '📦 Memory', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true }
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

// Hàm vẽ đường thẳng trang trí
function drawDecorativeLine(ctx, startX, startY, endX, endY, color, alpha) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.globalAlpha = alpha;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(startX, startY);
	ctx.lineTo(endX, endY);
	ctx.stroke();
	
	// Vẽ chấm trang trí
	ctx.globalAlpha = alpha + 0.3;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(startX, startY, 3, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(endX, endY, 3, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

// Hàm vẽ khung thông tin
function drawInfoBox(ctx, x, y, width, height, title, items) {
	// Khung nền với màu nền nhẹ
	ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
	roundRect(ctx, x, y, width, height, 15, true);
	
	// Tiêu đề
	ctx.font = 'semibold 24px Montserrat';
	ctx.fillStyle = '#FFFFFF';
	ctx.fillText(title, x + 20, y + 35);
	
	// Vẽ dòng ngăn cách
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
	ctx.beginPath();
	ctx.moveTo(x + 20, y + 50);
	ctx.lineTo(x + width - 20, y + 50);
	ctx.stroke();
	
	// Vẽ các mục thông tin
	let yOffset = y + 90;
	items.forEach(item => {
		// Icon
		ctx.font = '20px Montserrat';
		ctx.fillText(item.icon, x + 25, yOffset);
		
		// Label
		ctx.font = 'medium 20px Montserrat';
		ctx.fillStyle = '#AE86FD';
		ctx.fillText(item.label + ':', x + 60, yOffset);
		
		// Value
		ctx.font = '20px Montserrat';
		ctx.fillStyle = '#FFFFFF';
		ctx.fillText(item.value, x + 60 + ctx.measureText(item.label + ': ').width, yOffset);
		
		yOffset += 40;
	});
}

// Hàm vẽ các biểu tượng liên hệ
function drawContactIcons(ctx, centerX, y) {
	const icons = [
		{ emoji: '✉️', text: 'Invite' },
		{ emoji: '📚', text: 'Docs' },
		{ emoji: '💬', text: 'Support' },
		{ emoji: '🌐', text: 'Website' }
	];
	
	const iconWidth = 100;
	const totalWidth = iconWidth * icons.length;
	let startX = centerX - totalWidth / 2;
	
	icons.forEach(icon => {
		// Emoji
		ctx.font = '28px Montserrat';
		ctx.fillStyle = '#FFFFFF';
		ctx.fillText(icon.emoji, startX + 40, y - 15);
		
		// Text
		ctx.font = 'regular 16px Montserrat';
		ctx.fillStyle = '#94A1B2';
		const textWidth = ctx.measureText(icon.text).width;
		ctx.fillText(icon.text, startX + 50 - textWidth / 2, y + 15);
		
		startX += iconWidth;
	});
}

// Hàm vẽ hình chữ nhật bo góc
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
	if (typeof radius === 'undefined') {
		radius = 5;
	}
	if (typeof radius === 'number') {
		radius = {tl: radius, tr: radius, br: radius, bl: radius};
	} else {
		const defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
		for (let side in defaultRadius) {
			radius[side] = radius[side] || defaultRadius[side];
		}
	}
	ctx.beginPath();
	ctx.moveTo(x + radius.tl, y);
	ctx.lineTo(x + width - radius.tr, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
	ctx.lineTo(x + width, y + height - radius.br);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
	ctx.lineTo(x + radius.bl, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
	ctx.lineTo(x, y + radius.tl);
	ctx.quadraticCurveTo(x, y, x + radius.tl, y);
	ctx.closePath();
	if (fill) {
		ctx.fill();
	}
	if (stroke) {
		ctx.stroke();
	}
}
