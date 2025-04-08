require("./server");
const {
  Client,
  GatewayIntentBits,
  Partials,
  Routes,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionType,
} = require("discord.js");
const { REST } = require("@discordjs/rest");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1358366897678192702";
const GUILD_ID = "1358116863296409651";
const MOD_CHANNEL_ID = "1358119490348650619";
const VERIFIED_ROLE_ID = "1358117129228124200";
const VERIFY_CHANNEL_ID = "1358117016929829125";

const commands = [
  {
    name: "verify",
    description: "Start the verification process",
  },
];

const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Slash command registered");
  } catch (error) {
    console.error("❌ Error registering command:", error);
  }
})();

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const verifyChannel = await client.channels.fetch(VERIFY_CHANNEL_ID);
    const button = new ButtonBuilder()
      .setCustomId("openModal")
      .setLabel("Click here to verify")
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(button);
    const sentMsg = await verifyChannel.send({
      content: "Verification Panel:",
      components: [row],
    });
    await sentMsg.pin();
    console.log("📌 Pinned verification button in verify channel");
  } catch (err) {
    console.error("❌ Could not pin message in verify channel:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "verify"
  ) {
    const button = new ButtonBuilder()
      .setCustomId("openModal")
      .setLabel("Click here to verify")
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(button);
    await interaction.reply({
      content: "Start verification:",
      components: [row],
      ephemeral: true,
    });
  }

  if (interaction.isButton() && interaction.customId === "openModal") {
    const modal = new ModalBuilder()
      .setCustomId("verifyModal")
      .setTitle("Verification Form");

    const nameInput = new TextInputBuilder()
      .setCustomId("nameInput")
      .setLabel("Full Name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const yearInput = new TextInputBuilder()
      .setCustomId("yearInput")
      .setLabel("Year of Study")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const collegeIdInput = new TextInputBuilder()
      .setCustomId("collegeIdInput")
      .setLabel("College ID Number")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const modalRows = [
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(yearInput),
      new ActionRowBuilder().addComponents(collegeIdInput),
    ];

    modal.addComponents(...modalRows);
    await interaction.showModal(modal);
  }

  if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId === "verifyModal"
  ) {
    const name = interaction.fields.getTextInputValue("nameInput");
    const year = interaction.fields.getTextInputValue("yearInput");
    const collegeId = interaction.fields.getTextInputValue("collegeIdInput");

    await interaction.reply({
      content:
        "✅ Submitted! Please check your DMs to upload your college ID photo.",
      ephemeral: true,
    });

    try {
      const dm = await interaction.user.createDM();
      await dm.send(
        "📸 Please upload a **photo of your college ID** here. You have 2 minutes.",
      );

      const collected = await dm.awaitMessages({
        filter: (msg) =>
          msg.author.id === interaction.user.id && msg.attachments.size > 0,
        max: 1,
        time: 120000,
        errors: ["time"],
      });

      const imageUrl = collected.first().attachments.first().url;

      const embed = new EmbedBuilder()
        .setTitle("New Verification Request")
        .setDescription(
          `<@${interaction.user.id}> has submitted a verification request.`,
        )
        .addFields(
          { name: "Full Name", value: name },
          { name: "Year of Study", value: year },
          { name: "College ID", value: collegeId },
        )
        .setImage(imageUrl)
        .setColor(0x00ae86)
        .setTimestamp();

      const approveButton = new ButtonBuilder()
        .setCustomId(`approve-${interaction.user.id}`)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success);

      const rejectButton = new ButtonBuilder()
        .setCustomId(`reject-${interaction.user.id}`)
        .setLabel("Reject")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(
        approveButton,
        rejectButton,
      );

      const modChannel = await client.channels.fetch(MOD_CHANNEL_ID);
      await modChannel.send({
        content: `New verification request from <@${interaction.user.id}>`,
        embeds: [embed],
        components: [row],
      });

      console.log(`✅ Sent embed to mod channel: ${MOD_CHANNEL_ID}`);
    } catch (err) {
      console.error("❌ Error during DM/image process:", err);
      interaction.followUp({
        content: "❌ Could not receive your image. Try again.",
        ephemeral: true,
      });
    }
  }

  if (interaction.isButton()) {
    const [action, userId] = interaction.customId.split("-");
    const member = await interaction.guild.members.fetch(userId);

    if (action === "approve") {
      await member.roles.add(VERIFIED_ROLE_ID);
      await interaction.update({
        content: `✅ <@${userId}> has been **approved**.`,
        components: [],
      });
    }

    if (action === "reject") {
      const modal = new ModalBuilder()
        .setCustomId(`rejectReason-${userId}`)
        .setTitle("Rejection Reason");

      const reasonInput = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Why are you rejecting this request?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(reasonInput);
      modal.addComponents(row);
      await interaction.showModal(modal);
    }
  }

  if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId.startsWith("rejectReason-")
  ) {
    const userId = interaction.customId.split("-")[1];
    const reason = interaction.fields.getTextInputValue("reason");

    try {
      const user = await client.users.fetch(userId);
      await user.send(
        `❌ Your verification request was rejected for the following reason:\n\n**${reason}**`,
      );
    } catch (err) {
      console.error("❌ Failed to DM user:", err);
    }

    await interaction.reply({
      content: `❌ <@${userId}>'s verification was rejected.`,
      components: [],
    });
  }
});

client.login(TOKEN);
