// docsjs/guides/moderation.js
export const moderationGuides = {

'moderation': {
  name:'Core Moderation', icon:'shield', color:'#f87171', tags:['ban','kick','warn','purge'], desc:'Ban, kick, warn, timeout, purge, lockdown, and full case management.',
  sections:[
    { id:'commands', title:'Command Reference', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['ban','Ban a user — options: reason, severity (low/medium/high/extreme), delete_days, silent, dm_user'],['kick','Kick — options: reason, severity, silent, dm_user'],['timeout add','Timeout 60s–28 days. Options: user, duration, reason, silent, dm_user'],['timeout remove','Remove an active timeout'],['unban','Unban by user ID'],['warn add','Issue a warning tracked per-user'],['warn remove','Remove a warning by case ID'],['purge all','Delete up to 100 messages — filters: user, bot, links, caps, images, mentions, embeds, stickers, webhooks, pins'],['modcase browse','All mod cases with filters'],['modcase lookup','Look up a case number'],['lockdown commit','Instantly lock all server channels'],['lockdown unlock','Unlock after a lockdown'],['slowmode set','Set channel slowmode seconds–months'],['snipe','View recently deleted/edited/bulk-deleted messages'],['role add/remove','Add or remove a role from a single user'],['roleall','Bulk add/remove: all, humans, or bots'],['nick set','Change a member\'s nickname'],['channel nuke','Delete and reclone a channel'],['channel lock/unlock','Lock or unlock a specific channel'],['channel hide/show','Hide or show a channel from @everyone']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
    { id:'cases', title:'Mod Cases', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Every action (ban, kick, timeout, warn) creates a <strong>mod case</strong> with case number, moderator, target, reason, severity, and timestamp.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="terminal"></i>Case management commands</div>
        <div class="code-block"><span class="v">/modcase browse</span>         <span class="c">all cases — filter by type, mod, date</span>
<span class="v">/modcase user @member</span>   <span class="c">all cases for a specific user</span>
<span class="v">/modcase lookup 42</span>      <span class="c">look up case #42</span>
<span class="v">/modcase stats</span>          <span class="c">aggregated server mod stats</span></div>
      </div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.1"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>Severity levels</strong>low, medium, high, extreme. High-severity cases are flagged distinctly in case browsers and the log channel.</div></div>`},
    { id:'examples', title:'Usage Examples', render:()=>`
      <div class="example-block" data-anim="fadeUp">
        <div class="example-label"><i data-lucide="play-circle"></i>Common moderation scenarios</div>
        <div class="code-block"><span class="c">// Silent ban with 7-day message delete</span>
<span class="v">/ban user:@troll reason:"Spam" delete_days:7 silent:True</span>

<span class="c">// Timeout for 1 hour with DM</span>
<span class="v">/timeout add user:@member duration:1h reason:"Spamming" dm_user:True</span>

<span class="c">// Purge last 50 messages from a specific user</span>
<span class="v">/purge user user:@member amount:50</span>

<span class="c">// Lock a channel during an incident</span>
<span class="v">/channel lock #general reason:"Active incident"</span>

<span class="c">// Full server lockdown for raids</span>
<span class="v">/lockdown commit reason:"Raid in progress"</span></div>
      </div>`},
  ]
},

'logging': {
  name:'Logging', icon:'file-text', color:'#60a5fa', tags:['logs','audit'], desc:'Configure per-event log channels for every action on your server.',
  sections:[
    { id:'setup', title:'Setting Up Logs', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Configure at <strong>Moderation → Logs</strong>. Each event category can be directed to a different channel.</p></div>
      <div class="card-block" data-anim="fadeUp" data-delay="0.05"><h4><i data-lucide="list"></i>Loggable categories</h4>
        <div class="tags"><span class="tag blue">Message edits/deletes</span><span class="tag blue">Bulk deletes</span><span class="tag red">Member join/leave</span><span class="tag red">Member ban/unban</span><span class="tag purple">Role add/remove</span><span class="tag purple">Nickname changes</span><span class="tag green">Channel create/edit/delete</span><span class="tag green">Voice join/leave/move</span><span class="tag gold">Mod actions</span><span class="tag gold">Invite events</span><span class="tag blue">Emoji/sticker changes</span></div>
      </div>
      <div class="callout info" data-anim="fadeUp" data-delay="0.1"><i data-lucide="info"></i><div class="callout-body"><strong>Limits</strong>Free: 3 channels · Basic: 6 · Pro: 15 · Elite: Unlimited</div></div>`},
    { id:'opt-out', title:'Opt-Out Logging', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>You can exclude specific users (e.g. bots) and channels from message logs to reduce noise. Configure exclusions in the dashboard under <strong>Moderation → Logs → Exclusions</strong>.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="terminal"></i>Exclude users and channels</div>
        <div class="code-block"><span class="v">/logexclude user @botaccount</span>     <span class="c">exclude a user from all log events</span>
<span class="v">/logexclude channel #bot-cmds</span>   <span class="c">exclude a channel from message logs</span></div>
      </div>
      <div class="callout info" data-anim="fadeUp" data-delay="0.1"><i data-lucide="info"></i><div class="callout-body"><strong>Looking for IP data deletion?</strong>To request erasure of your IP verification record, use <code>/logopt</code> — see the <span data-guide-link="ip-verification" style="color:var(--brand);cursor:pointer;text-decoration:underline">IP Verification guide</span> for details.</div></div>`},
  ]
},

'automod': {
  name:'Advanced AutoMod', icon:'bot', color:'#f59e0b', tags:['automod','spam','filter'], desc:'Automatically detect and act on spam, flagged words, mass-mentions, and more.',
  sections:[
    { id:'rules', title:'Rule Types', render:()=>`
      <div class="table-wrap" data-anim="fadeUp"><table class="dtable"><thead><tr><th>Rule Type</th><th>Detects</th><th>Actions</th></tr></thead><tbody>
        <tr><td>Spam rate</td><td>X messages in Y seconds from same user</td><td>Delete, mute, kick, ban, warn</td></tr>
        <tr><td>Mass mentions</td><td>More than N pings in one message</td><td>Delete, warn, mute</td></tr>
        <tr><td>Flagged words</td><td>Custom blocklist — exact, wildcard, or regex</td><td>Delete, warn, log</td></tr>
        <tr><td>Link filter</td><td>All links or specific domains</td><td>Delete, warn</td></tr>
        <tr><td>Caps abuse</td><td>Messages above X% uppercase</td><td>Delete, warn</td></tr>
        <tr><td>Nuke commands</td><td>Known nuke bot patterns</td><td>Delete, instant ban</td></tr>
        <tr><td>Racism detection</td><td>Slur detection (configurable sensitivity)</td><td>Delete, warn, kick</td></tr>
      </tbody></table></div>
      <div class="callout brand" data-anim="fadeUp" data-delay="0.1"><i data-lucide="zap"></i><div class="callout-body"><strong>Requires Basic+</strong>Advanced AutoMod with thresholds and action chains requires Basic tier. Basic word blocking and spam detection are free.</div></div>`},
    { id:'examples', title:'Example Configurations', render:()=>`
      <div class="example-block" data-anim="fadeUp">
        <div class="example-label"><i data-lucide="settings"></i>Recommended starter setup</div>
        <div class="code-block"><span class="c">Spam rule: 5 messages in 3 seconds → delete + warn</span>
<span class="c">Mass mentions: 8+ pings → delete + 10-min mute</span>
<span class="c">Links: block all except discord.com, youtube.com</span>
<span class="c">Caps: 80%+ caps in 20+ char message → delete</span>

<span class="c">Escalating warn steps:</span>
<span class="v">1st warn</span>  → log only
<span class="v">2nd warn</span>  → 10-min timeout
<span class="v">3rd warn</span>  → 1-hour timeout
<span class="v">5th warn</span>  → kick</div>
      </div>`},
  ]
},

'antinuke': {
  name:'Anti-Nuke', icon:'shield-alert', color:'#ef4444', tags:['antinuke','security'], desc:'Protect against mass deletes, mass bans, and permission takeovers.',
  sections:[
    { id:'what', title:'What it Protects Against', render:()=>`
      <div class="card-block" data-anim="fadeUp"><h4><i data-lucide="shield-x"></i>16+ protected event types</h4>
        <div class="tags"><span class="tag red">Mass channel deletes</span><span class="tag red">Mass role deletes</span><span class="tag red">Mass member bans</span><span class="tag red">Mass kicks</span><span class="tag red">Dangerous permission grants</span><span class="tag red">Webhook mass creation</span><span class="tag red">Bot mass additions</span><span class="tag red">Server setting takeovers</span></div>
      </div>
      <div class="callout gold" style="background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.2);color:#fcd34d" data-anim="fadeUp" data-delay="0.05"><i data-lucide="crown"></i><div class="callout-body"><strong>Requires Basic+</strong>Configure at Moderation → Anti-Nuke in the dashboard.</div></div>`},
    { id:'config', title:'Configuration', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Set thresholds per event — e.g. "if 5 channels deleted in 30 seconds, act". Actions: <strong>ban</strong>, <strong>kick</strong>, <strong>timeout</strong>, <strong>remove dangerous permissions</strong>, or <strong>alert only</strong>.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="settings-2"></i>Recommended thresholds</div>
        <div class="code-block"><span class="c">Channel delete: 3 in 30s → ban perpetrator</span>
<span class="c">Role delete:    3 in 30s → ban perpetrator</span>
<span class="c">Mass ban:       5 in 60s → remove permissions + alert</span>
<span class="c">Bot additions:  2 in 60s → alert only (review first)</span>

<span class="c">Trusted roles:  add your admin/management roles</span>
<span class="c">Bot whitelist:  add backup bots, verification bots</span></div>
      </div>`},
  ]
},

'antiraid': {
  name:'Anti-Raid', icon:'users-round', color:'#f97316', tags:['antiraid','raid','joins'], desc:'Automatically detect and stop mass-join raids before they escalate.',
  sections:[
    { id:'overview', title:'How it Works', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Anti-Raid monitors join rates. When the threshold is exceeded within the time window, it triggers automatically — no manual intervention needed.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="settings"></i>Example configuration</div>
        <div class="code-block"><span class="c">Trigger:       10 joins in 20 seconds</span>
<span class="c">Action:        Kick all joining accounts</span>
<span class="c">Account age:   Auto-kick accounts newer than 7 days</span>
<span class="c">Auto-unlock:   Re-open channels after 10 minutes</span></div>
      </div>`},
  ]
},

'ip-verification': {
  name:'IP Verification', icon:'fingerprint', color:'#a78bfa', tags:['verification','vpn','security'], desc:'Gate server access with IP analysis — block VPNs, proxies, alts, and geo-restrictions.',
  sections:[
    { id:'overview', title:'What is IP Verification?', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>IP Verification gates server entry behind a one-time secure link. Users click Verify → see a consent page → after agreeing, their IP is analysed against your configured rules.</p></div>
      <div class="callout warn" data-anim="fadeUp" data-delay="0.05"><i data-lucide="shield"></i><div class="callout-body"><strong>Privacy-first</strong>IPs require explicit user consent, are AES-256 encrypted, and never shown to admins in plaintext. See <a href="/privacy#s7">Privacy Policy §07</a>.</div></div>`},
    { id:'setup', title:'Setup', render:()=>`
      <div class="steps">
        <div class="step" data-anim="fadeUp"><div class="step-num">1</div><div class="step-body"><h5>Open Moderation → IP Verification</h5><p>In the server dashboard.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.05"><div class="step-num">2</div><div class="step-body"><h5>Set panel channel &amp; verified role</h5><p>The channel where the panel is posted, and the role granted on passing.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.1"><div class="step-num">3</div><div class="step-body"><h5>Enable checks</h5><p>VPN, proxy, Tor, hosting IPs, alt detection, account age, country allow/blocklist.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.15"><div class="step-num">4</div><div class="step-body"><h5>Set fail action &amp; send panel</h5><p>None, kick, ban, or alert-only. Then click Send Panel.</p></div></div>
      </div>`},
    { id:'checks', title:'Available Checks', render:()=>`
      <div class="table-wrap" data-anim="fadeUp"><table class="dtable"><thead><tr><th>Check</th><th>What it detects</th></tr></thead><tbody>
        <tr><td>VPN Block</td><td>Known VPN provider IP ranges</td></tr>
        <tr><td>Proxy Block</td><td>Open proxy servers</td></tr>
        <tr><td>Tor Block</td><td>Tor exit nodes</td></tr>
        <tr><td>Hosting Block</td><td>Datacenter/cloud IPs (bot traffic)</td></tr>
        <tr><td>Risk Score</td><td>Threat score 0–100 — flag or block above threshold</td></tr>
        <tr><td>Alt Detection</td><td>Multiple Discord accounts from same IP</td></tr>
        <tr><td>Account Age</td><td>Min account age in days before allowing</td></tr>
        <tr><td>Country Allow/Blocklist</td><td>ISO 2-letter codes</td></tr>
      </tbody></table></div>`},
    { id:'records', title:'Verification Records', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>All attempts are stored in the dashboard. Admins see: outcome, flag reasons, country, risk score. IP is always <code>[hidden]</code>.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="database"></i>Available admin actions per record</div>
        <div class="code-block"><span class="v">✅ Manual approve</span>   <span class="c">grant verified role immediately</span>
<span class="v">🔨 Manual ban</span>       <span class="c">ban directly from the record</span>
<span class="v">🗑️ Delete record</span>    <span class="c">GDPR erasure — removes from production</span>
<span class="v">📊 CSV export</span>       <span class="c">export up to 5000 records for audit</span></div>
      </div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.1">
        <div class="example-label"><i data-lucide="shield-off"></i>User data deletion — <code>/privacy</code></div>
        <div class="code-block"><span class="v">/privacy delete</span>   <span class="c">purge all your IP verification records from the website</span>
<span class="v">/privacy stop</span>    <span class="c">opt out — stop future requests being logged</span>
<span class="v">/privacy resume</span>  <span class="c">opt back in to request logging</span></div>
      </div>
      <div class="prose" data-anim="fadeUp" data-delay="0.15"><p><code>/privacy</code> is a user-facing command available to any member. <code>delete</code> immediately purges all stored records and webhook log messages. <code>stop</code> adds you to an exclusion list so future requests are not logged. <code>resume</code> removes you from the exclusion list.</p></div>
      <div class="callout info" data-anim="fadeUp" data-delay="0.2"><i data-lucide="info"></i><div class="callout-body"><strong>GDPR &amp; privacy</strong>Data erasure requests are processed immediately. IPs are stored AES-256 encrypted and are never shown to admins in plaintext. See <a href="/privacy#s7">Privacy Policy §07</a> for full details.</div></div>`},
  ]
},



'antiscam': {
  name:'Anti-Scam', icon:'shield-x', color:'#ef4444', tags:['antiscam','phishing','links'], desc:'Automatically detect and remove known scam and phishing links from messages.',
  sections:[
    { id:'overview', title:'How it Works', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Anti-Scam checks every message against a continuously updated database of known phishing and scam domains. Matched links are acted on immediately.</p></div>
      <div class="card-block" data-anim="fadeUp" data-delay="0.05"><h4><i data-lucide="list"></i>What it catches</h4>
        <div class="tags"><span class="tag red">Discord Nitro scams</span><span class="tag red">Steam gift card phishing</span><span class="tag red">Fake &quot;free robux&quot; sites</span><span class="tag red">Crypto phishing links</span><span class="tag red">Typosquatted Discord/Steam domains</span></div>
      </div>`},
    { id:'setup', title:'Setup', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Run <code>/antiscam</code> in Discord or go to <strong>Security &rarr; Anti-Scam</strong> in the dashboard.</p></div>
      <div class="table-wrap" data-anim="fadeUp" data-delay="0.05"><table class="dtable"><thead><tr><th>Setting</th><th>Description</th></tr></thead><tbody>
        <tr><td>Enabled</td><td>Toggle anti-scam on or off</td></tr>
        <tr><td>Action</td><td>delete only &middot; delete + warn &middot; delete + timeout &middot; delete + ban</td></tr>
        <tr><td>Log channel</td><td>Posts a log embed whenever a scam link is caught</td></tr>
      </tbody></table></div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.1"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>Recommended action</strong>Start with <code>delete + warn</code>. Escalate to <code>delete + timeout</code> for repeat offenders.</div></div>`},
  ]
},

'ghost-ping': {
  name:'Ghost Ping Detection', icon:'ghost', color:'#a78bfa', tags:['ghost-ping','mentions'], desc:'Catch members who ping others then immediately delete their message.',
  sections:[
    { id:'overview', title:'What is a Ghost Ping?', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>A ghost ping is when someone mentions a user then immediately deletes the message. The target gets notified but cannot see what was said. Roco detects this and posts a public warning.</p></div>
      <div class="callout warn" data-anim="fadeUp" data-delay="0.05"><i data-lucide="triangle-alert"></i><div class="callout-body"><strong>Escalating visibility</strong>Warnings stay visible longer each time: 1st offence &rarr; 15 seconds &middot; 2nd &rarr; 60 seconds &middot; 3rd+ &rarr; 500 seconds.</div></div>`},
    { id:'setup', title:'Setup', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Configure at <strong>Moderation &rarr; Anti Ghost Ping</strong> in the dashboard, or run <code>/anti-ghost-ping</code>.</p></div>
      <div class="card-block" data-anim="fadeUp" data-delay="0.05"><h4><i data-lucide="settings"></i>Configuration options</h4>
        <div class="tags"><span class="tag purple">Enable / disable</span><span class="tag purple">Exempt channels</span><span class="tag purple">Exempt roles</span><span class="tag purple">Log channel</span></div>
      </div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.1"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>Self-pings ignored</strong>Detection skips self-mentions and bot messages to avoid false positives.</div></div>`},
  ]
},

};