// docsjs/guides/community.js
export const communityGuides = {

'welcome': {
  name:'Welcome & Goodbye', icon:'door-open', color:'#34d399', tags:['welcome','onboarding'], desc:'Custom welcome and goodbye messages with image cards and variables.',
  sections:[
    { id:'setup', title:'Setup', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Configure at <strong>Community → Welcome</strong>. Separate settings for welcome and goodbye. Both support embed mode or image card mode.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="code-2"></i>Available variables</div>
        <div class="code-block"><span class="v">{user.mention}</span>   <span class="c">pings the joining member</span>
<span class="v">{user.tag}</span>      <span class="c">username#discriminator</span>
<span class="v">{user.name}</span>     <span class="c">display name</span>
<span class="v">{server}</span>        <span class="c">server name</span>
<span class="v">{memberCount}</span>   <span class="c">current member count</span>
<span class="v">{ordinal}</span>       <span class="c">e.g. "1,234th member"</span></div>
      </div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.1"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>DM greetings</strong>Enable a separate DM message to new members — useful for sending server rules or an onboarding guide.</div></div>`},
  ]
},

'leveling': {
  name:'Leveling', icon:'trending-up', color:'#f472b6', tags:['xp','leveling','rank'], desc:'XP system with rank cards, leaderboards, voice leveling, and role rewards.',
  sections:[
    { id:'commands', title:'Commands', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        <div class="cmd-item"><span class="cmd-name">/rank</span><span class="cmd-desc">View your rank card or another user's. Options: user</span></div>
        <div class="cmd-item"><span class="cmd-name">/leaderboard</span><span class="cmd-desc">Server XP leaderboard with pagination</span></div>
        <div class="cmd-item"><span class="cmd-name">/voiceleveling</span><span class="cmd-desc">Enable/disable voice XP, add/remove blacklisted channels</span></div>
      </div>`},
    { id:'config', title:'Dashboard Configuration', render:()=>`
      <div class="card-block" data-anim="fadeUp"><h4><i data-lucide="settings"></i>Available settings</h4><div class="prose"><ul>
        <li><strong>XP per message</strong> — base XP amount and cooldown between grants</li>
        <li><strong>XP multiplier roles</strong> — certain roles earn more XP per message</li>
        <li><strong>Level-up channel</strong> — announce level-ups (or disable)</li>
        <li><strong>Level-up message</strong> — custom message with <code>{user.mention}</code> and <code>{level}</code> variables</li>
        <li><strong>Role rewards</strong> — auto-assign a role when a user reaches a specific level</li>
        <li><strong>Stack role rewards</strong> — keep all previous level roles, or only the current tier</li>
        <li><strong>Blacklist channels</strong> — exclude certain channels from earning XP</li>
      </ul></div></div>`},
  ]
},

'reaction-roles': {
  name:'Reaction Roles', icon:'smile-plus', color:'#38bdf8', tags:['reaction-roles','buttons'], desc:'Button and dropdown role menus with unique, verify, and reverse modes.',
  sections:[
    { id:'modes', title:'Modes', render:()=>`
      <div class="table-wrap" data-anim="fadeUp"><table class="dtable"><thead><tr><th>Mode</th><th>Behaviour</th></tr></thead><tbody>
        <tr><td>Normal</td><td>Toggle role on/off freely</td></tr>
        <tr><td>Unique</td><td>Only one from this panel active — picking another removes the previous</td></tr>
        <tr><td>Verify</td><td>Click once to get the role — cannot remove by clicking again</td></tr>
        <tr><td>Reverse</td><td>All start with the role — clicking removes it (opt-out)</td></tr>
      </tbody></table></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="terminal"></i>Commands</div>
        <div class="code-block"><span class="v">/add</span>     <span class="c">add a reaction role button to a message</span>
<span class="v">/remove</span>  <span class="c">remove a reaction role</span>
<span class="v">/list</span>    <span class="c">list all reaction role configurations</span></div>
      </div>
      <div class="tags" data-anim="fadeUp" data-delay="0.1"><span class="tag blue">Free: 20</span><span class="tag gold">Basic: 40</span><span class="tag purple">Pro: 100</span><span class="tag green">Elite: ∞</span></div>`},
  ]
},

'giveaways': {
  name:'Giveaways', icon:'gift', color:'#f472b6', tags:['giveaway','prize'], desc:'Run giveaways with role requirements, bonus entries, and auto winners.',
  sections:[
    { id:'overview', title:'Running a Giveaway', render:()=>`
      <div class="example-block" data-anim="fadeUp">
        <div class="example-label"><i data-lucide="terminal"></i>Start a giveaway</div>
        <div class="code-block"><span class="v">/giveaway</span>
  prize:     "Nitro Classic"
  winners:   1
  duration:  24h
  required_role:  @Member
  bonus_role:     @Booster   <span class="c">(Basic+)</span>
  bonus_entries:  2          <span class="c">(Boosters get 2x entries)</span></div>
      </div>
      <div class="prose" data-anim="fadeUp" data-delay="0.05"><p>Manage active giveaways from <strong>Tools → Giveaways</strong>: end early, reroll winners, or view the entrant list. The winner announcement is sent to the same channel automatically.</p></div>`},
  ]
},

'music': {
  name:'Music', icon:'music-4', color:'#34d399', tags:['music','youtube','spotify'], desc:'Play from YouTube and Spotify with queues, playlists, and audio filters.',
  sections:[
    { id:'playback', title:'Playback Commands', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[
          ['/music play [song]','Search and play — adds to queue if already playing'],
          ['/music pause / resume','Pause or resume the current track'],
          ['/music skip','Skip the current track'],
          ['/music stop','Stop playback and clear the queue'],
          ['/music volume [0-100]','Set the playback volume'],
          ['/music nowplaying','Show current track with a live progress bar'],
          ['/music queue','View the full queue with pagination'],
          ['/music seek [time]','Jump to a position in the current track'],
          ['/music loop','Toggle loop: off / track / queue'],
          ['/music shuffle','Shuffle the current queue'],
        ].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>
      <div class="tags" data-anim="fadeUp" data-delay="0.05"><span class="tag gold">24/7 requires Basic+</span><span class="tag purple">Filters require Pro+</span></div>`},
    { id:'playlists', title:'Playlists', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[
          ['/playlist create [name]','Create a saved playlist'],
          ['/playlist add [name] [track]','Add a track'],
          ['/playlist play [name]','Queue and play the whole playlist'],
          ['/playlist list','See all playlists and track counts'],
          ['/playlist remove [name] [index]','Remove a track by position'],
          ['/playlist rename [name] [new]','Rename a playlist'],
          ['/playlist delete [name]','Delete permanently'],
        ].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>
      <div class="tags" data-anim="fadeUp" data-delay="0.05"><span class="tag blue">Free: 2 lists / 50 tracks</span><span class="tag gold">Basic: 5 / 75</span><span class="tag purple">Pro: 20 / 200</span><span class="tag green">Elite: ∞</span></div>`},
    { id:'filters', title:'Audio Filters', render:()=>`
      <div class="code-block" data-anim="fadeUp">nightcore  vaporwave  8D  tremolo  vibrato  rotation
bassboost  soft  pop  live  karaoke</div>
      <div class="prose" data-anim="fadeUp" data-delay="0.05"><p>Apply multiple filters simultaneously. Reset all with <code>/music filter reset</code>.</p></div>
      <div class="tags" data-anim="fadeUp" data-delay="0.1"><span class="tag purple">Requires Pro+</span></div>`},
  ]
},

'suggestions': {
  name:'Suggestions', icon:'lightbulb', color:'#34d399', tags:['suggestions','feedback','voting'], desc:'Let members submit ideas with a voting system — approve, reject, or mark as implemented.',
  sections:[
    { id:'setup', title:'Setup', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Configure at <strong>Community → Suggestions</strong> in the dashboard. Set the suggestions channel, the vote style (thumbs / stars / custom emoji), and optional staff-only channels for approved and rejected suggestions.</p></div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.05"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>Staff channels</strong>Configure separate channels for approved and implemented suggestions so your team can track progress without cluttering the main feed.</div></div>`},
    { id:'member-commands', title:'Member Commands', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['suggestion send suggestion:…','Submit a suggestion to the community (max 1024 chars)'],['suggestion edit message_id:… new_text:…','Edit your suggestion before it receives votes'],['suggestion delete message_id:…','Delete your own suggestion'],['suggestion info message_id:…','View details and full vote breakdown for any suggestion'],['suggestion stats','Server-wide suggestion statistics']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
    { id:'staff-commands', title:'Staff Commands', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['suggestion approve message_id:… note:…','Approve a suggestion — moves it to the approved channel'],['suggestion reject message_id:… reason:…','Reject with an optional reason — moves to rejected channel'],['suggestion implement message_id:… note:…','Mark as implemented — great for changelog announcements']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>
      <div class="callout info" data-anim="fadeUp" data-delay="0.05"><i data-lucide="info"></i><div class="callout-body"><strong>Staff role</strong>Set a staff role in the dashboard. Only members with that role (or Manage Server) can use approve/reject/implement commands.</div></div>`},
  ]
},

'autorole': {
  name:'Auto Role', icon:'user-check', color:'#60a5fa', tags:['autorole','join','roles'], desc:'Automatically assign roles to new members, bots, or everyone on join.',
  sections:[
    { id:'setup', title:'Setup', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Configure at <strong>Moderation → Auto Role</strong> or use slash commands. Assign one or more roles automatically when a member joins.</p></div>
      <div class="cmd-grid" data-anim="fadeUp" data-delay="0.05">
        ${[['auto-role add role:@Member type:all','Auto-assign to all new joins (humans and bots)'],['auto-role add role:@Human type:human','Assign only to human members'],['auto-role add role:@Bot type:bot','Assign only to bots'],['auto-role remove role:@Member','Remove a role from auto-assignment'],['auto-role list','View all configured auto-roles']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>
      <div class="callout warn" data-anim="fadeUp" data-delay="0.1"><i data-lucide="triangle-alert"></i><div class="callout-body"><strong>Role hierarchy</strong>RankCore can only assign roles below its own highest role. Make sure the RankCore role is above any auto-assigned roles in Server Settings → Roles.</div></div>`},
    { id:'limits', title:'Limits by Plan', render:()=>`
      <div class="table-wrap" data-anim="fadeUp"><table class="dtable"><thead><tr><th>Plan</th><th>Auto Roles</th></tr></thead><tbody>
        <tr><td>Free</td><td>2</td></tr>
        <tr><td>Basic</td><td>5</td></tr>
        <tr><td>Pro</td><td>15</td></tr>
        <tr><td>Elite</td><td>Unlimited</td></tr>
      </tbody></table></div>`},
  ]
},

'booster': {
  name:'Booster Rewards', icon:'zap', color:'#f472b6', tags:['booster','nitro','rewards'], desc:'Detect server boosts and reward boosters with roles, messages, or perks.',
  sections:[
    { id:'setup', title:'Setup', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Configure at <strong>Community → Booster</strong> in the dashboard. Set a notification channel, a message template, and optional booster reward roles.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="code-2"></i>Message variables</div>
        <div class="code-block"><span class="v">{user.mention}</span>   <span class="c">pings the booster</span>
<span class="v">{user.name}</span>     <span class="c">booster display name</span>
<span class="v">{server}</span>        <span class="c">server name</span>
<span class="v">{boost_count}</span>   <span class="c">server's current total boost count</span>
<span class="v">{boost_tier}</span>    <span class="c">server boost tier (1, 2, or 3)</span></div>
      </div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.1"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>Booster role</strong>Add a special booster reward role in the dashboard — it's automatically assigned when someone boosts and removed if they stop.</div></div>`},
  ]
},

'join-to-create': {
  name:'Join to Create', icon:'mic-vocal', color:'#22d3ee', tags:['jtc','voice','channels'], desc:'Let members create temporary private voice channels by joining a designated channel.',
  sections:[
    { id:'setup', title:'Setup', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Configure at <strong>Fun → Join to Create</strong> in the dashboard, or use the slash command.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="terminal"></i>Enable join to create</div>
        <div class="code-block"><span class="v">/join-to-create setup</span>
  channel:              #➕ Create Room     <span class="c">(voice channel to join)</span>
  category:             Voice Rooms         <span class="c">(where temp channels spawn)</span>
  voice-limit:          5                   <span class="c">(default user limit, 2–10)</span>
  inherit-permissions:  true                <span class="c">(inherit category permissions)</span></div>
      </div>
      <div class="prose" data-anim="fadeUp" data-delay="0.1"><p>When a member joins the designated channel, RankCore instantly creates a new voice channel in the category and moves them in. The channel is automatically deleted when the last member leaves.</p></div>`},
    { id:'controls', title:'Room Controls', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>The room owner gets a control panel posted in their channel with buttons to:</p></div>
      <div class="card-block" data-anim="fadeUp" data-delay="0.05"><h4><i data-lucide="settings-2"></i>Owner controls</h4>
        <div class="tags"><span class="tag blue">Rename the channel</span><span class="tag blue">Set user limit</span><span class="tag blue">Lock / unlock (prevent new joins)</span><span class="tag blue">Kick a member from the room</span><span class="tag blue">Transfer ownership</span><span class="tag blue">Hide / show the channel</span></div>
      </div>
      <div class="cmd-grid" data-anim="fadeUp" data-delay="0.1">
        <div class="cmd-item"><span class="cmd-name">/join-to-create disable</span><span class="cmd-desc">Disable the JTC system for this server</span></div>
        <div class="cmd-item"><span class="cmd-name">/join-to-create view</span><span class="cmd-desc">Show current JTC configuration</span></div>
      </div>`},
  ]
},

'sticky-messages': {
  name:'Sticky Messages', icon:'pin', color:'#f59e0b', tags:['sticky','pinned','messages'], desc:'Pin a message that always stays at the bottom of a channel, re-posting whenever new messages arrive.',
  sections:[
    { id:'usage', title:'Usage', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['sticky-message set channel:#rules message:Read before posting','Set a sticky message in a channel'],['sticky-message remove channel:#rules','Remove the sticky message from a channel'],['sticky-message list','List all sticky messages across the server']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>
      <div class="prose" data-anim="fadeUp" data-delay="0.05"><p>When a new message is sent in the channel, RankCore deletes the previous sticky and re-posts it at the bottom. This keeps important information always visible without needing a pinned message.</p></div>
      <div class="callout info" data-anim="fadeUp" data-delay="0.1"><i data-lucide="info"></i><div class="callout-body"><strong>Content limit</strong>Sticky messages support up to 2000 characters of plain text. For rich formatted stickies, use an embed from the Embed Builder and paste its content.</div></div>`},
    { id:'limits', title:'Limits by Plan', render:()=>`
      <div class="table-wrap" data-anim="fadeUp"><table class="dtable"><thead><tr><th>Plan</th><th>Sticky Messages</th></tr></thead><tbody>
        <tr><td>Free</td><td>3</td></tr>
        <tr><td>Basic</td><td>10</td></tr>
        <tr><td>Pro</td><td>30</td></tr>
        <tr><td>Elite</td><td>Unlimited</td></tr>
      </tbody></table></div>`},
  ]
},

'notifications': {
  name:'Notifications', icon:'bell', color:'#f59e0b', tags:['youtube','twitch','uptime'], desc:'YouTube, Twitch live, and website uptime monitoring notifications.',
  sections:[
    { id:'youtube', title:'YouTube Notifications', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Configure at <strong>Community → YouTube</strong>. Get notified when a channel uploads.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="code-2"></i>Custom message variables</div>
        <div class="code-block"><span class="v">{title}</span>    <span class="c">video title</span>
<span class="v">{url}</span>      <span class="c">video URL</span>
<span class="v">{channel}</span>  <span class="c">YouTube channel name</span>
<span class="v">{thumbnail}</span><span class="c">video thumbnail URL</span></div>
      </div>
      <div class="tags" data-anim="fadeUp" data-delay="0.1"><span class="tag blue">Free: 1</span><span class="tag gold">Basic: 5</span><span class="tag purple">Pro: 15</span><span class="tag green">Elite: ∞</span></div>`},
    { id:'twitch', title:'Twitch Notifications', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Configure at <strong>Community → Twitch</strong>. Notified when a streamer goes live. Edit-on-offline updates the message when they go offline.</p></div>
      <div class="tags" data-anim="fadeUp" data-delay="0.05"><span class="tag blue">Free: 1</span><span class="tag gold">Basic: 5</span><span class="tag purple">Pro: 15</span><span class="tag green">Elite: ∞</span></div>`},
    { id:'uptime', title:'Uptime Monitoring', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        <div class="cmd-item"><span class="cmd-name">/uptime add</span><span class="cmd-desc">Monitor a URL with configurable check interval (minutes)</span></div>
        <div class="cmd-item"><span class="cmd-name">/uptime list</span><span class="cmd-desc">All monitored URLs and current status</span></div>
        <div class="cmd-item"><span class="cmd-name">/uptime info</span><span class="cmd-desc">Detailed stats: uptime %, avg response time, incident history</span></div>
        <div class="cmd-item"><span class="cmd-name">/uptime delete</span><span class="cmd-desc">Remove a monitored URL</span></div>
      </div>`},
  ]
},

};