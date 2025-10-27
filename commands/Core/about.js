const {
	SlashCommandBuilder,
	AttachmentBuilder,
	EmbedBuilder,
	ButtonBuilder,
	ActionRowBuilder,
	ButtonStyle,
} = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const AICore = require('../../services/AICore');
const { formatUptime } = require('../../utils/string');
const packageJson = require('../../package.json');
const { translate: t } = require('../../utils/i18n');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('about')
		.setDescription(t('en', 'commands.about.description'))
		.setDescriptionLocalizations({
			en: t('en', 'commands.about.description'),
			vi: t('vi', 'commands.about.description'),
		}),

	async execute(interaction) {
		await interaction.deferReply();

		const contextData = buildContextData(interaction);

		try {
			const canvasBuffer = await renderAboutCanvas(interaction, contextData);
			const attachment = new AttachmentBuilder(canvasBuffer, { name: 'about-luna.png' });

			const aboutEmbed = new EmbedBuilder()
				.setColor(0x9B59B6)
				.setImage('attachment://about-luna.png')
				.setFooter({ text: t(interaction, 'commands.about.embed.footer') });

			const row = buildActionRow(interaction);

			await interaction.editReply({
				embeds: [aboutEmbed],
				files: [attachment],
				components: [row],
			});
		} catch (error) {
			console.error('Error generating about image:', error);
			await sendFallbackEmbed(interaction, contextData);
		}
	},
};

function buildContextData(interaction) {
	return {
		modelName: AICore.getModelName() || 'Anthropic Claude',
		memoryUsage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
		serverCount: interaction.client.guilds.cache.size,
		uptime: formatUptime(process.uptime(), false),
		runtime: formatUptime(process.uptime(), true),
		version: packageJson.version,
		nodeVersion: process.version,
		currentDate: new Date().toISOString().split('T')[0],
	};
}

async function renderAboutCanvas(context, data) {
	const canvas = createCanvas(900, 500);
	const ctx = canvas.getContext('2d');

	ctx.fillStyle = '#1e1e2e';
	ctx.fillRect(0, 0, 900, 500);

	ctx.strokeStyle = 'rgba(155, 89, 182, 0.5)';
	ctx.lineWidth = 2;
	ctx.strokeRect(10, 10, 880, 480);

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

	let avatarImage;
	try {
		avatarImage = await loadImage(context.client.user.displayAvatarURL({ extension: 'png', size: 256 }));
	} catch (error) {
		console.error('Error loading avatar:', error);
	}

	if (avatarImage) {
		ctx.drawImage(avatarImage, 50, 50, 70, 70);
	}

	ctx.font = 'bold 40px Sans';
	ctx.fillStyle = '#FFFFFF';
	ctx.fillText('Luna AI', 140, 85);

	ctx.font = '20px Sans';
	ctx.fillStyle = '#AE86FD';
	ctx.fillText(t(context, 'commands.about.canvas.tagline'), 140, 110);

	drawSimpleInfoBox(ctx, 50, 150, 380, 200, t(context, 'commands.about.canvas.technicalTitle'), [
		{ icon: '>', label: t(context, 'commands.about.canvas.technicalItems.model'), value: data.modelName },
		{ icon: '>', label: t(context, 'commands.about.canvas.technicalItems.uptime'), value: data.uptime },
		{ icon: '>', label: t(context, 'commands.about.canvas.technicalItems.node'), value: data.nodeVersion },
		{ icon: '>', label: t(context, 'commands.about.canvas.technicalItems.memory'), value: `${data.memoryUsage} MB` },
		{ icon: '>', label: t(context, 'commands.about.canvas.technicalItems.servers'), value: data.serverCount.toString() },
	]);

	drawSimpleInfoBox(ctx, 450, 150, 400, 200, t(context, 'commands.about.canvas.featuresTitle'), [
		{ icon: '>', label: t(context, 'commands.about.canvas.featuresItems.chat.label'), value: t(context, 'commands.about.canvas.featuresItems.chat.value') },
		{ icon: '>', label: t(context, 'commands.about.canvas.featuresItems.image.label'), value: t(context, 'commands.about.canvas.featuresItems.image.value') },
		{ icon: '>', label: t(context, 'commands.about.canvas.featuresItems.code.label'), value: t(context, 'commands.about.canvas.featuresItems.code.value') },
		{ icon: '>', label: t(context, 'commands.about.canvas.featuresItems.moderation.label'), value: t(context, 'commands.about.canvas.featuresItems.moderation.value') },
	]);

	ctx.font = '16px Sans';
	ctx.fillStyle = '#94A1B2';
	const footerText = t(context, 'commands.about.canvas.footer', {
		version: data.version,
		date: data.currentDate,
	});
	const footerWidth = ctx.measureText(footerText).width;
	ctx.fillText(footerText, 450 - footerWidth / 2, 470);

	return canvas.toBuffer();
}

