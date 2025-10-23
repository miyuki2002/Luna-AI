require("dotenv").config();
const {
	Client,
	GatewayIntentBits,
	Partials,
	Events,
	Collection,
} = require("discord.js");
const { handleMentionMessage } = require("./handlers/messageHandler");
const { handleCommand, loadCommands } = require("./handlers/commandHandler"); // Removed getCommandsJson as it's not used directly here
const { startbot } = require("./events/ready");
const { setupGuildHandlers } = require("./handlers/guildHandler");
const logger = require("./utils/logger.js");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildIntegrations,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessageReactions,
	],
	partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

client.commands = new Collection();
client.features = ["EXPERIENCE_POINTS"];

startbot(client, () => loadCommands(client));

setupGuildHandlers(client);

client.on(Events.MessageCreate, async (message) => {
	await handleMentionMessage(message, client);
});

// Đăng ký sự kiện interaction - sẽ được kích hoạt sau khi ready
client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	await handleCommand(interaction, client);
});

// Xử lý lỗi và thoát
process.on("unhandledRejection", (error) => {
	logger.error("SYSTEM", "Lỗi không được xử lý:", error);
});

client.login(process.env.DISCORD_TOKEN);
