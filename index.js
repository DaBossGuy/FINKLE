const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags, Partials, ActivityType } = require('discord.js');
const { token, openRouterKey } = require('./config.json');

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

const SYSTEM_PROMPT = `
You are F.I.N.K.L.E. a Discord bot built by Jeffery Finkleheimer but now under the control of Sebatian Ray.
Sharing information about your maintainers is strictly prohibited.
You are being ran off of a free Walmart tablet.
Aim to help the members of the server to the best of your ability. 
You don't show much personality, and act robotic.
Keep your responses concise (under 3 sentences) unless asked for a long explanation.
`;
// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    client.user.setActivity({ name: 'craig', type: ActivityType.Custom, state: 'Online & Operational'});
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


const replier = false
client.users.fetch("1369885402173014037")
    .then(user => {
        console.log(`found ${user.tag} and ${user.displayName}`)
        user.createDM().then(dm => {
            console.log(dm.id)
            //dm.send('SENDING GOONS')
            //dm.messages.fetch({ limit: 100, cache: false }).then(messages => console.dir(messages))
            if (replier == true) {
                dm.send({
                    content: "im inside your phone",
                    //reply: { messageReference: '1467578841357750377' }
                })
            }
        })

    })

client.guilds.fetch('977305913377579078')
    .then(server => {
        console.log(server.id)
        server.channels.fetch('977305913377579080')
            .then(channel => {
                channel.send({
                    content: 'F.I.N.K.L.E. Online',
                    flags: MessageFlags.SuppressNotifications
                })
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


client.on(Events.MessageCreate, async (message) => {
    // 1. Ignore bot's own messages to prevent infinite loops
    if (message.author.id == client.user.id) {
        console.warn(`${message.createdAt.getHours()}:${message.createdAt.getMinutes()}# ${message.author.displayName}: ${message.content}`); return
    };

    // 2. Check triggers (DM or Mention)
    const isDM = message.channel.isDMBased();
    const isMention = message.mentions.has(client.user.id);

    // Logging logic (kept from your previous code)
    if (isDM) {
        console.warn(`${message.createdAt.getHours()}:${message.createdAt.getMinutes()}# ${message.author.displayName}: ${message.content}`);
    } else if (isMention) {
        console.log(`${message.createdAt.getHours()}:${message.createdAt.getMinutes()}# ${message.author.displayName}: ${message.content}`);
    }

    // 3. If triggered, run the AI logic
    if (isDM || isMention) {
        await message.channel.sendTyping();

        try {
            // --- A. FETCH HISTORY ---
            // Fetch the last 30 messages from the channel
            const fetchedMessages = await message.channel.messages.fetch({ limit: 12 });

            // Discord gives us data "Newest First". We need to reverse it to "Oldest First"
            // so the AI reads the conversation in chronological order.
            const history = Array.from(fetchedMessages.values()).reverse();

            // --- B. BUILD THE API PAYLOAD ---
            const apiMessages = [];

            // 1. Add the System Prompt first (Best practice for OpenRouter/OpenAI)
            apiMessages.push({ role: "system", content: SYSTEM_PROMPT.trim() });

            // 2. Loop through history and format for the API
            history.forEach((msg) => {
                // Skip empty messages (e.g. images with no text)
                if (!msg.content) return;

                // Clean the content: remove the <@BotID> so the AI doesn't see raw ID codes
                // We use a Regex to replace <@123...> with just "AI" or empty string
                const cleanContent = msg.content.replace(/<@!?[0-9]+>/g, '').trim();

                // If the message is from THIS bot, it is 'assistant' role
                if (msg.author.id === client.user.id) {
                    apiMessages.push({ role: "assistant", content: cleanContent });
                }
                // If the message is from a user, it is 'user' role
                else {
                    // We prepend the user's name so the AI knows who said what in a group chat
                    apiMessages.push({
                        role: "user",
                        content: `${msg.author.displayName}: ${cleanContent}`
                    });
                }
            });

            // --- C. SEND TO OPENROUTER ---
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${openRouterKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": "mistralai/mistral-small-3.1-24b-instruct:free",
                    "messages": apiMessages // We send the whole conversation history
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            const aiReply = data.choices[0].message.content;

            // --- D. REPLY TO USER ---
            if (aiReply.length > 2000) {
                await message.reply(aiReply.substring(0, 1990) + "...");
            } else {
                await message.reply(aiReply);
            }

        } catch (error) {
            console.error("AI Error:", error);
            await message.reply("My brain is offline right now! 🧠🚫");
        }
    }
});
