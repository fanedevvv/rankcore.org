const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField,
    AutoModerationRuleTriggerType,
    AutoModerationRuleEventType,
    AutoModerationActionType,
    MessageFlags
} = require("discord.js");

// Regex for links
const linkRegexes = [
    "http://",      // shortened
    "https://",     // shortened
    "www\\.",       // ok
    "\\.com",       // ok
    "\\.net",       // ok
    "\\.org",       // ok
    "t\\.me"        // ok
];

// Regex for nuke/raid commands
// Helper: chunk array into batches of <=100 items
function chunkArray(arr, chunkSize) {
    const result = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        result.push(arr.slice(i, i + chunkSize));
    }
    return result;
}

// Raw nuke commands (truncated to <=10 chars per Discord rules)
const rawNukeCommands = [
  "kill","k1ll","nuke","nuk3","banall","b4nall",
  "massban","m4ssban","kickall","k1ckall",
  "masskick","m4sskick","prune","purge","delete",
  "wipe","raid","bomb","destroy","d3stroy","wipeall"
];

// truncate any commands longer than 10 characters
const nukeCommands = rawNukeCommands.map(cmd => cmd.slice(0, 10));

// split into batches of max 100 commands
const nukeBatches = chunkArray(nukeCommands, 100);



// Regex for racist/hate words (example, can be extended)
// Split long word list into batches for Discord AutoMod
// Clean words: max 10 chars
const rawRacismWords = [
  "nigga","n1gga","nigger","n1gger","chink","ch1nk",
  "spic","sp1c","gook","g00k","kyke","slant","coon",
  "cracker","jap","beaner","kraut","wetback","polack",
  "mulatto","fag","dyke","tranny","retard","idiot",
  "loser","whitey","honky","kike","gypsy","negro",
  "redskin"
];

// truncate words longer than 10 chars
const racismWords = rawRacismWords.map(word => word.slice(0, 10));

// create batches of ≤100 words
const racismBatches = chunkArray(racismWords, 100);
;



