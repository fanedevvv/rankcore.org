// docsjs/guides/economy.js — Economy, Games, Family, Invite Tracking, Utility Tools, Info, Troubleshooting
// ─────────────────────────────────────────────────────────────────────────────

export const economyGuides = {

'economy': {
  name:'Economy', icon:'coins', color:'#f59e0b', tags:['economy','coins','bank'], desc:'Server economy with a wallet, bank, daily rewards, jobs, fishing, gambling, and more.',
  sections:[
    { id:'getting-started', title:'Getting Started', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>The economy system is global — your coins carry across all servers using Roco. Create your account once and you're ready to earn.</p></div>
      <div class="cmd-grid" data-anim="fadeUp" data-delay="0.05">
        ${[['economy startacc','Create your economy account'],['economy balance','Check your wallet and bank balance'],['economy daily','Collect 🪙 500 coins (24h cooldown)'],['economy deleteacc','Permanently delete your economy account']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
    { id:'earning', title:'Earning Coins', render:()=>`
      <div class="table-wrap" data-anim="fadeUp"><table class="dtable"><thead><tr><th>Command</th><th>Description</th><th>Cooldown</th></tr></thead><tbody>
        <tr><td><code>/economy daily</code></td><td>Collect 500 coins</td><td>24 hours</td></tr>
        <tr><td><code>/economy work</code></td><td>Work a random job for coins</td><td>30 minutes</td></tr>
        <tr><td><code>/economy fish</code></td><td>Go fishing — variable reward</td><td>15 minutes</td></tr>
        <tr><td><code>/economy beg</code></td><td>Beg for a small amount</td><td>20 minutes</td></tr>
      </tbody></table></div>`},
    { id:'bank', title:'Bank & Transfers', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['economy bank deposit amount:500','Move coins from wallet to bank (safe from robbery)'],['economy bank withdraw amount:200','Move coins from bank to wallet'],['economy bank balance','Check your bank balance separately'],['economy give recipient:@Alice amount:100','Transfer coins directly to another user'],['economy rob user:@Bob','Attempt to steal from another user\'s wallet (30m cooldown)']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>
      <div class="callout warn" data-anim="fadeUp" data-delay="0.05"><i data-lucide="triangle-alert"></i><div class="callout-body"><strong>Keep coins in the bank</strong>Only wallet coins can be stolen by <code>/economy rob</code>. Depositing into the bank keeps them safe.</div></div>`},
    { id:'gambling', title:'Gambling', render:()=>`
      <div class="table-wrap" data-anim="fadeUp"><table class="dtable"><thead><tr><th>Command</th><th>How to play</th><th>Max payout</th></tr></thead><tbody>
        <tr><td><code>/economy coinflip amount: side:</code></td><td>Pick heads or tails</td><td>2x bet</td></tr>
        <tr><td><code>/economy blackjack bet:</code></td><td>Beat the dealer to 21</td><td>2x bet</td></tr>
        <tr><td><code>/economy roll bet: number:</code></td><td>Pick a number 1–6, win if matched</td><td>6x bet</td></tr>
        <tr><td><code>/economy roulette bet:</code></td><td>Spin the wheel</td><td>Variable</td></tr>
        <tr><td><code>/economy heist amount:</code></td><td>High-risk multi-round heist</td><td>5x bet</td></tr>
      </tbody></table></div>
      <div class="callout danger" data-anim="fadeUp" data-delay="0.05"><i data-lucide="triangle-alert"></i><div class="callout-body"><strong>Gambling is risky</strong>You can lose your entire bet. Never gamble more than you can afford to lose. The heist has a 1-hour cooldown.</div></div>`},
  ]
},

'games': {
  name:'Mini-Games', icon:'gamepad-2', color:'#38bdf8', tags:['games','minigames','fun'], desc:'Singleplayer and multiplayer mini-games playable directly inside Discord.',
  sections:[
    { id:'singleplayer', title:'Single-Player Games', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Use <code>/games-singleplayer game:[choose]</code> and pick from 14 built-in games.</p></div>
      <div class="card-block" data-anim="fadeUp" data-delay="0.05"><h4><i data-lucide="list"></i>Available games</h4>
        <div class="tags">
          <span class="tag blue">2048</span>
          <span class="tag blue">Fast Type</span>
          <span class="tag blue">Find Emoji</span>
          <span class="tag blue">Flood</span>
          <span class="tag blue">Guess the Pokémon</span>
          <span class="tag blue">Hangman</span>
          <span class="tag blue">Match Pairs</span>
          <span class="tag blue">Minesweeper</span>
          <span class="tag blue">Rock Paper Scissors</span>
          <span class="tag blue">Slots</span>
          <span class="tag blue">Snake</span>
          <span class="tag blue">Trivia</span>
          <span class="tag blue">Wordle</span>
          <span class="tag blue">Would You Rather</span>
        </div>
      </div>`},
    { id:'multiplayer', title:'Multiplayer Games', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Challenge another member with <code>/games-multiplayer game:[choose] user:@opponent</code>.</p></div>
      <div class="card-block" data-anim="fadeUp" data-delay="0.05"><h4><i data-lucide="users"></i>Available games</h4>
        <div class="tags">
          <span class="tag purple">Connect 4</span>
          <span class="tag purple">Tic Tac Toe</span>
          <span class="tag purple">Rock Paper Scissors</span>
        </div>
      </div>
      <div class="callout info" data-anim="fadeUp" data-delay="0.1"><i data-lucide="info"></i><div class="callout-body"><strong>Accepting a challenge</strong>The challenged user must click Accept in Discord. Bots cannot be challenged. If the opponent doesn't respond the game times out automatically.</div></div>`},
  ]
},

'family': {
  name:'Family System', icon:'heart', color:'#f472b6', tags:['family','marry','adopt'], desc:'Build a virtual family — marry, adopt children, ground them, give items, and track achievements.',
  sections:[
    { id:'marriage', title:'Marriage', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['family marry person:@Alice','Propose marriage — Alice must accept the proposal'],['family divorce','End your current marriage'],['family relationship user:@Alice','See who someone is married to or adopted by']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
    { id:'adoption', title:'Adoption & Kidnapping', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['family adopt child:@Bob','Send an adoption request — Bob must accept'],['family unadopt child:@Bob','Remove an adopted child from your family'],['family kidnap victim:@Bob','Forcibly adopt — 40% success chance, 12h cooldown'],['family counterkidnap parent:@X','Attempt to retrieve a kidnapped child']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>
      <div class="callout warn" data-anim="fadeUp" data-delay="0.05"><i data-lucide="triangle-alert"></i><div class="callout-body"><strong>Kidnap is risky</strong>Only a 40% base success chance. If it fails, the attempt is logged. There is a 12-hour cooldown between kidnap attempts.</div></div>`},
    { id:'parenting', title:'Parenting Controls', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['family ground child:@Bob duration:2h','Ground a child for up to 12 hours'],['family unground child:@Bob','End a grounding early'],['family setrole child:@Bob role:@Timeout duration:1h','Give a child a temporary role (max 24h)'],['family parentalguidance child:@Bob amount:50','Give a child pocket money from your wallet'],['family giveitem child:@Bob','Give one of your items to your child'],['family confiscate child:@Bob','Temporarily take away a child\'s item']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
    { id:'stats', title:'Stats & Achievements', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['family stats user:@Alice','View full family stats — marriage, children, items, rep'],['family achievements user:@Alice','Show earned family achievements'],['family checkinventory user:@Alice','Check item inventory'],['family leaderboard','Top families by size across the server']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
  ]
},

'invite-tracking': {
  name:'Invite Tracking', icon:'user-plus', color:'#34d399', tags:['invites','tracking','leaderboard'], desc:'Track who invited who, see invite counts, leaderboards, and configure invite-based autoroles.',
  sections:[
    { id:'commands', title:'Invite Commands', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['invite count user:@Alice','Show total invites for a user — regular, bonus, fake, left'],['invite leaderboard','Top inviters in the server with a visual card'],['invite reset user:@Alice','Reset invite stats for a specific user (Manage Server)'],['invite reset all:true','Reset all invite stats for the entire server (Manage Server)']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
    { id:'setup', title:'Dashboard Configuration', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Configure invite tracking at <strong>Moderation → Invite Tracker</strong> in the dashboard.</p></div>
      <div class="card-block" data-anim="fadeUp" data-delay="0.05"><h4><i data-lucide="settings-2"></i>Dashboard options</h4><div class="prose"><ul>
        <li><strong>Join message</strong> — post when a member joins with invite attribution</li>
        <li><strong>Leave message</strong> — post when a member leaves, noting who invited them</li>
        <li><strong>Invite log channel</strong> — dedicated channel for join/leave invite events</li>
        <li><strong>Invite milestones</strong> — auto-assign a role when a member reaches X invites</li>
        <li><strong>Autoroles</strong> — give roles based on which invite link was used to join</li>
        <li><strong>Fake invite detection</strong> — members who joined and left quickly don't count</li>
      </ul></div></div>
      <div class="callout info" data-anim="fadeUp" data-delay="0.1"><i data-lucide="info"></i><div class="callout-body"><strong>Invite types tracked</strong>Regular (active members), Bonus (manually added), Fake (joined then left), Left (invited members who later left). Net = Regular − Fake − Left.</div></div>`},
  ]
},

'utility-tools': {
  name:'Utility Tools', icon:'wrench', color:'#60a5fa', tags:['tools','utility','reminder','weather'], desc:'Reminders, weather, base64, password generator, emoji stealing, and more built-in utilities.',
  sections:[
    { id:'reminder', title:'Reminders', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['reminder set reminder:Team meeting minutes:30','Set a reminder (uses days + hours + minutes)'],['reminder cancel','Cancel your active reminder']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.05"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>Combining units</strong>Use <code>days:</code>, <code>hours:</code>, and <code>minutes:</code> together. E.g. <code>days:1 hours:2</code> = reminder in 26 hours.</div></div>`},
    { id:'tools', title:'Tools Commands', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['tools base64 encode text:Hello','Encode text to base64'],['tools base64 decode text:SGVsbG8=','Decode base64 back to text'],['tools weather location:London','Get current weather — choose °C or °F'],['tools calculator','Open an interactive calculator in Discord'],['tools password-generator length:32','Generate a secure random password'],['tools docs query:EmbedBuilder','Search the Discord.js documentation']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
    { id:'passgen', title:'Password & Cipher Tools', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['passgen generate password length:24','Generate a secure password with custom options (uppercase, symbols, numbers)'],['passgen binary encode text:Hello','Convert text to binary'],['passgen binary decode text:01001000…','Convert binary back to text'],['passgen cipher encrypt text:Secret shift:3','Caesar cipher encrypt with a shift value'],['passgen cipher decrypt text:Vhfuhw shift:3','Caesar cipher decrypt']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
    { id:'steal', title:'Emoji & Image Tools', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['steal emoji:💎 name:diamond','Copy any emoji to your server (requires Manage Emojis)'],['images cat','Get a random cat image 🐱'],['images dog','Get a random dog image 🐶'],['images meme','Get a random meme 😂'],['images fake-tweet tweet:your text','Generate a fake tweet image'],['images fake-ytcomment comment:your text','Generate a fake YouTube comment'],['images jail user:@Alice','Apply a jail overlay to a user\'s avatar'],['react cry / blush / smile / laugh / angry / sleepy','Send an animated reaction GIF']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
    { id:'information', title:'Information Commands', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['userinfo user:@Alice','Detailed info about a member — join date, roles, status, ID'],['serverinfo','Server stats — member count, channels, boosts, owner, creation date'],['hack user:@Alice','Generate a fake (harmless) "hack" terminal for fun'],['report user user:@X category: reason:','Report a user to the Roco moderation team'],['report server server_id: reason:','Report a server to the Roco moderation team']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
  ]
},

'troubleshooting': {
  name:'Troubleshooting', icon:'bug', color:'#f87171', tags:['errors','troubleshoot','fix','permissions'], desc:'Common issues, error codes, permission problems, and how to resolve them.',
  sections:[
    { id:'permissions', title:'Permission Issues', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Most Roco issues are caused by missing Discord permissions. Always check these first.</p></div>
      <div class="steps">
        <div class="step" data-anim="fadeUp"><div class="step-num">1</div><div class="step-body"><h5>Check the Roco role position</h5><p>Roco can only manage roles <em>below</em> its own role. Go to <strong>Server Settings → Roles</strong> and drag the Roco role above any roles it needs to manage.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.05"><div class="step-num">2</div><div class="step-body"><h5>Check channel-level overrides</h5><p>A channel permission override can block Roco even if the role has the permission. Check <strong>Channel Settings → Permissions → Roco</strong> for denied permissions.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.1"><div class="step-num">3</div><div class="step-body"><h5>Grant Administrator (easiest)</h5><p>Grant the Roco role Administrator permission in Server Settings → Roles. This bypasses all channel overrides and hierarchy checks.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.15"><div class="step-num">4</div><div class="step-body"><h5>Re-invite with correct permissions</h5><p>If you added Roco with restricted permissions, re-invite using the official invite link which requests the correct scope.</p></div></div>
      </div>`},
    { id:'error-codes', title:'Error Codes', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>When a command fails, Roco shows an error code. Use the table below to find the cause and fix.</p></div>
      <div class="table-wrap" data-anim="fadeUp" data-delay="0.05"><table class="dtable"><thead><tr><th>Code</th><th>Meaning</th><th>Fix</th></tr></thead><tbody>
        <tr><td>300</td><td>Generic execution error</td><td>Try again. If persistent, report via <code>/report</code></td></tr>
        <tr><td>301</td><td>You lack permissions</td><td>You need the required Discord permission for this command</td></tr>
        <tr><td>302</td><td>Roco lacks permissions</td><td>Grant Roco the missing permission — see Permissions section above</td></tr>
        <tr><td>303</td><td>Invalid arguments</td><td>Check the command options — a required field may be wrong</td></tr>
        <tr><td>304</td><td>Command on cooldown</td><td>Wait for the cooldown to expire before using the command again</td></tr>
        <tr><td>305</td><td>Command not found</td><td>The command may have been disabled — check Settings → Guild Commands</td></tr>
        <tr><td>306</td><td>Cannot send messages here</td><td>Give Roco Send Messages permission in this channel</td></tr>
        <tr><td>307</td><td>Cannot embed links here</td><td>Give Roco Embed Links permission in this channel</td></tr>
        <tr><td>308</td><td>Missing required role</td><td>You need a specific role to use this command in your server's config</td></tr>
        <tr><td>312</td><td>Button interaction expired</td><td>Interactions expire after 15 minutes — run the command again</td></tr>
        <tr><td>315</td><td>Rate limited</td><td>Too many requests — slow down and try again in a moment</td></tr>
        <tr><td>316</td><td>User blacklisted</td><td>You've been blacklisted from Roco — contact support to appeal</td></tr>
        <tr><td>317</td><td>Roco can't manage roles</td><td>Drag the Roco role above the target role in Server Settings</td></tr>
        <tr><td>318</td><td>Roco can't manage channels</td><td>Grant Roco Manage Channels permission</td></tr>
        <tr><td>319</td><td>Database error</td><td>Temporary — try again. If persistent, check rocobot.xyz/status</td></tr>
      </tbody></table></div>`},
    { id:'common-issues', title:'Common Issues & Fixes', render:()=>`
      <div class="faq-list" data-anim="fadeUp">
        ${[
          ['Commands not appearing in Discord','Discord can take up to 1 hour to propagate slash commands globally. If it has been over an hour, kick and re-invite the bot. Check Settings → Guild Commands to ensure the command is not disabled.'],
          ['Bot is online but not responding','Check that the channel is not excluded from commands. Verify Roco has Read Messages, Send Messages, and View Channel in that channel. Run /bot ping to confirm connectivity.'],
          ['Tickets / panels not responding after restart','Button interactions are stateless — they reload from the database on every click. Ensure MongoDB is connected. Check the dashboard Error Log under Settings → Guild Errors for details.'],
          ['Leveling XP stopped awarding','The user or channel may be blacklisted from XP. Check Community → Leveling → Blacklisted Channels/Roles in the dashboard.'],
          ['Music stops or disconnects','24/7 mode requires Basic+. Check that 24/7 is enabled in the dashboard. Also verify Roco has Connect and Speak permissions in the voice channel.'],
          ['Auto-role not assigning','The Roco role must be above the target role in the role hierarchy. Also confirm the server hasn\'t hit the 250-role Discord limit.'],
          ['Dashboard shows "No Access"','You need Manage Server permission OR a Dashboard Role assigned in Settings → Dashboard Roles. Ask a server admin to grant access.'],
          ['IP Verification gate not working','The verification bot must be online. Check rocobot.xyz/status. Ensure the verification channel is visible to unverified members and the panel has been sent recently.'],
        ].map(([q,a])=>`
          <div class="faq-item">
            <button class="faq-q" aria-expanded="false">
              <span>${q}</span>
              <span class="faq-chevron"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></span>
            </button>
            <div class="faq-a" hidden><div class="faq-a-inner prose">${a}</div></div>
          </div>`).join('')}
      </div>`},
    { id:'getting-help', title:'Getting Help', render:()=>`
      <div class="card-block" data-anim="fadeUp"><h4><i data-lucide="help-circle"></i>Support channels</h4><div class="prose"><ul>
        <li><strong>Support server</strong> — <a href="https://discord.gg/TSHE" target="_blank">discord.gg/TSHE</a> for live support from the team</li>
        <li><strong>Status page</strong> — <a href="/status">rocobot.xyz/status</a> for outages and incident history</li>
        <li><strong>Error report</strong> — use <code>/report user</code> or <code>/report server</code> to flag issues to staff</li>
        <li><strong>Dashboard Error Log</strong> — Settings → Guild Errors shows recent bot errors specific to your server</li>
      </ul></div></div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.05"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>When contacting support</strong>Share your server ID (<code>/serverinfo</code>), the exact command you ran, and any error code shown. Screenshots help a lot.</div></div>`},
  ]
},

'mass-tools': {
  name:'Mass Tools', icon:'users-2', color:'#c084fc', tags:['massrole','massban','premium'], desc:'Bulk role assignment and mass ban tools — for large-scale server management.',
  sections:[
    { id:'massrole', title:'Mass Role', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Add or remove a role from every member in the server at once. Useful for restructuring roles or granting a community-wide role.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="terminal"></i>Usage</div>
        <div class="code-block"><span class="v">/massrole role:@Member action:add</span>    <span class="c">add to all members</span>
<span class="v">/massrole role:@OldRole action:remove</span> <span class="c">remove from all members</span></div>
      </div>
      <div class="callout warn" data-anim="fadeUp" data-delay="0.1"><i data-lucide="triangle-alert"></i><div class="callout-body"><strong>Requires Pro+</strong>Mass role operations are rate-limited by Discord. Large servers may take several minutes to complete. Roco processes in batches to avoid API limits.</div></div>`},


  ]
},

};