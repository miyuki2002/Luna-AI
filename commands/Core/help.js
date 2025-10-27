const {
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ComponentType,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { translate: t } = require('../../utils/i18n');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription(t('en', 'commands.help.description'))
		.setDescriptionLocalizations({
			en: t('en', 'commands.help.description'),
			vi: t('vi', 'commands.help.description'),
		}),

	async execute(interaction) {
		const isOwner = interaction.user.id === process.env.OWNER_ID;

		const commandsPath = path.join(__dirname, '../');
		const commandFolders = fs.readdirSync(commandsPath, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => dirent.name);

		const visibleCategories = commandFolders.filter((folder) => {
			if (isOwner) return true;
			return folder !== 'setting';
		});

		const select = new StringSelectMenuBuilder()
			.setCustomId('category-select')
			.setPlaceholder(t(interaction, 'commands.help.select.placeholder'))
			.addOptions(buildSelectOptions(interaction, visibleCategories));

		const row = new ActionRowBuilder().addComponents(select);

		const welcomeEmbed = new EmbedBuilder()
			.setColor(0x9B59B6)
			.setTitle(t(interaction, 'commands.help.embeds.welcomeTitle'))
			.setDescription(t(interaction, 'commands.help.embeds.welcomeDescription'))
			.setFooter({ text: t(interaction, 'common.footer.credit') })
			.setTimestamp();

		await interaction.reply({
			embeds: [welcomeEmbed],
			components: [row],
		});

		const message = await interaction.fetchReply();

		const collector = message.createMessageComponentCollector({
			time: 60000,
			componentType: ComponentType.StringSelect,
		});

		collector.on('collect', async (i) => {
			if (i.user.id !== interaction.user.id) {
				return i.reply({
					content: t(i, 'commands.help.errors.notInvoker'),
					ephemeral: true,
				});
			}

			const category = i.values[0];

			if (category === 'setting' && !isOwner) {
				return i.reply({
					content: t(i, 'commands.help.errors.noPermission'),
					ephemeral: true,
				});
			}

			const helpEmbed = buildHelpEmbed(i, category, visibleCategories, commandsPath);

			await i.update({
				embeds: [helpEmbed],
				components: [row],
			});
		});

		collector.on('end', async (collected) => {
			try {
				const disabledRow = new ActionRowBuilder().addComponents(
					select.setDisabled(true),
				);

				if (collected.size === 0) {
					await interaction.editReply({
						content: t(interaction, 'commands.help.messages.menuExpired'),
						components: [disabledRow],
					});
				} else {
					await interaction.editReply({
						components: [disabledRow],
					});
				}
			} catch (error) {
				console.error('Error when disabling the help menu:', error);
			}
		});
	},
};

function buildSelectOptions(context, categories) {
	const options = [
		new StringSelectMenuOptionBuilder()
			.setLabel(t(context, 'commands.help.select.all.label'))
			.setDescription(t(context, 'commands.help.select.all.description'))
			.setValue('all')
			.setEmoji(t(context, 'commands.help.select.all.emoji')),
	];

	for (const folder of categories) {
		const metadata = getCategoryMetadata(context, folder);
		options.push(
			new StringSelectMenuOptionBuilder()
				.setLabel(metadata.label)
				.setDescription(metadata.description)
				.setValue(folder)
				.setEmoji(metadata.emoji),
		);
	}

	return options;
}

function buildHelpEmbed(context, category, visibleCategories, commandsPath) {
	const embed = new EmbedBuilder()
		.setColor(0x9B59B6)
		.setFooter({ text: t(context, 'common.footer.credit') })
		.setTimestamp();

	if (category === 'all') {
		embed
			.setTitle(t(context, 'commands.help.embeds.allTitle'))
			.setDescription(t(context, 'commands.help.messages.allCategoriesDescription'));

		for (const folder of visibleCategories) {
			const folderPath = path.join(commandsPath, folder);
			const commandFiles = fs.readdirSync(folderPath).filter((file) => file.endsWith('.js'));
			const metadata = getCategoryMetadata(context, folder);

			const commandList = commandFiles.map((file) => {
				const command = require(path.join(folderPath, file));
				return formatCommandSummary(context, command);
			}).join('\n');

			embed.addFields({
				name: `${metadata.emoji} ${metadata.label}`,
				value: commandList || t(context, 'commands.help.messages.emptyCategory'),
			});
		}

		return embed;
	}

	const metadata = getCategoryMetadata(context, category);

	embed
		.setTitle(t(context, 'commands.help.embeds.categoryTitle', { category: metadata.label }))
		.setDescription(t(context, 'commands.help.messages.categoryDetails', { category: metadata.label }));

	const folderPath = path.join(commandsPath, category);
	const commandFiles = fs.readdirSync(folderPath).filter((file) => file.endsWith('.js'));

	for (const file of commandFiles) {
		const command = require(path.join(folderPath, file));
		embed.addFields(formatCommandDetails(context, command));
	}

	return embed;
}

function formatCommandSummary(context, commandModule) {
	const commandKey = `commands.${commandModule.data.name}`;
	const description = t(context, `${commandKey}.description`);
	return `\`/${commandModule.data.name}\` - ${description}`;
}

function formatCommandDetails(context, commandModule) {
	const commandKey = `commands.${commandModule.data.name}`;
	const description = t(context, `${commandKey}.description`);

	let optionsInfo = '';
	if (commandModule.data.options && commandModule.data.options.length > 0) {
		optionsInfo = commandModule.data.options.map((option) => {
			const optionKey = `${commandKey}.options.${option.name}`;
			const optionDescription = t(context, `${optionKey}.description`);
			const requiredLabel = option.required
				? t(context, 'commands.help.messages.optionRequired')
				: t(context, 'commands.help.messages.optionOptional');

			return `• \`${option.name}\`: ${optionDescription} ${requiredLabel}`;
		}).join('\n');
	}

	return {
		name: `/${commandModule.data.name}`,
		value: [
			description,
			optionsInfo || t(context, 'commands.help.messages.noOptions'),
		].join('\n'),
	};
}

function getCategoryMetadata(context, category) {
	const metadata = t(context, `commands.help.categories.${category}`);

	if (metadata && typeof metadata === 'object') {
		return {
			label: metadata.label,
			description: metadata.description,
			emoji: metadata.emoji,
		};
	}

	const fallbackLabel = capitalizeFirstLetter(category);
	return {
		label: fallbackLabel,
		description: t(context, 'commands.help.select.categoryDescription', { category: fallbackLabel }),
		emoji: t(context, 'commands.help.select.defaultEmoji'),
	};
}

function capitalizeFirstLetter(value) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}