module.exports = {
    data: new SlashCommandBuilder()
        .setName("automod")
        .setDescription("Setup the automod system.")
        .addSubcommand(command =>
            command.setName("flagged-words")
                .setDescription("Block profanity and slurs from being used."))
        .addSubcommand(command =>
            command.setName("spam-messages")
                .setDescription("Block messages from being spammed."))
        .addSubcommand(command =>
            command.setName("mention-spam")
                .setDescription("Block a certain amount of mentions from being used.")
                .addIntegerOption(option =>
                    option.setName("number")
                        .setDescription("The number of mentions required to be blocked.")
                        .setRequired(true)
                ))
        .addSubcommand(command =>
            command.setName("keyword")
                .setDescription("Block a keyword from being used.")
                .addStringOption(option =>
                    option.setName("word")
                        .setDescription("The word you want to be blocked.")
                        .setRequired(true)
                ))
        .addSubcommand(command =>
            command.setName("anti-link")
                .setDescription("Block all types of links from being sent."))
        .addSubcommand(command =>
            command.setName("anti-nuke")
                .setDescription("Block nuke/raid commands like .kill, .nuke, etc."))
        .addSubcommand(command =>
            command.setName("anti-racism")
                .setDescription("Block racist and hate speech using regex.")),

            /**
     * @property {string} category - The name of the command group.
     */
    category: "Moderation",
    
    /**
     * @property {string} categoryDescription - Description for the category group.
     */
    categoryDescription: "Tools for managing user behavior, including anti-link and anti-nuke features.",

    /**
     * @property {string} usage - Shows the general structure for using the command group.
     */
    usage: "/setup-link <subcommand>",
    
    /**
     * @property {string[]} examples - Examples for the subcommands.
     */
    examples: [
        "/setup-link status enabled:true",
        "/setup-link set-limit type:MaxSpamMessageLimit limit:5 action:Warn",
        "/setup-link set-limit type:MaxMentionsLimit limit:10 action:Mute"
    ],
    
    /**
     * @property {string[]} permissions - Required Discord permissions to use the main command.
     */
    permissions: ["Owner Only"], // Based on your execute check

    async execute(interaction, client) {
        const { guild, options } = interaction;
        const sub = options.getSubcommand();

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                content: `${client.emoji.cross} You need to be an administrator to use this command.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        let ruleData;
        let embedColor;
        let ruleDescription;

        switch (sub) {
            case "flagged-words":
                ruleData = {
                    name: "AutoMod: Profanity Filter",
                    creatorId: client.user.id,
                    enabled: true,
                    eventType: AutoModerationRuleEventType.MessageSend,
                    triggerType: AutoModerationRuleTriggerType.KeywordPreset,
                    triggerMetadata: {
                        presets: [
                            "Profanity",
                            "SexualContent",
                            "Slurs",
                        ],
                    },
                    actions: [{ type: AutoModerationActionType.BlockMessage }],
                };
                embedColor = "#FF5555";
                ruleDescription = "Messages containing profanity, sexual content, or slurs will be automatically blocked.";
                break;

            case "spam-messages":
                ruleData = {
                    name: "AutoMod: Spam Filter",
                    creatorId: client.user.id,
                    enabled: true,
                    eventType: AutoModerationRuleEventType.MessageSend,
                    triggerType: AutoModerationRuleTriggerType.Spam,
                    triggerMetadata: {},
                    actions: [{ type: AutoModerationActionType.BlockMessage }],
                };
                embedColor = "#FFD700";
                ruleDescription = "Repeated messages that look like spam will be automatically blocked.";
                break;

            case "mention-spam":
                const number = options.getInteger("number");
                ruleData = {
                    name: "AutoMod: Mention Spam",
                    creatorId: client.user.id,
                    enabled: true,
                    eventType: AutoModerationRuleEventType.MessageSend,
                    triggerType: AutoModerationRuleTriggerType.MentionSpam,
                    triggerMetadata: {
                        mentionTotalLimit: number,
                    },
                    actions: [{ type: AutoModerationActionType.BlockMessage }],
                };
                embedColor = "#FFD700";
                ruleDescription = `Messages containing more than ${number} mentions will be automatically blocked.`;
                break;

            case "keyword":
                const word = options.getString("word");
                ruleData = {
                    name: `AutoMod: Block '${word}'`,
                    creatorId: client.user.id,
                    enabled: true,
                    eventType: AutoModerationRuleEventType.MessageSend,
                    triggerType: AutoModerationRuleTriggerType.Keyword,
                    triggerMetadata: {
                        keywordFilter: [word],
                    },
                    actions: [{ type: AutoModerationActionType.BlockMessage }],
                };
                embedColor = "#9370DB";
                ruleDescription = `Messages containing the word "${word}" will be automatically blocked.`;
                break;

            case "anti-link":
                ruleData = {
                    name: "Anti-Link",
                    creatorId: client.user.id,
                    enabled: true,
                    eventType: AutoModerationRuleEventType.MessageSend,
                    triggerType: AutoModerationRuleTriggerType.Keyword,
                    triggerMetadata: {
                        regexPatterns: linkRegexes,
                    },
                    actions: [{ type: AutoModerationActionType.BlockMessage }],
                };
                embedColor = "#00FF00";
                ruleDescription = "Messages containing links will be automatically blocked.";
                break;

case "anti-nuke":
    embedColor = "#DC143C";
    ruleDescription = "Messages containing nuke/raid commands will be automatically blocked.";

    try {
        await guild.autoModerationRules.fetch();

        for (let i = 0; i < nukeBatches.length; i++) {
            const batch = nukeBatches[i];
            const ruleName = `Anti-Nuke ${i + 1}`;

            // Skip if a rule with the same name already exists
            const existingRule = guild.autoModerationRules.cache.find(
                r => r.name === ruleName && r.enabled
            );
            if (existingRule) continue;

            await guild.autoModerationRules.create({
                name: ruleName,
                creatorId: client.user.id,
                enabled: true,
                eventType: AutoModerationRuleEventType.MessageSend,
                triggerType: AutoModerationRuleTriggerType.Keyword,
triggerMetadata: {
    keywordFilter: batch
},
                actions: [{ type: AutoModerationActionType.BlockMessage }],
                reason: `Created by ${interaction.user.tag}`,
            });
        }

        const successEmbed = new EmbedBuilder()
            .setDescription(`${client.emoji.tick} **Anti-Nuke rules created successfully.**\n\n${ruleDescription}`)
            .setColor(embedColor)
            .addFields(
                { name: "Created By", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Time Created", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: "Status", value: "Active", inline: true }
            )
            .setFooter({ text: `Server Protection • ${interaction.guild.name}` })
            .setTimestamp();

        return interaction.reply({ embeds: [successEmbed] });

    } catch (err) {
        console.error(err);
        return interaction.reply({
            content: `${client.emoji.cross} Failed to create Anti-Nuke rules.`,
            flags: MessageFlags.Ephemeral
        });
    }

                

case "anti-racism":
    embedColor = "#FF4500";
    ruleDescription = "Messages containing racist or hate speech will be automatically blocked.";

    try {
        await guild.autoModerationRules.fetch();

        for (let i = 0; i < racismBatches.length; i++) {
            const batch = racismBatches[i];
            const ruleName = `Anti-Racism ${i + 1}`;

            // Skip if rule already exists
            const existingRule = guild.autoModerationRules.cache.find(
                r => r.name === ruleName && r.enabled
            );
            if (existingRule) continue;

            await guild.autoModerationRules.create({
                name: ruleName,
                creatorId: client.user.id,
                enabled: true,
                eventType: AutoModerationRuleEventType.MessageSend,
                triggerType: AutoModerationRuleTriggerType.Keyword,
triggerMetadata: {
    keywordFilter: batch
},
                actions: [{ type: AutoModerationActionType.BlockMessage }],
                reason: `Created by ${interaction.user.tag}`,
            });
        }

        const successEmbed = new EmbedBuilder()
            .setDescription(`${client.emoji.tick} **Anti-Racism rules created successfully.**\n\n${ruleDescription}`)
            .setColor(embedColor)
            .addFields(
                { name: "Created By", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Time Created", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: "Status", value: "Active", inline: true }
            )
            .setFooter({ text: `Server Protection • ${interaction.guild.name}` })
            .setTimestamp();

        return interaction.reply({ embeds: [successEmbed] });

    } catch (err) {
        console.error(err);
        return interaction.reply({
            content: `${client.emoji.cross} Failed to create Anti-Racism rules.`,
            flags: MessageFlags.Ephemeral
        });
    }};

        try {
            await guild.autoModerationRules.fetch();
            let existingRule = null;

            switch (sub) {
                case "flagged-words":
                    existingRule = guild.autoModerationRules.cache.find(
                        r => r.triggerType === AutoModerationRuleTriggerType.KeywordPreset && r.enabled
                    );
                    break;

                case "spam-messages":
                    existingRule = guild.autoModerationRules.cache.find(
                        r => r.triggerType === AutoModerationRuleTriggerType.Spam && r.enabled
                    );
                    break;

                case "mention-spam":
                    const mentionLimit = options.getInteger("number");
                    existingRule = guild.autoModerationRules.cache.find(
                        r => r.triggerType === AutoModerationRuleTriggerType.MentionSpam &&
                             r.triggerMetadata.mentionTotalLimit === mentionLimit &&
                             r.enabled
                    );
                    break;

                case "keyword":
                    const keyword = options.getString("word").toLowerCase();
                    existingRule = guild.autoModerationRules.cache.find(
                        r => r.triggerType === AutoModerationRuleTriggerType.Keyword &&
                             r.triggerMetadata.keywordFilter &&
                             r.triggerMetadata.keywordFilter.some(k => k.toLowerCase() === keyword) &&
                             r.enabled
                    );
                    break;

                case "anti-link":
                    existingRule = guild.autoModerationRules.cache.find(
                        r => r.triggerType === AutoModerationRuleTriggerType.Keyword &&
                             r.triggerMetadata.regexPatterns &&
                             r.triggerMetadata.regexPatterns.some(pattern => linkRegexes.includes(pattern)) &&
                             r.enabled
                    );
                    break;

                case "anti-nuke":
                    existingRule = guild.autoModerationRules.cache.find(
                        r => r.triggerType === AutoModerationRuleTriggerType.Keyword &&
                             /^Anti-Nuke \d+$/.test(r.name) &&
                             r.enabled
                    );
                    break;

                case "anti-racism":
                    existingRule = guild.autoModerationRules.cache.find(
                        r => r.triggerType === AutoModerationRuleTriggerType.Keyword &&
                             /^Anti-Racism \d+$/.test(r.name) &&
                             r.enabled
                    );
                    break;
            }

            if (existingRule) {
                const errorEmbed = new EmbedBuilder()
                    .setDescription(`${client.emoji.warn} A similar rule is already active in this server.\n\nExisting Rule: **${existingRule.name}**`)
                    .setColor("#FF7F50")
                    .setFooter({ text: `Requested by ${interaction.user.tag}` })
                    .setTimestamp();

                return interaction.reply({
                    embeds: [errorEmbed],
                    flags: MessageFlags.Ephemeral,
                });
            }

            await guild.autoModerationRules.create({
                name: ruleData.name,
                creatorId: ruleData.creatorId,
                enabled: ruleData.enabled,
                eventType: ruleData.eventType,
                triggerType: ruleData.triggerType,
                triggerMetadata: ruleData.triggerMetadata,
                actions: ruleData.actions,
                reason: `Created by ${interaction.user.tag}`,
            });

            const currentTimestamp = Math.floor(Date.now() / 1000);
            const discordTimestamp = `<t:${currentTimestamp}:R>`;

            const successEmbed = new EmbedBuilder()
                .setDescription(`${client.emoji.tick} **${ruleData.name}**\n\n${ruleDescription}`)
                .setColor(embedColor)
                .addFields(
                    { name: "Created By", value: `<@${interaction.user.id}>`, inline: true },
                    { name: "Time Created", value: discordTimestamp, inline: true },
                    { name: "Status", value: "Active", inline: true }
                )
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setFooter({ text: `Server Protection • ${interaction.guild.name}` })
                .setTimestamp();

            return interaction.reply({ embeds: [successEmbed] });
        } catch (err) {
            console.error(`Error in automod command: ${err.message}`);
            const errorEmbed = new EmbedBuilder()
                .setDescription(`${client.emoji.cross} Failed to create the AutoMod rule. Please check the bot's permissions and try again.`)
                .setColor("#FF0000")
                .addFields(
                    { name: "Error Details", value: `\`\`\`${err.message || "Unknown error"}\`\`\`` }
                )
                .setFooter({ text: `Server: ${interaction.guild.name}` })
                .setTimestamp();

            return interaction.reply({
                embeds: [errorEmbed],
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
