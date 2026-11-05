const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    PermissionsBitField,
    ButtonStyle,
    MessageFlags,
  } = require("discord.js");
  const axios = require('axios');
  const weather = require("weather-js");
  const math = require("mathjs");
  const { generatePassword } = require("generate-passwords");
  const translate = require("@iamtraction/google-translate");
  const BitlyClient = require("bitly").BitlyClient;
  const bitly = new BitlyClient(process.env.BITLY_TOKEN);
  const Docs = require("discord.js-docs");
  const { ButtonPaginationBuilder } = require("@thenorthsolution/djs-pagination");
  const { formatNumber, limitString } = require("fallout-utility");
  
  const BRANCH = "stable";
  const MAX_DOC_LENGTH = 1024;
  
  const replaceDisco = (str) =>
    str
      .replace(/docs\/docs\/disco/g, `docs/discord.js/${BRANCH}`)
      .replace(/ \(disco\)/g, "");
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName(`tools`)
      .setDescription(`Various utility tools for Discord`)
      .addSubcommandGroup((group) =>
        group
          .setName(`base64`)
          .setDescription(`Encode or decode text to/from base64`)
          .addSubcommand((command) =>
            command
              .setName("encode")
              .setDescription("Encode a string to base64")
              .addStringOption((option) =>
                option
                  .setName("text")
                  .setDescription("The string to encode")
                  .setRequired(true)
              )
          )
          .addSubcommand((subcommand) =>
            subcommand
              .setName("decode")
              .setDescription("Decode a base64 string")
              .addStringOption((option) =>
                option
                  .setName("text")
                  .setDescription("The base64 string to decode")
                  .setRequired(true)
              )
          )
      )
      .addSubcommand((command) =>
        command
          .setName(`weather`)
          .setDescription(`Gets the weather of a given area`)
          .addStringOption((option) =>
            option
              .setName("location")
              .setDescription("The location to check the weather of")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("degree-type")
              .setDescription("Select what degree type you would like")
              .addChoices(
                { name: `Fahrenheit`, value: "F" },
                { name: `Celsius`, value: `C` }
              )
              .setRequired(true)
          )
      )
      .addSubcommand((command) =>
        command.setName(`calculator`).setDescription(`A Discord calculator`)
      )
      .addSubcommand((command) =>
        command
          .setName(`password-generator`)
          .setDescription(`Generates a secure password for you`)
          .addIntegerOption((option) =>
            option
              .setName("length")
              .setDescription(`Specified length will be your password's length`)
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(200)
          )
          .addStringOption((option) =>
            option
              .setName("allow-letters")
              .setDescription(
                "Specify whether you want your password to include letters or not"
              )
              .addChoices(
                { name: `Allow`, value: "true" },
                { name: `Disallow`, value: "false" }
              )
          )
          .addStringOption((option) =>
            option
              .setName("allow-numbers")
              .setDescription(
                "Specify whether you want your password to include numbers or not"
              )
              .addChoices(
                { name: `Allow`, value: "true" },
                { name: `Disallow`, value: "false" }
              )
          )
          .addStringOption((option) =>
            option
              .setName("allow-symbols")
              .setDescription(
                "Specify whether you want your password to include symbols or not"
              )
              .addChoices(
                { name: `Allow`, value: "true" },
                { name: `Disallow`, value: "false" }
              )
          )
          .addStringOption((option) =>
            option
              .setName("upper-only")
              .setDescription(
                "Specify whether you want your password to be upper case only or not"
              )
              .addChoices(
                { name: `Allow`, value: "true" },
                { name: `Disallow`, value: "false" }
              )
          )
          .addStringOption((option) =>
            option
              .setName("lower-only")
              .setDescription(
                "Specify whether you want your password to be lower case only or not"
              )
              .addChoices(
                { name: `Allow`, value: "true" },
                { name: `Disallow`, value: "false" }
              )
          )
      )
      .addSubcommand((command) =>
        command
          .setName(`docs`)
          .setDescription(`Searches the official Discord.JS documentation`)
          .addStringOption((option) =>
            option
              .setName("query")
              .setDescription("The search query")
              .setRequired(true)
          )
      )
      .addSubcommand((command) =>
        command
          .setName(`iplookup`)
          .setDescription(`Looks up information about an IP address`)
          .addStringOption((option) =>
            option
              .setName("ip")
              .setDescription("The IP address to look up")
              .setRequired(true)
          )
      )
      .addSubcommand((command) =>
        command
          .setName(`translate`)
          .setDescription(`Translate any text to a specific language`)
          .addStringOption((option) =>
            option
              .setName("text")
              .setDescription("The text you want to translate")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("language")
              .setDescription("The language you want to translate to")
              .addChoices(
                { name: "English", value: "english" },
                { name: "Hindi", value: "hindi" },
                { name: "Turkish", value: "turkish" },
                { name: "Farsi", value: "farsi" },
                { name: "Russian", value: "russian" },
                { name: "Spanish", value: "spanish" },
                { name: "Arabic", value: "arabic" }
              )
              .setRequired(true)
          )
      )
      .addSubcommand((command) =>
        command
          .setName(`tts`)
          .setDescription(`Sends text to speech messages in the server`)
          .addStringOption((option) =>
            option
              .setName(`message`)
              .setDescription(`The message you want to send`)
              .setRequired(true)
          )
      )
      .addSubcommand((command) =>
        command
          .setName(`mcstatus`)
          .setDescription(`Shows Minecraft Server Stats`)
          .addStringOption((option) =>
            option
              .setName(`ip`)
              .setDescription(`The IP address of the server`)
              .setRequired(true)
          )
      )
      .addSubcommand((command) =>
        command
          .setName(`shorten`)
          .setDescription("Shorten a URL using Bitly")
          .addStringOption((option) =>
            option
              .setName("link")
              .setDescription("Provide a link to shorten")
              .setRequired(true)
          )
      ),
      
    async execute(interaction, client) {
      const subCommand = interaction.options.getSubcommand();
const handlers = {
  "password-generator": handlePasswordGenerator,
  "mcstatus": handleMcStatus,
  "encode": handleBase64Encode,
  "decode": handleBase64Decode,
  "weather": handleWeather,
  "docs": handleDocs,
  "calculator": handleCalculator,
  "shorten": handleShorten,
  "tts": handleTTS,
  "iplookup": handleIPLookup,
  "translate": handleTranslate
};
      
      if (handlers[subCommand]) {
        await handlers[subCommand](interaction, client);
      }
      
      async function handlePasswordGenerator(interaction, client) {
        const length = interaction.options.getInteger("length");
        const options = ["allow-letters", "allow-numbers", "allow-symbols", "upper-only", "lower-only"]
          .reduce((acc, opt) => {
            const val = interaction.options.getString(opt);
            if (val === "true") acc[opt.replace("allow-", "").replace("-only", "Only")] = true;
            return acc;
          }, {});
        
        const { letters = false, numbers = false, symbols = false } = options;
        
        if (!letters && !numbers && !symbols) {
          return interaction.reply({
            content: `You must specify **at least** 1 type of **character** to generate a **password**!`,
            flags: MessageFlags.Ephemeral,
          });
        }
        
        const data = await generatePassword({
          length,
          ...options,
        });
        
        const embed = new EmbedBuilder()
          .setTitle(`> Password Generated`)
          .setAuthor({ name: `<:restrict:1567797003638022166> Password Generator` })
          .setFooter({ text: `<:restrict:1567797003638022166> Password Generated` })
          .addFields({ name: `• Password`, value: `> ||\`\`\`${data}\`\`\`||` })
          .setColor(client.config.embedColor);
        
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
      
      async function handleMcStatus(interaction, client) {
        const ip = interaction.options.getString(`ip`);
        const url = `https://api.mcsrvstat.us/1/${ip}`;
        
        const errEmbed = new EmbedBuilder()
          .setColor("Red")
          .setTitle("Error: Unable to access server status")
          .setDescription(
            `The server is either offline, a bedrock server, or the IP provided is wrong`
          );
        
        try {
          const response = await fetch(url);
          const data = await response.json();
          
          if (!data.online) {
            return interaction.reply({ embeds: [errEmbed], flags: MessageFlags.Ephemeral });
          }
          
          const embed = new EmbedBuilder()
            .setColor(client.config.embedColor)
            .addFields(
              { name: "Server", value: data.hostname || ip },
              { name: "IP Address", value: data.ip, inline: true },
              { name: "Port", value: `${data.port}`, inline: true },
              { name: "Version", value: data.version },
              { name: "MOTD", value: data.motd?.clean?.join('\n') || "N/A" },
              { name: "Online Players", value: `${data.players?.online || 0}`, inline: true },
              { name: "Max Players", value: `${data.players?.max || 0}`, inline: true }
            );
            
          await interaction.reply({ embeds: [embed] });
        } catch (error) {
          await interaction.reply({ embeds: [errEmbed], flags: MessageFlags.Ephemeral });
        }
      }
      
      async function handleBase64Encode(interaction, client) {
        const text = interaction.options.getString("text");
        const encoded = Buffer.from(text).toString("base64");
        
        const embed = new EmbedBuilder()
          .setTitle("Base64 Encode")
          .addFields({ name: "Input", value: `\`\`\`${text}\`\`\`` })
          .addFields({ name: "Output", value: `\`\`\`${encoded}\`\`\`` })
          .setColor(client.config.embedColor);
        
        await interaction.reply({ embeds: [embed] });
      }
      
      async function handleBase64Decode(interaction, client) {
        const base64 = interaction.options.getString("text");
        
        try {
          const decoded = Buffer.from(base64, "base64").toString();
          
          const embed = new EmbedBuilder()
            .setTitle("Base64 Decode")
            .addFields({ name: "Input", value: `\`\`\`${base64}\`\`\`` })
            .addFields({ name: "Output", value: `\`\`\`${decoded}\`\`\`` })
            .setColor(client.config.embedColor);
          
          await interaction.reply({ embeds: [embed] });
        } catch (error) {
          await interaction.reply({ 
            content: "Failed to decode the provided text. Make sure it's valid base64.", 
            flags: MessageFlags.Ephemeral 
          });
        }
      }
      
      async function handleWeather(interaction, client) {
        const location = interaction.options.getString("location");
        const degree = interaction.options.getString("degree-type");
        
        await interaction.reply({
          content: `${client.emoji.loading} Gathering your weather data...`,
        });
        
        weather.find(
          { search: location, degreeType: degree },
          async function (err, result) {
            if (err || !result || result.length === 0) {
              return interaction.editReply({
                content: `Error: Unable to get weather data for that location. Please try again or check the location name.`,
              });
            }
            
            const data = result[0];
            const embed = new EmbedBuilder()
              .setColor(client.config.embedColor)
              .setTitle(`Current weather of ${data.location.name}`)
              .addFields(
                { name: `Temperature`, value: `${data.current.temperature}` },
                { name: `Feels Like`, value: `${data.current.feelslike}` },
                { name: `Weather`, value: `${data.current.skytext}` },
                { name: `Current Alerts`, value: `${data.location.alert || "None"}` },
                { name: `Week Day`, value: `${data.current.day}` },
                { name: `Wind Speed & Direction`, value: `${data.current.winddisplay}` }
              )
              .setThumbnail(data.current.imageUrl);
            
            interaction.editReply({ content: ``, embeds: [embed] });
          }
        );
      }
      
      async function handleDocs(interaction, client) {
        const query = interaction.options.getString("query");
        
        try {
          const doc = await Docs.fetch(BRANCH);
          const results = await doc.resolveEmbed(query);
          
          if (!results) {
            return interaction.reply({
              content: "Could not find that documentation.",
              flags: MessageFlags.Ephemeral
            });
          }
          
          const string = replaceDisco(JSON.stringify(results));
          const embed = JSON.parse(string);
          
          embed.author.url = `https://discord.js.org/#/docs/discord.js/${BRANCH}/general/welcome`;
          
          const match = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/.exec(
            embed.description
          );
          const extra = match ? "\n\nView more here: " + match[0].split(")")[0] : "";
          
          for (const field of embed.fields || []) {
            if (field.value.length >= MAX_DOC_LENGTH) {
              field.value = field.value.slice(0, MAX_DOC_LENGTH);
              const split = field.value.split(" ");
              let joined = split.join(" ");
              
              while (joined.length >= MAX_DOC_LENGTH - extra.length) {
                split.pop();
                joined = split.join(" ");
              }
              
              field.value = joined + extra;
            }
          }
          
          if (
            embed.fields &&
            embed.fields[embed.fields.length - 1].value.startsWith("[View source")
          ) {
            embed.fields.pop();
          }
          
          return interaction.reply({ embeds: [embed] });
        } catch (error) {
          return interaction.reply({
            content: "An error occurred while fetching documentation.",
            flags: MessageFlags.Ephemeral
          });
        }
      }

      
      async function handleCalculator(interaction, client) {
        const idPrefix = "calculator";
        const embed = new EmbedBuilder()
          .setDescription("```\nResults are shown here\n```")
          .setColor("Blurple");
          
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Clear")
            .setCustomId(idPrefix + "_clear")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setLabel("(")
            .setCustomId(idPrefix + "_(")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setLabel(")")
            .setCustomId(idPrefix + "_)")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setLabel("←")
            .setCustomId(idPrefix + "_backspace")
            .setStyle(ButtonStyle.Primary)
        );
        
        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("1")
            .setCustomId(idPrefix + "_1")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("2")
            .setCustomId(idPrefix + "_2")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("3")
            .setCustomId(idPrefix + "_3")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("/")
            .setCustomId(idPrefix + "_/")
            .setStyle(ButtonStyle.Primary)
        );
        
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("4")
            .setCustomId(idPrefix + "_4")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("5")
            .setCustomId(idPrefix + "_5")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("6")
            .setCustomId(idPrefix + "_6")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("*")
            .setCustomId(idPrefix + "_*")
            .setStyle(ButtonStyle.Primary)
        );
        
        const row3 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("7")
            .setCustomId(idPrefix + "_7")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("8")
            .setCustomId(idPrefix + "_8")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("9")
            .setCustomId(idPrefix + "_9")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("-")
            .setCustomId(idPrefix + "_-")
            .setStyle(ButtonStyle.Primary)
        );
        
        const row4 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("0")
            .setCustomId(idPrefix + "_0")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel(".")
            .setCustomId(idPrefix + "_.")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("=")
            .setCustomId(idPrefix + "_=")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setLabel("+")
            .setCustomId(idPrefix + "_+")
            .setStyle(ButtonStyle.Primary)
        );
        
        const msg = await interaction.reply({
          embeds: [embed],
          components: [row, row1, row2, row3, row4],
          ephemeral: false,
        });
        
        let data = "";
        const col = msg.createMessageComponentCollector({
          filter: (i) => i.user.id === interaction.user.id,
          time: 600000,
        });
        
        col.on("collect", async (i) => {
          const id = i.customId;
          const value = id.split("_")[1];
          let extra = "";
          
          if (value === "=") {
            try {
              data = math.evaluate(data).toString();
            } catch (e) {
              data = "";
              extra = "There is an error. Please press Clear to restart";
            }
          } else if (value === "clear") {
            data = "";
            extra = "Results are shown here";
          } else if (value === "backspace") {
            data = data.slice(0, -1);
          } else {
            const lc = data[data.length - 1];
            const isNumber = parseInt(value) == value || value === ".";
            const lastIsNumber = lc == parseInt(lc) || lc === ".";
            
            data += (isNumber && lastIsNumber && data.length > 0 ? "" : " ") + value;
          }
          
          i.update({
            embeds: [
              new EmbedBuilder()
                .setColor("Blurple")
                .setDescription(`\`\`\`\n${data || extra}\n\`\`\``),
            ],
            components: [row, row1, row2, row3, row4],
          });
        });
      }
      
      async function handleShorten(interaction, client) {
        let link = interaction.options.getString("link");
        const embed = new EmbedBuilder();
        
        try {
          if (!link.match(/^(http:\/\/.|https:\/\/.|http:\/\/|https:\/\/)/)) {
            link = "https://" + link;
          }
          
          if (!link.match(/^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/)) {
            return interaction.reply({
              embeds: [embed.setColor("Red").setDescription("Invalid URL format")],
              flags: MessageFlags.Ephemeral
            });
          }
          
          const result = await bitly.shorten(link);
          
          return interaction.reply({
            embeds: [
              embed
                .setTitle(`${interaction.user.username} - Bitly Link Shortener`)
                .setDescription(`Original: ${link}\nShortened: ${result.link}`)
                .setColor("Orange")
                .setTimestamp(),
            ],
          });
        } catch (err) {
          return interaction.reply({
            embeds: [
              embed
                .setColor("Red")
                .setTitle("An error occurred")
                .setDescription(
                  "Try adding `https://` and `www.` before the link. If the issue persists, please contact the developer."
                ),
            ],
            flags: MessageFlags.Ephemeral
          });
        }
      }
      
      async function handleTTS(interaction, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.SendTTSMessages)) {
          return interaction.reply({
            content: `You don't have permission to send TTS messages in this server`,
            flags: MessageFlags.Ephemeral,
          });
        }
        
        const message = interaction.options.getString("message");
        await interaction.reply({ content: message, tts: true });
      }
      
      async function handleIPLookup(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const ip = interaction.options.getString('ip');
        
        try {
          const response = await axios.get(`http://ip-api.com/json/${ip}`);
          const data = response.data;
          
          if (data.status === 'fail') {
            return interaction.editReply({ 
              content: `Error: ${data.message}`, 
              flags: MessageFlags.Ephemeral 
            });
          }
          
          const embed = new EmbedBuilder()
            .setTitle(`IP Lookup for ${data.query}`)
            .addFields(
              { name: 'Country', value: data.country || "N/A", inline: true },
              { name: 'Region', value: data.regionName || "N/A", inline: true },
              { name: 'City', value: data.city || "N/A", inline: true },
              { name: 'ZIP', value: data.zip || "N/A", inline: true },
              { name: 'Latitude', value: data.lat?.toString() || "N/A", inline: true },
              { name: 'Longitude', value: data.lon?.toString() || "N/A", inline: true },
              { name: 'ISP', value: data.isp || "N/A", inline: true },
              { name: 'Organization', value: data.org || "N/A", inline: true },
              { name: 'AS', value: data.as || "N/A", inline: true }
            )
            .setColor(client.config.embedColor)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } catch (error) {
          await interaction.editReply({ 
            content: 'An error occurred while looking up the IP address. Please try again later.', 
            flags: MessageFlags.Ephemeral 
          });
        }
      }
      
      async function handleTranslate(interaction, client) {
        const text = interaction.options.getString("text");
        const language = interaction.options.getString("language");
        
        const langCodes = {
          english: "en",
          hindi: "hi",
          turkish: "tr",
          farsi: "fa",
          spanish: "es",
          russian: "ru",
          arabic: "ar"
        };
        
        try {
          const translated = await translate(text, { to: langCodes[language] });
          
          const response = new EmbedBuilder()
            .setColor(client.config.embedColor)
            .setTitle("<:1430986225493479485:1567796921681055824> Translator")
            .addFields(
              { name: "Original:", value: text, inline: true },
              { name: "Translated:", value: translated.text, inline: true }
            )
            .setFooter({
              text: `Requested by ${interaction.member.user.tag}`,
              iconURL: interaction.member.user.displayAvatarURL(),
            });
          
          await interaction.channel.send({ embeds: [response] });
          await interaction.reply({
            content: "Successfully translated message!",
            ephemeral: false,
          });
        } catch (error) {
          await interaction.reply({
            content: "An error occurred while translating. Please try again later.",
            flags: MessageFlags.Ephemeral
          });
        }
      }
    },
  };