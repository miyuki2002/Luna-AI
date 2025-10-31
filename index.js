require("dotenv").config();
const {
	Client,
	GatewayIntentBits,
	Partials,
	Collection,
	} = require("discord.js");
const { loadCommands } = require("./handlers/commandHandler");
const { startbot } = require("./events/ready");
const { setupMessageCreateEvent } = require("./events/messageCreate");
const { setupInteractionCreateEvent } = require("./events/interactionCreate");
const { setupGuildEvents } = require("./events/guildEvents");
const logger = require("./utils/logger.js");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessageReactions,
	],
	partials: [Partials.Channel, Partials.Message, Partials.Reaction], 
});

client.commands = new Collection();
client.features = ["EXPERIENCE_POINTS"];

// Initialize bot and load commands
startbot(client, () => loadCommands(client));

// Setup event handlers
setupMessageCreateEvent(client);
setupInteractionCreateEvent(client);
setupGuildEvents(client);

process.on("unhandledRejection", (error) => {
	logger.error("SYSTEM", "Lỗi không được xử lý:", error);
});

client.login(process.env.DISCORD_TOKEN);