function buildActionRow(context) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setLabel(t(context, 'commands.about.buttons.invite'))
			.setURL(`https://discord.com/api/oauth2/authorize?client_id=${context.client.user.id}&permissions=0&scope=bot%20applications.commands`)
			.setStyle(ButtonStyle.Link),
		new ButtonBuilder()
			.setLabel(t(context, 'commands.about.buttons.docs'))
			.setURL('https://github.com/miyuki2002/Luna-AI')
			.setStyle(ButtonStyle.Link),
		new ButtonBuilder()
			.setLabel(t(context, 'commands.about.buttons.support'))
			.setURL('https://discord.gg/52hSMAt')
			.setStyle(ButtonStyle.Link),
		new ButtonBuilder()
			.setLabel(t(context, 'commands.about.buttons.website'))
			.setURL('https://lunaby.io.vn')
			.setStyle(ButtonStyle.Link),
	);
}

async function sendFallbackEmbed(interaction, data) {
	const fallbackEmbed = new EmbedBuilder()
		.setColor(0x9B59B6)
		.setTitle(t(interaction, 'commands.about.fallback.title'))
		.setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 }))
		.setDescription(t(interaction, 'commands.about.fallback.description'))
		.addFields(
			{ name: t(interaction, 'commands.about.fallback.fields.model'), value: data.modelName, inline: true },
			{ name: t(interaction, 'commands.about.fallback.fields.runtime'), value: data.runtime, inline: true },
			{ name: t(interaction, 'commands.about.fallback.fields.servers'), value: data.serverCount.toString(), inline: true },
			{ name: t(interaction, 'commands.about.fallback.fields.memory'), value: `${data.memoryUsage} MB`, inline: true },
			{ name: t(interaction, 'commands.about.fallback.fields.node'), value: data.nodeVersion, inline: true },
		)
		.setFooter({
			text: t(interaction, 'commands.about.fallback.footer', { version: data.version }),
		})
		.setTimestamp();

	const row = buildActionRow(interaction);

	await interaction.editReply({
		embeds: [fallbackEmbed],
		components: [row],
	});
}

function drawSimpleInfoBox(ctx, x, y, width, height, title, items) {
	ctx.fillStyle = 'rgba(155, 89, 182, 0.1)';
	ctx.fillRect(x, y, width, height);

	ctx.strokeStyle = 'rgba(155, 89, 182, 0.3)';
	ctx.lineWidth = 1;
	ctx.strokeRect(x, y, width, height);

	ctx.font = 'bold 20px Sans';
	ctx.fillStyle = '#FFFFFF';
	ctx.fillText(title, x + 15, y + 25);

	ctx.strokeStyle = 'rgba(155, 89, 182, 0.5)';
	ctx.beginPath();
	ctx.moveTo(x + 15, y + 35);
	ctx.lineTo(x + width - 15, y + 35);
	ctx.stroke();

	let yOffset = y + 60;
	ctx.font = '16px Sans';

	items.forEach((item) => {
		ctx.fillStyle = '#FFFFFF';
		ctx.fillText(item.icon, x + 20, yOffset);

		ctx.fillStyle = '#AE86FD';
		ctx.fillText(`${item.label}:`, x + 50, yOffset);

		ctx.fillStyle = '#FFFFFF';
		const labelWidth = ctx.measureText(`${item.label}: `).width;
		ctx.fillText(item.value, x + 50 + labelWidth, yOffset);

		yOffset += 30;
	});
}
