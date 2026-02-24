const {
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType,
} = require("discord.js");
const Preset = require("@data/preset");

const cardPresets = {
  card1: {
    name: "Modern UI Card",
    description: "Clean and modern design with sleek animations",
    image:
      "https://cdn.discordapp.com/attachments/1325386660522758177/1409842433730023505/card1.png",
    path: "../../custom/presets/card1.js",
  },
  card2: {
    name: "Sleek & Glassy Look",
    description: "Transparent glass effect with vibrant colors",
    image:
      "https://cdn.discordapp.com/attachments/1325386660522758177/1409843688980353115/card2.png",
    path: "../../custom/presets/card2.js",
  },
  card3: {
    name: "Waveform Player Style",
    description: "Music-focused design with waveform visuals",
    image:
      "https://cdn.discordapp.com/attachments/1325386660522758177/1409843999610638387/card3.png",
    path: "../../custom/presets/card3.js",
  },
};

module.exports = {
  name: "preset",
  category: "Config",
  prm: true,
  description: "Choose your player card design preset",
  cooldown: 3,
  execute: async (message, args, client) => {
    let selectedCard = null;
    const userData = await Preset.findOne({ userId: message.author.id });
    if (userData) {
      const found = Object.entries(cardPresets).find(
        ([, v]) => v.path === userData.cardPath,
      );
      if (found) selectedCard = found[0];
    }
    const createEmbed = (selected = null) => {
      const embed = new client.embed()
        .t("Music Cards Selection")
        .d(
          `Choose your preferred **music player card** from the dropdown below:\n\n`,
        );

      if (selected && cardPresets[selected].image) {
        embed.img(cardPresets[selected].image);
      }

      return embed;
    };

    const createComponents = (selected = null) => {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("card_select")
        .setPlaceholder("Select a preset...")
        .addOptions(
          Object.entries(cardPresets).map(([key, data], i) => ({
            label: data.name,
            description: data.description,
            value: key,
            default: selected === key,
          })),
        );

      const row1 = new ActionRowBuilder().addComponents(selectMenu);
      const row2 = new ActionRowBuilder().addComponents([
        new client.button().s(
          `save_preset`,
          "Save Selection",
          ``,
          !selected ? true : false,
        ),
        new client.button().d(`cancel_selection`, "Cancel"),
      ]);

      return [row1, row2];
    };

    const msg = await message.channel.send({
      embeds: [createEmbed(selectedCard)],
      components: createComponents(selectedCard),
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300000,
      filter: (interaction) => interaction.user.id === message.author.id,
    });

    const btnCollector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000,
      filter: (interaction) => interaction.user.id === message.author.id,
    });
    collector.on("collect", async (interaction) => {
      try {
        await interaction.deferUpdate();
        selectedCard = interaction.values[0];

        await msg.edit({
          embeds: [createEmbed(selectedCard)],
          components: createComponents(selectedCard),
        });
      } catch (err) {
        console.error("Dropdown error:", err);
      }
    });

    btnCollector.on("collect", async (interaction) => {
      try {
        await interaction.deferUpdate();

        if (interaction.customId === "save_preset" && selectedCard) {
          const cardData = cardPresets[selectedCard];
          try {
            await Preset.findOneAndUpdate(
              { userId: message.author.id },
              { cardPath: cardData.path },
              { upsert: true },
            );

            const successEmbed = new client.embed()
              .t("✅ Preset Saved!")
              .d(
                `**Selected Preset:** ${cardData.name}\n` +
                  `**Description:** ${cardData.description}\n\n` +
                  "Your card preset has been saved!",
              )
              .img(cardData.image);

            await msg.edit({ embeds: [successEmbed], components: [] });
            collector.stop("saved");
            btnCollector.stop("saved");
          } catch (err) {
            console.error("DB Error:", err);
          }
        }

        if (interaction.customId === "cancel_selection") {
          const cancelEmbed = new client.embed()
            .t("❌ Selection Cancelled")
            .d("No changes were made to your settings.");

          await msg.edit({ embeds: [cancelEmbed], components: [] });
          collector.stop("cancelled");
          btnCollector.stop("cancelled");
        }
      } catch (err) {
        console.error("Button error:", err);
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        await msg.edit({
          embeds: [
            new client.embed()
              .t("⏰ Selection Timed Out")
              .d("Run the command again if you want to select."),
          ],
          components: [],
        });
      }
    });
  },
};
