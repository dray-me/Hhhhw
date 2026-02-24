const { MessageFlags } = require("discord.js");
const Wait = require("util").promisify(setTimeout);

module.exports = {
  name: "stop",
  category: "Music",
  cooldown: 3,
  description: "Stops the music",
  args: false,
  usage: "",
  userPrams: [],
  botPrams: ["EmbedLinks"],
  dj: true,

  player: true,
  inVoiceChannel: true,
  sameVoiceChannel: true,
  execute: async (message, args, client, prefix) => {
    const player = client.manager.players.get(message.guild.id);

    if (!player.queue.current) {
      const me = client
        .box()
        .text(`Im Not Playing Any Song!`)
        .sep()
        .text(`Use \`${prefix}play\` to play a song!`);
      return message.channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [me],
      });
    }

    player.queue.clear();
    player.data.delete("autoplay");
    player.loop = "none";
    player.playing = false;
    player.paused = false;
    player.autoplay = false;
    await player.skip();
    Wait(500);
    const thing = new client.embed()
      .setColor("2f3136")
      .setDescription(`${client.emoji.tick} | Stopped the music`);
    message.reply({ embeds: [thing] });
  },
};
