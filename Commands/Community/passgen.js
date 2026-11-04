const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    PermissionsBitField,
    ComponentType,
} = require("discord.js");
const crypto = require("crypto");

// --- Helper Functions ---

/**
 * Converts a string of text to its binary representation.
 * @param {string} text The text to convert.
 * @returns {string} The binary string.
 */
function textToBinary(text) {
    return text.split('')
        .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
        .join(' ');
}

/**
 * Converts a string of binary back to text.
 * @param {string} binary The binary string to convert.
 * @returns {string} The resulting text string.
 */
function binaryToText(binary) {
    try {
        // Remove spaces, then split into 8-bit chunks
        const cleanedBinary = binary.replace(/\s/g, '');
        if (cleanedBinary.length % 8 !== 0) {
            return "ERROR: Invalid binary length. Total bits must be a multiple of 8.";
        }
        const byteChunks = cleanedBinary.match(/.{1,8}/g);

        return byteChunks
            .map(bin => String.fromCharCode(parseInt(bin, 2)))
            .join('');
    } catch (e) {
        return "ERROR: Conversion failed. Ensure input contains only 0s and 1s.";
    }
}

/**
 * Generates a secure API Key using cryptographically secure random bytes.
 * @param {number} length The desired length in bytes for the random portion.
 * @returns {string} A standardized API key format.
 */
function generateApiKey(length = 16) {
    const randomBytes = crypto.randomBytes(length).toString('hex');
    // Common API Key format
    return `api_live_${randomBytes}`;
}

/**
 * Applies a simple character-shifting cipher (Caesar cipher).
 * @param {string} text The text to process.
 * @param {number} shift The number of places to shift.
 * @param {boolean} encode If true, encodes; if false, decodes.
 * @returns {string} The processed text.
 */
function simpleCipher(text, shift, encode = true) {
    const effectiveShift = encode ? shift : -shift;
    let result = '';

    for (let i = 0; i < text.length; i++) {
        let char = text.charAt(i);
        let code = char.charCodeAt(0);

        if (code >= 65 && code <= 90) { // Uppercase
            const base = 65;
            // The `+ 26) % 26` handles negative wrap-around during decoding
            char = String.fromCharCode(((code - base + effectiveShift) % 26 + 26) % 26 + base);
        } else if (code >= 97 && code <= 122) { // Lowercase
            const base = 97;
            char = String.fromCharCode(((code - base + effectiveShift) % 26 + 26) % 26 + base);
        }

        result += char;
    }
    return result;
}

// --- Component Builders ---

// Dropdown for Binary Mode
const binarySelectMenu = new StringSelectMenuBuilder()
    .setCustomId('generate_binary_mode') // Use underscores for customId
    .setPlaceholder('Choose the conversion direction...')
    .addOptions(
        new StringSelectMenuOptionBuilder()
            .setLabel('Text to Binary')
            .setDescription('Converts regular text into a binary string.')
            .setValue('text_to_binary'),
        new StringSelectMenuOptionBuilder()
            .setLabel('Binary to Text')
            .setDescription('Converts a binary string back into text.')
            .setValue('binary_to_text'),
    );

// Dropdown for Cipher Action
const cipherSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('generate_cipher_action') // Use underscores for customId
    .setPlaceholder('Choose the cipher action (Encode/Decode)...')
    .addOptions(
        new StringSelectMenuOptionBuilder()
            .setLabel('Encode (Shift)')
            .setDescription('Encrypt the text using the shift value.')
            .setValue('encode'),
        new StringSelectMenuOptionBuilder()
            .setLabel('Decode (Unshift)')
            .setDescription('Decrypt the text using the original shift value.')
            .setValue('decode'),
    );

// --- Command Definition ---

