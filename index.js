import "dotenv/config";
import express from "express";
import axios from "axios";

const APPLICATION_ID = process.env.APPLICATION_ID
const TOKEN = process.env.TOKEN
const PUBLIC_KEY = process.env.PUBLIC_KEY || 'not set'

const app = express();
// app.use(bodyParser.json());

const glitch_url = axios.create({
  baseURL: 'https://confusion-east-pulsar.glitch.me/'
});

app.post('/wakeUp', async (req, res) => {
  try {
      await glitch_url.get();
  } catch (e) {
      res.send({ success: 0, details: e.message });
  } finally {
      res.send({ success: 1 });
  }
});

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

app.get('/', async (req, res) => {
  return res.send('Follow documentation ')
})

// app.listen(8999, () => {
app.listen(3000, () => {

})