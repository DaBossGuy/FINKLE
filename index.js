const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags, Partials } = require('discord.js');
const { token } = require('./config.json');

// Create a new client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,  // Listen for messages in servers
		GatewayIntentBits.MessageContent, // Read the text of the message
		GatewayIntentBits.DirectMessages, // Listen for messages in DMs
	],
	// Partials are required to receive DMs from users the bot hasn't spoken to recently
	partials: [
		Partials.Channel,
		Partials.Message
	] 
});

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});
client.commands = new Collection();
// Log in to Discord with your client's token
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);
for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        // Set a new item in the Collection with the key as the command name and the value as the exported module
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}


client.login(token);


const replier = true
client.users.fetch("759540141386760244")
    .then(user => {
        console.log(`found ${user.tag} and ${user.displayName}`)
        user.createDM().then(dm => {
            console.log(dm.id)
            //dm.send('SENDING GOONS')
            dm.messages.fetch({ limit: 100, cache: false }).then(messages => console.dir(messages))
            if (replier == true) {
            dm.send({
                content: 'beeker',
                reply: { messageReference: '1467578841357750377' }
            })}
        })

    })

console.log('\x1b[32mUgh\x1b[0m')

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);
	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}
	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({
				content: 'There was an error while executing this command!',
				flags: MessageFlags.Ephemeral,
			});
		} else {
			await interaction.reply({
				content: 'There was an error while executing this command!',
				flags: MessageFlags.Ephemeral,
			});
		}
	}
    console.log(interaction);
});

client.on(Events.MessageCreate, (message) => {
    if (message.author.id == client.user.id) {
        console.log(`\x1b[32m${message.createdAt.getHours()}:${message.createdAt.getMinutes()}# ${message.author.displayName}(${message.author.tag}): ${message.content}\x1b[0m`)
    } else if (message.channel.isDMBased()) {
        console.warn(`${message.createdAt.getHours()}:${message.createdAt.getMinutes()}# ${message.author.displayName}(${message.author.tag}): ${message.content}`)
    } else if (message.mentions.has(client.user.id)) {console.log(`${message.createdAt.getHours()}:${message.createdAt.getMinutes()}# ${message.author.displayName}(${message.author.tag}): ${message.content}`)}

})

