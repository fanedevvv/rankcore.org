const {
  SlashCommandBuilder,
  MessageFlags,
} = require("discord.js");

// Subcommand handlers
const handlers = {
  "marry":             require("./family/marry"),
  "divorce":           require("./family/divorce"),
  "adopt":             require("./family/adopt"),
  "unadopt":           require("./family/unadopt"),
  "ground":            require("./family/ground"),
  "unground":          require("./family/unground"),
  "confiscate":        require("./family/confiscate"),
  "giveitem":          require("./family/giveitem"),
  "parentalguidance":  require("./family/parentalguidance"),
  "setrole":           require("./family/setrole"),
  "checkinventory":    require("./family/checkinventory"),
  "relationship":      require("./family/relationship"),
  "kidnap":            require("./family/kidnap"),
  "counterkidnap":     require("./family/counterkidnap"),
  "stats":             require("./family/stats"),
  "achievements":      require("./family/achievements"),
  "leaderboard":       require("./family/leaderboard"),
};

// Subcommands that are safe to run against bots (read-only / info)
const BOT_SAFE_SUBS = new Set(["relationship", "stats", "achievements", "checkinventory"]);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("family")
    .setDescription("The full suite of family commands.")
    // --- Marriage & Divorce ---
    .addSubcommand((c) => c.setName("marry").setDescription("Propose marriage to another user.").addUserOption((o) => o.setName("person").setDescription("The person you want to marry").setRequired(true)))
    .addSubcommand((c) => c.setName("divorce").setDescription("File for divorce from your partner."))
    // --- Adoption & Unadoption ---
    .addSubcommand((c) => c.setName("adopt").setDescription("Ask a user to be your child.").addUserOption((o) => o.setName("child").setDescription("The user you wish to adopt").setRequired(true)))
    .addSubcommand((c) => c.setName("unadopt").setDescription("Remove an adopted child from your family.").addUserOption((o) => o.setName("child").setDescription("The child you want to unadopt").setRequired(true)))
    // --- Kidnap & Counter-Kidnap ---
    .addSubcommand((c) => c.setName("kidnap").setDescription("Try to forcibly adopt another user (risky, 40% base chance, 12h cooldown)").addUserOption((o) => o.setName("victim").setDescription("The user you want to kidnap").setRequired(true)))
    .addSubcommand((c) => c.setName("counterkidnap").setDescription("Attempt to retrieve a child that was recently kidnapped.").addUserOption((o) => o.setName("parent").setDescription("The parent who had a child kidnapped").setRequired(true)))
    // --- Discipline & Items ---
    .addSubcommand((c) => c.setName("ground").setDescription("Restrict an adopted child for a set duration.").addUserOption((o) => o.setName("child").setDescription("Child to ground").setRequired(true)).addStringOption((o) => o.setName("duration").setDescription("Duration (e.g., 1h30m, 5m, max 12h)").setRequired(true)))
    .addSubcommand((c) => c.setName("unground").setDescription("End a child's grounding early.").addUserOption((o) => o.setName("child").setDescription("Child to unground").setRequired(true)))
    .addSubcommand((c) => c.setName("confiscate").setDescription("Temporarily take away a child's item.").addUserOption((o) => o.setName("child").setDescription("Child to take item from").setRequired(true)))
    .addSubcommand((c) => c.setName("giveitem").setDescription("Give one of your items to your child.").addUserOption((o) => o.setName("child").setDescription("Child to receive the item").setRequired(true)))
    .addSubcommand((c) => c.setName("parentalguidance").setDescription("Give your child some 'pocket money' for good behavior.").addUserOption((o) => o.setName("child").setDescription("Child to give money to").setRequired(true)).addIntegerOption((o) => o.setName("amount").setDescription("Amount of money to give (e.g. 50)").setRequired(true).setMinValue(1)))
    .addSubcommand((c) => c.setName("setrole").setDescription("Give your adopted child a temporary role.").addUserOption((o) => o.setName("child").setDescription("Child to give role to").setRequired(true)).addRoleOption((o) => o.setName("role").setDescription("The role to give").setRequired(true)).addStringOption((o) => o.setName("duration").setDescription("Duration (e.g., 1h30m, 5m, max 24h)").setRequired(true)))
    .addSubcommand((c) => c.setName("checkinventory").setDescription("Check your or another user's item inventory.").addUserOption((o) => o.setName("user").setDescription("User to check (default: you)").setRequired(false)))
    // --- Stats & Leaderboards ---
    .addSubcommand((c) => c.setName("stats").setDescription("Show all family stats for a user.").addUserOption((o) => o.setName("user").setDescription("User to check").setRequired(false)))
    .addSubcommand((c) => c.setName("achievements").setDescription("Show earned achievements for a user.").addUserOption((o) => o.setName("user").setDescription("User to check").setRequired(false)))
    .addSubcommand((c) => c.setName("leaderboard").setDescription("Show the family size leaderboard"))
    .addSubcommand((c) => c.setName("relationship").setDescription("See who a user is married to or adopted by.").addUserOption((o) => o.setName("user").setDescription("User to check").setRequired(false))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    // Bot guard for action commands
    if (!BOT_SAFE_SUBS.has(sub)) {
      const targetUser =
        interaction.options.getUser("person") ||
        interaction.options.getUser("child") ||
        interaction.options.getUser("victim") ||
        interaction.options.getUser("parent");

      if (targetUser?.bot)
        return interaction.reply({ content: "You can't perform family actions with a bot.", flags: MessageFlags.Ephemeral });
    }

    const handler = handlers[sub];
    if (!handler)
      return interaction.reply({ content: "Unknown subcommand.", flags: MessageFlags.Ephemeral });

    return handler.execute(interaction, client);
  },
};