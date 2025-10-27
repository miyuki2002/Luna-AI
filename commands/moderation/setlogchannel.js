const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder,
	ChannelType,
} = require('discord.js');
const { translate: t } = require('../../utils/i18n.js');
const mongoClient = require('../../services/mongoClient.js');
const logger = require('../../utils/logger.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setlogchannel')
		.setDescription('Thiết lập kênh gửi log cho các lệnh moderation')
		.addChannelOption((option) =>
			option
				.setName('channel')
				.setDescription('Kênh để gửi log moderation')
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true),
		)
		.addBooleanOption((option) =>
			option.setName('monitor').setDescription('Áp dụng cho log giám sát chat').setRequired(false),
		)
		.addBooleanOption((option) =>
			option
				.setName('modactions')
				.setDescription('Áp dụng cho log hành động moderation (mute/ban/kick)')
				.setRequired(false),
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

	async execute(interaction) {
		if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
			return interaction.reply({
				content: t(interaction, 'commands.setlogchannel.errors.noPermission'),
				ephemeral: true,
			});
		}

		const logChannel = interaction.options.getChannel('channel');
		const monitorLogs = interaction.options.getBoolean('monitor') ?? true;
		const modActionLogs = interaction.options.getBoolean('modactions') ?? true;

		await interaction.deferReply();

		try {
			const db = mongoClient.getDb();

			try {
				await db.createCollection('mod_settings');
			} catch (error) {}

			const logSettings = {
				guildId: interaction.guild.id,
				logChannelId: logChannel.id,
				monitorLogs: monitorLogs,
				modActionLogs: modActionLogs,
				updatedAt: new Date(),
				updatedBy: interaction.user.id,
			};

			await db
				.collection('mod_settings')
				.updateOne({ guildId: interaction.guild.id }, { $set: logSettings }, { upsert: true });

			const settingsEmbed = new EmbedBuilder()
				.setColor(0x00ff00)
				.setTitle(t(interaction, 'commands.setlogchannel.embeds.success.title'))
				.setDescription(t(interaction, 'commands.setlogchannel.embeds.success.description', { channel: logChannel }))
				.addFields(
					{ name: t(interaction, 'commands.setlogchannel.embeds.success.fields.logChannel'), value: `<#${logChannel.id}>`, inline: true },
					{ name: t(interaction, 'commands.setlogchannel.embeds.success.fields.monitorLogs'), value: monitorLogs ? t(interaction, 'common.enabled') : t(interaction, 'common.disabled'), inline: true },
					{ name: t(interaction, 'commands.setlogchannel.embeds.success.fields.modActionLogs'), value: modActionLogs ? t(interaction, 'common.enabled') : t(interaction, 'common.disabled'), inline: true },
					{ name: t(interaction, 'commands.setlogchannel.embeds.success.fields.setBy'), value: `<@${interaction.user.id}>`, inline: true },
					{ name: t(interaction, 'commands.setlogchannel.embeds.success.fields.time'), value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
				)
				.setFooter({ text: t(interaction, 'common.footer.server', { server: interaction.guild.name }) })
				.setTimestamp();

			await interaction.editReply({ embeds: [settingsEmbed] });

			const testEmbed = new EmbedBuilder()
				.setColor(0x3498db)
				.setTitle(t(interaction, 'commands.setlogchannel.embeds.test.title'))
				.setDescription(t(interaction, 'commands.setlogchannel.embeds.test.description'))
				.addFields(
					{ name: t(interaction, 'commands.setlogchannel.embeds.test.fields.status'), value: t(interaction, 'common.active'), inline: true },
					{ name: t(interaction, 'commands.setlogchannel.embeds.test.fields.setBy'), value: `<@${interaction.user.id}>`, inline: true },
				)
				.setFooter({ text: t(interaction, 'common.footer.server', { server: interaction.guild.name }) })
				.setTimestamp();

			await logChannel.send({ embeds: [testEmbed] });
		} catch (error) {
			logger.error('MODERATION', 'Lỗi khi thiết lập kênh log:', error);
			await interaction.editReply({
				content: t(interaction, 'commands.setlogchannel.errors.general', { error: error.message }),
				ephemeral: true,
			});
		}
	},
};
