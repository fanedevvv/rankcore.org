const { SlashCommandBuilder } = require("discord.js");
const { GlobalFonts } = require("@napi-rs/canvas");

try {
  GlobalFonts.registerFromPath("../../Twemoji.ttf", "Twemoji");
} catch (e) {
  console.error("Could not register Twemoji font:", e.message);
}

// Subcommand handlers
const handlers = {
  // ── Classic actions ──────────────────────────────────────────────────────
  "pp-size":          require("./fun/ppsize"),
  "advice":           require("./fun/advice"),
  "dice-roll":        require("./fun/diceroll"),
  "joke":             require("./fun/joke"),
  "kiss":             require("./fun/kiss"),
  "coin-flip":        require("./fun/coinflip"),
  "slap":             require("./fun/slap"),
  "hug":              require("./fun/hug"),
  "pat":              require("./fun/pat"),
  "cuddle":           require("./fun/cuddle"),
  "clanker":          require("./fun/clanker"),
  "8ball":            require("./fun/eightball"),
  "tickle":           require("./fun/tickle"),
  "poke":             require("./fun/poke"),
  "bite":             require("./fun/bite"),
  "gay":              require("./fun/gay"),
  "lick":             require("./fun/lick"),
  // ── New interactive games ────────────────────────────────────────────────
  "would-you-rather":    require("./fun/wouldyourather"),
  "truth-or-dare":       require("./fun/truthordare"),
  "never-have-i-ever":   require("./fun/neverhaveiever"),
  "rps":                 require("./fun/rps"),
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fun")
    .setDescription("Fun commands — games, actions, and interactive activities!")
    // ── Classic actions ────────────────────────────────────────────────────
    .addSubcommand((c) => c.setName("pp-size").setDescription("Shows the size of your pp."))
    .addSubcommand((c) => c.setName("advice").setDescription("Get a random piece of advice."))
    .addSubcommand((c) => c.setName("dice-roll").setDescription("Roll a dice (1–6) <:minigames:1567796978929238076>"))
    .addSubcommand((c) => c.setName("joke").setDescription("Get a funny joke 🤣"))
    .addSubcommand((c) => c.setName("coin-flip").setDescription("Flip a coin <:Currency:1567796932041121873>"))
    .addSubcommand((c) =>
      c.setName("kiss").setDescription("Kiss a user 😘")
        .addUserOption((o) => o.setName("user").setDescription("Who do you want to kiss?").setRequired(true))
    )
    .addSubcommand((c) =>
      c.setName("slap").setDescription("Give a user a slap! <:user:1567797032423264261>")
        .addUserOption((o) => o.setName("target").setDescription("Who do you want to slap?").setRequired(true))
    )
    .addSubcommand((c) =>
      c.setName("hug").setDescription("Give a warm hug 🤗")
        .addUserOption((o) => o.setName("user").setDescription("Who do you want to hug?").setRequired(true))
    )
    .addSubcommand((c) =>
      c.setName("pat").setDescription("Pat a user gently 🥰")
        .addUserOption((o) => o.setName("user").setDescription("Who do you want to pat?").setRequired(true))
    )
    .addSubcommand((c) =>
      c.setName("cuddle").setDescription("Cuddle a user 🥺<:Red_Heart:1567796949271191642>")
        .addUserOption((o) => o.setName("user").setDescription("Who do you want to cuddle?").setRequired(true))
    )
    .addSubcommand((c) =>
      c.setName("clanker").setDescription("See how much of a clanker someone is 😏")
        .addUserOption((o) => o.setName("user").setDescription("Who to check?").setRequired(false))
    )
    .addSubcommand((c) =>
      c.setName("8ball").setDescription("Ask the magic 8-ball a question <:minigames:1567796978929238076>")
        .addStringOption((o) => o.setName("question").setDescription("Your question (must end with ?)").setRequired(true))
    )
    .addSubcommand((c) =>
      c.setName("tickle").setDescription("Tickle someone 🤣")
        .addUserOption((o) => o.setName("user").setDescription("Who do you want to tickle?").setRequired(true))
    )
    .addSubcommand((c) =>
      c.setName("poke").setDescription("Poke someone <:arrow:1567796951527850055>")
        .addUserOption((o) => o.setName("user").setDescription("Who do you want to poke?").setRequired(true))
    )
    .addSubcommand((c) =>
      c.setName("bite").setDescription("Bite someone 😬")
        .addUserOption((o) => o.setName("user").setDescription("Who do you want to bite?").setRequired(true))
    )
    .addSubcommand((c) =>
      c.setName("gay").setDescription("See how gay someone is <:restrict:1567797003638022166>️‍<:eco:1567796967197900842>")
        .addUserOption((o) => o.setName("user").setDescription("Who to check?").setRequired(false))
    )
    .addSubcommand((c) =>
      c.setName("lick").setDescription("Lick someone 😛")
        .addUserOption((o) => o.setName("user").setDescription("Who do you want to lick?").setRequired(true))
    )
    // ── New interactive games ──────────────────────────────────────────────
    .addSubcommand((c) =>
      c.setName("would-you-rather").setDescription("Post a Would You Rather question for the server to vote on 🤔")
    )
    .addSubcommand((c) =>
      c.setName("truth-or-dare").setDescription("Play Truth or Dare — pick your poison! <:minigames:1567796978929238076>")
        .addUserOption((o) => o.setName("user").setDescription("Who has to pick? (leave blank for yourself)").setRequired(false))
    )
    .addSubcommand((c) =>
      c.setName("never-have-i-ever").setDescription("Drop a Never Have I Ever and see who's done it 🙋")
    )
    .addSubcommand((c) =>
      c.setName("rps").setDescription("Challenge someone to Rock Paper Scissors <:1430986239036625017:1567796926689185822>")
        .addUserOption((o) => o.setName("user").setDescription("Who do you want to challenge?").setRequired(true))
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const handler    = handlers[subcommand];

    if (!handler) {
      return interaction.reply({ content: "Unknown subcommand.", ephemeral: true });
    }

    return handler.execute(interaction, client);
  },
};
