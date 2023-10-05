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

client.login(process.env.TOKEN);

const serverStates = {};

const channelStates = new Map();

const messageQueue = new Map();

let deleteInterval;

app.post('/interactions', async (req, res) => {
  const interaction = req.body;

  const { type, id, data, guild_id, channel_id } = req.body;

  const serverId = guild_id;
  const channelId = channel_id;

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    console.log(interaction.data.name)

    if (interaction.data.name == 'start_reactor') {
      console.log('guild Id: ', serverId);
      serverStates[serverId] = true;

      console.log(' serverStates[serverId]: ',  serverStates[serverId]);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "Reactor has been started!",
        },
      });
    }

    if (interaction.data.name == "stop_reactor") {
      serverStates[serverId] = false;

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "Reactor has been stopped!",
        },
      });
    }

    if (interaction.data.name == "start_service") {
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

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "Schedule delete service started",
        },
      });
    }

    if (interaction.data.name == "stop_service") {
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

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: status,
        },
      });
    }

    if (interaction.data.name == "check_service") {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content:
            deleteInterval === undefined || deleteInterval === null
              ? "Schedule delete service has been deactivated."
              : "Schedule delete service is currently active and running.",
        },
      });
    }

    if (interaction.data.name == 'yo') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Yo ${interaction.member.user.username}!`,
        },
      });
    }

    if (interaction.data.name == 'dm') {
      // https://discord.com/developers/docs/resources/user#create-dm
      let c = (await discord_api.post(`/users/@me/channels`, {
        recipient_id: interaction.member.user.id
      })).data
      try {
        // https://discord.com/developers/docs/resources/channel#create-message
        let res = await discord_api.post(`/channels/${c.id}/messages`, {
          content: 'Yo! I got your slash command. I am not able to respond to DMs just slash commands.',
        })
        console.log(res.data)
      } catch (e) {
        console.log(e)
      }

      return res.send({
        // https://discord.com/developers/docs/interactions/receiving-and-responding#responding-to-an-interaction
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '👍'
        }
      });
    }
  }
});

client.on(Events.MessageCreate, (message) => {

  const serverId = message.guild.id;
  console.log('serverId: ',serverId);
  console.log('hi: ',serverStates[serverId]);
  if (serverStates[serverId]) {
    message
      .react(getRandomEmoji())
      .catch((error) => console.error("Failed to add reaction:", error));
  }

  handleMessageList(message);
});

function handleMessageList(message) {
  const channelId = message.channelId;

  if (!channelStates.has(channelId)) {
    channelStates.set(channelId, { messageList: [] });
  }

  const channelState = channelStates.get(channelId);
  channelState.messageList.push(message);

  channelStates.set(channelId, channelState);
  
  console.log('messageList: ', channelState.messageList);
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

app.listen(8999, () => {

})
