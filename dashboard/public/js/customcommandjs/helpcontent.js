// helpContent.js — All contextual help text and command templates
// ─────────────────────────────────────────────────────────────────────────────

// ── Tab help content ──────────────────────────────────────────────────────────
export const TAB_HELP = {
  basic: {
    title: 'Basic Tab',
    icon: '⚡',
    sections: [
      {
        heading: 'Command Name',
        text: 'Registers as a Discord slash command — e.g. <code>/greet</code>. Must be lowercase, numbers, or hyphens. Cannot contain spaces.',
        example: 'greet, give-role, show-info',
      },
      {
        heading: 'Response',
        text: 'The message the bot sends when someone runs the command. Supports Discord markdown (<code>**bold**</code>, <code>*italic*</code>, code blocks) and variables like <code>{user.mention}</code>.',
        example: 'Hello {user.mention}! Welcome to **{server}**.',
      },
      {
        heading: 'Variables you can use',
        vars: [
          ['<code>{user.mention}</code>', 'Pings the user who ran the command'],
          ['<code>{user.tag}</code>', 'Username like <code>john#1234</code>'],
          ['<code>{user.id}</code>', 'Their Discord User ID'],
          ['<code>{server}</code>', 'Your server name'],
          ['<code>{channel}</code>', 'The channel name'],
          ['<code>{memberCount}</code>', 'Total members in the server'],
          ['<code>{random:1-100}</code>', 'Random number between 1 and 100'],
          ['<code>{arg:name}</code>', 'Value of an argument you defined'],
        ],
      },
    ],
  },
  args: {
    title: 'Arguments Tab',
    icon: '🔤',
    sections: [
      {
        heading: 'What are arguments?',
        text: 'Arguments are inputs the user provides when running the command. Discord shows them as slash command options. Each argument you add becomes available as <code>{arg:name}</code> in your response.',
        example: '/greet target:@john → Hello {arg:target.mention}!',
      },
      {
        heading: 'Argument types',
        vars: [
          ['String', 'Free text input — most flexible type'],
          ['Integer / Number', 'Numeric input — can set min/max range'],
          ['Boolean', 'True or false dropdown — Discord handles it'],
          ['User', 'Discord user picker — use <code>{arg:name.mention}</code>'],
          ['Channel', 'Discord channel picker — use <code>{arg:name.mention}</code>'],
          ['Role', 'Discord role picker — use <code>{arg:name.mention}</code>'],
          ['File', 'File upload — access URL with <code>{arg:name.url}</code>'],
        ],
      },
      {
        heading: 'Tip: Required vs Optional',
        text: 'Required arguments must be filled before the command can run. Discord enforces this — the command won\'t fire until all required fields are provided. Optional args default to blank if not filled.',
      },
      {
        heading: 'Predefined Choices',
        text: 'For String or Number args, you can define a fixed list of choices. Discord shows these as a dropdown. The user can only pick from your list — no free input.',
        example: 'Choices: "Red" → red, "Blue" → blue, "Green" → green',
      },
    ],
  },
  actions: {
    title: 'Actions Tab',
    icon: '🎯',
    sections: [
      {
        heading: 'What are actions?',
        text: 'Actions run on the server after the response is sent. Use them to automate role assignment, moderation, messaging, and more. The bot needs the appropriate Discord permission for each action.',
      },
      {
        heading: 'Role actions',
        vars: [
          ['Add Role → Invoker (fixed)', 'Gives the command runner a role you pick by ID'],
          ['Remove Role → Invoker (fixed)', 'Removes a fixed role from the command runner'],
          ['Add Role (arg) → Invoker', 'Gives a role chosen by the user via a ROLE-type argument'],
          ['Add Role (fixed) → User (arg)', 'Gives a fixed role to a specific user from a USER argument'],
        ],
      },
      {
        heading: 'Messaging actions',
        vars: [
          ['DM the Invoker', 'Sends a private message to whoever ran the command'],
          ['DM User (arg)', 'DMs a specific user picked via a USER argument'],
          ['Send to Channel (fixed)', 'Posts a message to a channel you pick by ID'],
          ['Send to Channel (arg)', 'Posts to a channel chosen from a CHANNEL argument'],
          ['React with Emoji', 'Reacts to the response message with an emoji'],
        ],
      },
      {
        heading: 'Moderation actions',
        vars: [
          ['Timeout User (arg)', 'Times out a user for a set duration in seconds'],
          ['Kick User (arg)', 'Kicks a user from the server'],
          ['Ban User (arg)', 'Bans a user from the server'],
          ['Set Nickname', 'Changes a user\'s nickname'],
        ],
      },
      {
        heading: '⚠️ Permissions reminder',
        text: 'The Roco bot role must have the required Discord permission AND be higher in the role hierarchy than the target user for moderation actions to work.',
      },
    ],
  },
  embed: {
    title: 'Embed Tab',
    icon: '🎨',
    sections: [
      {
        heading: 'What is an embed?',
        text: 'Embeds are rich message cards with colour, title, thumbnail, image, fields, and a footer. Enable "Send as Embed" at the top of this tab to use embed mode instead of a plain text response.',
      },
      {
        heading: 'Embed structure',
        vars: [
          ['Title', 'Bold header at the top of the embed'],
          ['Description (Response field)', 'Main body text — same as the Basic tab response but rendered inside the embed'],
          ['Author', 'Small line above the title with optional icon and clickable link'],
          ['Thumbnail', 'Small image in the top-right corner'],
          ['Large Image', 'Full-width image at the bottom of the embed'],
          ['Fields', 'Name/value pairs — up to 25, can be inline (side-by-side) or full-width'],
          ['Footer', 'Small text + icon at the very bottom'],
          ['Accent Colour', 'Coloured left-edge stripe'],
        ],
      },
      {
        heading: 'Variables in embeds',
        text: 'All variables (<code>{user.mention}</code>, <code>{arg:name}</code>, etc.) work in embed titles, descriptions, and field values just like in plain responses.',
      },
    ],
  },
  buttons: {
    title: 'Buttons Tab',
    icon: '🔘',
    sections: [
      {
        heading: 'What are buttons?',
        text: 'Buttons are clickable message components attached below the bot\'s response. When a user clicks a button, the bot sends a follow-up response (visible only to them by default, or everyone).',
      },
      {
        heading: 'Button types',
        vars: [
          ['Response button', 'Sends a follow-up message when clicked. Supports all variables.'],
          ['Link button', 'Opens a URL in the browser. Does not send a message.'],
        ],
      },
      {
        heading: 'Button styles',
        vars: [
          ['Primary (Blurple)', 'Most prominent — use for the main action'],
          ['Secondary (Grey)', 'Less prominent — use for optional actions'],
          ['Success (Green)', 'Confirms a positive action'],
          ['Danger (Red)', 'Warns about a destructive action'],
          ['Link', 'Grey button that opens a URL'],
        ],
      },
      {
        heading: 'Limits',
        text: 'Up to 5 buttons per command. Button labels max 80 characters. Button follow-up responses support all variables including <code>{arg:name}</code>.',
      },
    ],
  },
  rules: {
    title: 'Rules Tab',
    icon: '⚙️',
    sections: [
      {
        heading: 'Ephemeral Response',
        text: 'If enabled, only the person who ran the command can see the bot\'s response. No one else in the channel will see it. Useful for personal info commands.',
      },
      {
        heading: 'Cooldowns',
        vars: [
          ['Per-User Cooldown', 'Each individual user must wait this many seconds before running the command again'],
          ['Global Cooldown', 'The entire server must wait — one use sets the timer for everyone'],
        ],
      },
      {
        heading: 'Permission Gate',
        text: 'Sets <code>default_member_permissions</code> on the Discord command. Discord automatically hides the command from users who don\'t have the selected permission. This is enforced by Discord — not just the bot.',
      },
      {
        heading: 'Channel & Role Restrictions',
        text: 'Restrict which channels or roles can use this command. Paste Discord IDs (one per line). Allowed lists are whitelists — only those IDs can use it. Denied lists are blacklists — those IDs cannot.',
      },
    ],
  },
};

