require("module-alias/register");
const config = require("@root/config.js");
const Jishaku = require("dokdo");
const ArrkiiClient = require("../struct/ArrkiiClient.js");

const client = new ArrkiiClient();
require("@custom/antiCrash.js")(client);
process.env.SHELL = process.platform === "win32" ? "powershell" : "bash";

client.Jsk = new Jishaku.Client(client, {
  aliases: ["dokdo", "dok", "jsk"],
  prefix: client.prefix,
  owners: client.owner,
});
client.getP = (id) => client.manager.players.get(id) || null;

client.connect(
  config.token,
  config.prefix,
  config.owner,
  config.color,
  config.topgg,
  config.voteuri,
);

module.exports = client;