module.exports = {
    data: new SlashCommandBuilder()
        .setName("generate")
        .setDescription("Tools for generating secrets, converting data, and simple ciphers.")
        .setDMPermission(true) // Allow usage in DMs

        // 1. PASSWORD (Direct options)
        .addSubcommand(subcommand =>
            subcommand
                .setName('password')
                .setDescription('Generate a secure secret/password.')
                .addIntegerOption(option =>
                    option.setName("length").setDescription("Length of the password (max 1024).").setRequired(false).setMinValue(1).setMaxValue(1024))
                .addBooleanOption(option =>
                    option.setName("uppercase").setDescription("Include uppercase letters? (Default: True)").setRequired(false))
                .addBooleanOption(option =>
                    option.setName("numbers").setDescription("Include numbers? (Default: True)").setRequired(false))
                .addBooleanOption(option =>
                    option.setName("special").setDescription("Include special characters? (Default: True)").setRequired(false))
        )

        // 2. API KEY (Direct options)
        .addSubcommand(subcommand =>
            subcommand
                .setName('apikey')
                .setDescription('Generate a secure, standardized API key (e.g., api_live_...).')
                .addIntegerOption(option =>
                    option.setName("length").setDescription("Length of the random hex segment (in bytes, default 16).").setRequired(false).setMinValue(8).setMaxValue(32))
        )

        // 3. BINARY (Dropdown for mode selection)
        .addSubcommand(subcommand =>
            subcommand
                .setName('binary')
                .setDescription('Translate text to binary or binary to text.')
                .addStringOption(option =>
                    option.setName('input').setDescription('The text or binary string to convert.').setRequired(true).setMaxLength(1000))
                .addStringOption(option => // Hidden option to track input for component handler
                    option.setName('__binary_input_hidden').setDescription('Hidden input data.').setRequired(false)
                )
        )

        // 4. CIPHER (Dropdown for action selection)
        .addSubcommand(subcommand =>
            subcommand
                .setName('cipher')
                .setDescription('Encode or decode text with a simple character-shift cipher.')
                .addStringOption(option =>
                    option.setName('text').setDescription('The message to encode or decode.').setRequired(true).setMaxLength(500))
                .addIntegerOption(option =>
                    option.setName('shift').setDescription('The number of places to shift (e.g., 3 for ROT3/Caesar).').setRequired(true).setMinValue(1).setMaxValue(25))
                .addStringOption(option => // Hidden option to track input for component handler
                    option.setName('__cipher_data_hidden').setDescription('Hidden text and shift data.').setRequired(false)
                )
        ),

    // --- EXECUTE FUNCTION (Handles the initial slash command run) ---
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        let embed;

        await interaction.deferReply({ ephemeral: true });

        switch (subcommand) {
            case 'password': {
                const length = interaction.options.getInteger("length") || 32;
                const useUpper = interaction.options.getBoolean("uppercase") ?? true;
                const useNumbers = interaction.options.getBoolean("numbers") ?? true;
                const useSpecial = interaction.options.getBoolean("special") ?? true;

                let chars = "abcdefghijklmnopqrstuvwxyz";
                if (useUpper) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                if (useNumbers) chars += "0123456789";
                if (useSpecial) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?/";

                if (chars.length === 0) {
                    return interaction.editReply({ content: 'You must select at least one character type.' });
                }

                // Use secure random generation
                let password = "";
                for (let i = 0; i < length; i++) {
                    const randomIndex = Math.floor(crypto.randomInt(chars.length));
                    password += chars[randomIndex];
                }

                embed = new EmbedBuilder()
                    .setColor(client.config?.embedColor || "Random")
                    .setTitle(`<:lockk:1555544494441635860> Generated Secret/Password`)
                    .setDescription(`\`\`\`${password.substring(0, 1024)}\`\`\``)
                    .setFooter({ text: `Length: ${length} | U: ${useUpper} | N: ${useNumbers} | S: ${useSpecial}` });

                return interaction.editReply({ embeds: [embed] });
            }

            case 'apikey': {
                const keyLength = interaction.options.getInteger("length") || 16;
                const apiKey = generateApiKey(keyLength);

                embed = new EmbedBuilder()
                    .setColor(client.config?.embedColor || "Yellow")
                    .setTitle("<:restrict:1555544549105999962> Generated API Key")
                    .setDescription(`**Key:** \n\`\`\`${apiKey}\`\`\`\n*Length of Random Hex: ${keyLength} bytes*`)
                    .setFooter({ text: `Note: This key follows a common 'api_type_randomhex' format.` });

                return interaction.editReply({ embeds: [embed] });
            }

            case 'binary': {
                // Store input data in a hidden field to retrieve later in the component handler
                const input = interaction.options.getString('input');

                // Create a unique custom ID for the row that includes the input data
                // This uses the hidden option as a temporary measure for passing state.
                const selectMenuWithData = StringSelectMenuBuilder.from(binarySelectMenu)
                    .setCustomId(`generate_binary_mode|${Buffer.from(input).toString('base64')}`); // Base64 encode the input

                const row = new ActionRowBuilder().addComponents(selectMenuWithData);

                return interaction.editReply({
                    content: `**Binary Input:** \`${input.substring(0, 50)}...\`\nPlease select the conversion **mode** for this input:`,
                    components: [row],
                });
            }

            case 'cipher': {
                const text = interaction.options.getString('text');
                const shift = interaction.options.getInteger('shift');

                // Store text and shift in a hidden field. Format: "text|shift"
                const dataString = `${text}|${shift}`;

                // Create a unique custom ID for the row that includes the text and shift
                const selectMenuWithData = StringSelectMenuBuilder.from(cipherSelectMenu)
                    .setCustomId(`generate_cipher_action|${Buffer.from(dataString).toString('base64')}`);

                const row = new ActionRowBuilder().addComponents(selectMenuWithData);

                return interaction.editReply({
                    content: `**Text:** \`${text.substring(0, 50)}...\` | **Shift:** ${shift}.\nPlease select the cipher **action**:`,
                    components: [row],
                });
            }

            default:
                return interaction.editReply({ content: 'Unknown subcommand.' });
        }
    },

    // --- Component Interaction Handler ---
    // NOTE: This function must be called from your main 'interactionCreate' event handler.
    async handleSelect(selectInteraction, client) {
        if (!selectInteraction.isStringSelectMenu()) return false; // Not a select menu
        if (!selectInteraction.customId.startsWith('generate_')) return false; // Not one of our customIds

        await selectInteraction.deferUpdate({ ephemeral: true });

        const [baseId, base64Data] = selectInteraction.customId.split('|');
        const selectedValue = selectInteraction.values[0];
        let embed;

        // Decode the data we passed in the customId
        const decodedData = Buffer.from(base64Data, 'base64').toString('utf8');

        if (baseId === 'generate_binary_mode') {
            const input = decodedData; // The decoded data is the input string
            const title = selectedValue === 'text_to_binary' ? "<:n_utils:1555544669545431062> Text to Binary Conversion" : "<:suggestion:1555544601501237322> Binary to Text Conversion";
            const output = selectedValue === 'text_to_binary' ? textToBinary(input) : binaryToText(input);

            embed = new EmbedBuilder()
                .setColor(client.config?.embedColor || "Green")
                .setTitle(title)
                .addFields(
                    { name: "Input", value: `\`${input.substring(0, 50)}...\``, inline: true },
                    { name: "Mode", value: selectedValue.replace('_', ' ').toUpperCase(), inline: true },
                )
                .setDescription(`**Result:**\n\`\`\`${output.substring(0, 1024)}\`\`\``)
                .setFooter({ text: output.length > 1024 ? 'Output truncated due to Discord embed limit.' : 'Conversion successful.' });

        } else if (baseId === 'generate_cipher_action') {
            const [text, shiftStr] = decodedData.split('|');
            const shift = parseInt(shiftStr, 10);
            const isEncode = selectedValue === 'encode';

            const result = simpleCipher(text, shift, isEncode);

            embed = new EmbedBuilder()
                .setColor(client.config?.embedColor || "Purple")
                .setTitle(`${isEncode ? '<:lockk:1555544494441635860>' : '<:lockk:1555544494441635860>'} Simple Character-Shift ${isEncode ? 'Encoding' : 'Decoding'}`)
                .addFields(
                    { name: "Shift Value", value: String(shift), inline: true },
                    { name: "Action", value: selectedValue.toUpperCase(), inline: true },
                )
                .setDescription(`**Original Text:** \`${text.substring(0, 100)}\`\n**Result:**\n\`\`\`${result.substring(0, 900)}\`\`\``)
                .setFooter({ text: 'This is a simple cipher (not for real security).' });
        }

        // Edit the original reply to show the result and remove the menu
        await selectInteraction.editReply({ embeds: [embed], content: '<a:tickyy:1555544712687915008> **Completed!**', components: [] });
        return true; // Successfully handled
    }
};