// ── Command templates ─────────────────────────────────────────────────────────
// Each template pre-fills the form with a working example the user can customise.
export const TEMPLATES = [
  {
    id: 'blank',
    name: 'Start Blank',
    desc: 'Empty form — build from scratch',
    icon: '✨',
    color: '#6C53FF',
    data: {},
  },
  {
    id: 'simple-response',
    name: 'Simple Response',
    desc: 'Bot replies with a plain text message',
    icon: '💬',
    color: '#FF3333',
    data: {
      name: 'info',
      description: 'Get server information',
      response: '📊 **{server}** has **{memberCount}** members!\n\nYou\'re viewing this from {channel}.',
    },
  },
  {
    id: 'mention-reply',
    name: 'Mention & Reply',
    desc: 'Reply with target user\'s mention',
    icon: '👋',
    color: '#60a5fa',
    data: {
      name: 'greet',
      description: 'Greet a user',
      response: 'Hey {arg:user.mention}, welcome to **{server}**! 🎉',
      arguments: [{ name: 'user', description: 'Who to greet', type: 'USER', required: true }],
    },
  },
  {
    id: 'give-role',
    name: 'Give Role',
    desc: 'Give the command runner a fixed role',
    icon: '🎭',
    color: '#c084fc',
    data: {
      name: 'get-member',
      description: 'Give yourself the Member role',
      response: '✅ Done! You\'ve been given a role.',
      ephemeral: true,
      actions: [{ type: 'add_role', roleId: '' }],
    },
  },
  {
    id: 'embed-card',
    name: 'Rich Embed',
    desc: 'Respond with a formatted embed card',
    icon: '🎨',
    color: '#22d3ee',
    data: {
      name: 'help',
      description: 'Show help information',
      response: 'Need help? Here\'s how to use this bot!',
      isEmbed: true,
      embedTitle: '📖 Help Guide',
      embedColor: '#6C53FF',
      embedFooter: 'Powered by Roco',
    },
  },
  {
    id: 'random-response',
    name: 'Random Response',
    desc: 'Bot picks a random reply from a list',
    icon: '🎲',
    color: '#f59e0b',
    data: {
      name: 'fortune',
      description: 'Get a random fortune',
      response: '🎱 Ask again later.',
      multiResponseEnabled: true,
      responseVariants: [
        { response: '🎱 It is certain.', weight: 1 },
        { response: '🎱 Ask again later.', weight: 1 },
        { response: '🎱 Outlook not so good.', weight: 1 },
        { response: '🎱 Signs point to yes!', weight: 1 },
      ],
    },
  },
  {
    id: 'role-from-arg',
    name: 'Role from Argument',
    desc: 'User picks a role → bot assigns it',
    icon: '🎯',
    color: '#f87171',
    data: {
      name: 'assign',
      description: 'Assign a role to yourself',
      response: '✅ Done — added {arg:role.mention} to your roles.',
      ephemeral: true,
      arguments: [{ name: 'role', description: 'Which role to assign', type: 'ROLE', required: true }],
      actions: [{ type: 'add_role_arg', argName: 'role' }],
    },
  },
];