import "dotenv/config";
import express from "express";
import axios from "axios";
import {
  VerifyDiscordRequest,
  getRandomEmoji,
  DiscordRequest,
} from "./utils.js";
import { Client, GatewayIntentBits, Events } from "discord.js";
import { InteractionType, InteractionResponseType, verifyKeyMiddleware } from "discord-interactions";
import { installCommands } from "./commands.js";

const client = new Client({
  partials: ["MESSAGE", "CHANNEL", "REACTION"],
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const APPLICATION_ID = process.env.APPLICATION_ID
const TOKEN = process.env.TOKEN
const PUBLIC_KEY = process.env.PUBLIC_KEY || 'not set'

const app = express();
// app.use(bodyParser.json());

app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

const discord_api = axios.create({
  baseURL: 'https://discord.com/api/',
  timeout: 3000,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
    "Access-Control-Allow-Headers": "Authorization",
    "Authorization": `Bot ${TOKEN}`
  }
});

const serverStates = {};

const channelStates = new Map();

const messageQueue = new Map();

let deleteInterval;

function handleMessageList(message) {
  const channelId = message.channelId;

  if (!channelStates.has(channelId)) {
    channelStates.set(channelId, { messageList: [] });
  }

  const channelState = channelStates.get(channelId);
  channelState.messageList.push(message);

  channelStates.set(channelId, channelState);
}

/** Schedule Delete Session **/
function addToMessageQueue(channelId, messages) {
  if (!messageQueue.has(channelId)) {
    messageQueue.set(channelId, []);
  }

  messageQueue.get(channelId).push(...messages);
}

function processMessageQueue(channelId) {
  const channelState = channelStates.get(channelId);

  if (!channelState || !channelState.isScheduleDelete) {
    return;
  }

  const currentTime = new Date().getTime();

  const messagesToDelete = channelState.messageList.filter((message) => {
    const messageTime = message.createdTimestamp;
    const timeDifference = currentTime - messageTime;
    const minPassed = timeDifference / (1000 * 60);
    const hoursPassed = timeDifference / (1000 * 60 * 60);

    return hoursPassed >= 1;
  });

  const messageIdList = messagesToDelete.map(
    (messageToDelete) => messageToDelete.id
  );

  addToMessageQueue(channelId, messageIdList);

  // Update channelState.messageList by filtering out the deleted messages
  channelState.messageList = channelState.messageList.filter(
    (message) => !messagesToDelete.includes(message)
  );

  // Set the updated channelState back into the map
  channelStates.set(channelId, channelState);

  console.log("Updated messageList after deletion:", channelState.messageList);

  const queue = messageQueue.get(channelId);
  if (queue.length > 1) {
    bulkDeleteMessages(channelId, queue);
    messageQueue.set(channelId, []);
  }
}

async function bulkDeleteMessages(channelId, messages) {
  try {
    const bulkDeleteEndpoint = `channels/${channelId}/messages/bulk-delete`;
    const response = await DiscordRequest(bulkDeleteEndpoint, {
      method: "POST",
      body: { messages },
    });
  } catch (error) {
    console.error("Error deleting messages:", error);
  }
}
/** end **/

app.get('/', async (req, res) => {
  return res.send('Follow documentation ')
})

// app.listen(8999, () => {
app.listen(3000, () => {

})

client.on('ready', () => {
  console.log(`Logged in as user ${client.user}`);
  installCommands();
})

client.on('interactionCreate', async (interaction) => {

  const serverId = interaction.guildId;
  console.log('serverId: ', serverId);
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName == 'start_reactor') {
    serverStates[serverId] = true;
    await interaction.reply('Reactor has been started!');
  }

  if (interaction.commandName == 'stop_reactor') {
    serverStates[serverId] = true;
    await interaction.reply('Reactor has been stopped!');
  }

  if (interaction.commandName == 'start_service') {
    if (!channelStates.has(channelId)) {
      channelStates.set(channelId, {
        messageList: [],
        isScheduleDelete: true,
      });
    } else {
      channelStates.get(channelId).isScheduleDelete = true;
    }

    if (!messageQueue.has(channelId)) {
      messageQueue.set(channelId, []);
    }

    // Start the message queue processing interval (every 1 minutes)
    deleteInterval = setInterval(() => {
      processMessageQueue(channelId);
    }, 1 * 60 * 1000);

    await interaction.reply('Schedule delete service started');
  }

  if (interaction.commandName == "stop_service") {
    if (channelStates.has(channelId)) {
      channelStates.get(channelId).isScheduleDelete = false;
    }
    var status = "";
    if (deleteInterval === undefined || deleteInterval === null) {
      status = "Schedule delete service does not exist.";
    } else {
      console.log("deleteInterval ", deleteInterval);
      clearInterval(deleteInterval.id);
      status = "Schedule delete service stopped";
    }

    await interaction.reply('Schedule delete service deactivated');
  }

  if (interaction.commandName == "check_service") {

    const Http = new XMLHttpRequest();
    const url = 'https://confusion-east-pulsar.glitch.me/';
    Http.open("GET", url);

    console.log('im raeady');

    setInterval(() => {
      Http.send();
      Http.onreadystatechange = (e) => {
        console.log(Http.responseText)
      }
    }, 1 * 60 * 1000)


    var status = deleteInterval === undefined || deleteInterval === null
      ? "Schedule delete service has been deactivated."
      : "Schedule delete service is currently active and running.";

    await interaction.reply(status);
  }
})

client.on('messageCreate', (message) => {
  const serverId = message.guild.id;

  if (serverStates[serverId]) {
    message
      .react(getRandomEmoji())
      .catch((error) => console.error("Failed to add reaction:", error));
  }
  handleMessageList(message);
})

client.login(process.env.TOKEN);