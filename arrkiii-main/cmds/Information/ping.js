const { AttachmentBuilder } = require("discord.js");
const { createLatencyCanvas } = require("@custom/gen/pingCard.js");

const apiHistory = [];
const msgHistory = [];
const maxHistory = 15;

module.exports = {
  name: "ping",
  category: "Information",
  description: "Displays a real-time graph of the bot's latency.",
  aliases: ["latencygraph"],
  usage: "ping",
  execute: async (message, args, client) => {
    const msg = await message.channel
      .send({
        content: "Gathering latency data... (This may take a few seconds)",
      })
      .catch(() => null);

    const wsLatency = client.ws.ping;
    const msgLatency = msg.createdTimestamp - message.createdTimestamp;

    if (apiHistory.length >= maxHistory) apiHistory.shift();
    if (msgHistory.length >= maxHistory) msgHistory.shift();

    apiHistory.push(wsLatency);
    msgHistory.push(msgLatency);

    const canvas = createLatencyCanvas(
      apiHistory,
      msgHistory,
      wsLatency,
      msgLatency,
      maxHistory,
    );

    const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), {
      name: "ping.png",
    });

    await msg.edit({
      content: " ",
      files: [attachment],
    });
  },
};
