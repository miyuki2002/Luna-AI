const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const ImageService = require('../../services/ImageService.js');
const logger = require('../../utils/logger.js');
const { translate: t } = require('../../utils/i18n');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('image')
		.setDescription('Vẽ một hình ảnh từ ý tưởng của bạn')
		.addStringOption((option) =>
			option
				.setName('prompt')
				.setDescription('Mô tả bức tranh bạn muốn mình tạo')
				.setRequired(true),
		),

	async execute(interaction) {
		await interaction.deferReply();
		const prompt = interaction.options.getString('prompt');

		let progressTracker = null;

		try {
			progressTracker = ImageService.trackImageGenerationProgress(interaction, prompt);
			await progressTracker.update(t(interaction, 'commands.image.progress.initializing'), 5);

			const imageResult = await ImageService.generateImage(prompt, interaction, progressTracker);

			if (imageResult && imageResult.buffer) {
				const attachment = new AttachmentBuilder(imageResult.buffer, { name: 'generated-image.png' });
				await interaction.followUp({ files: [attachment] });
			} else {
				await interaction.followUp({
					content: t(interaction, 'commands.image.errors.noResult'),
				});
				logger.warn('IMAGE', 'Image generation returned no result buffer');
			}
		} catch (error) {
			logger.error('COMMAND', 'Error while generating image:', error);
			await interaction.followUp({
				content: t(interaction, 'commands.image.errors.general'),
			});
		}
	},
};


