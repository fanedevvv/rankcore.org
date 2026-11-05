// docsjs/guides/essentials.js — Getting Started, Premium, Dashboard guides
// ─────────────────────────────────────────────────────────────────────────────

export const essentialGuides = {

'getting-started': {
  name:'Getting Started', icon:'rocket', color:'#FF3333', tags:['setup','beginner'], desc:'Invite RankCore, set up permissions, and run your first commands in under 5 minutes.',
  sections:[
    { id:'invite', title:'Inviting RankCore', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Visit <a href="https://rankcore.org" target="_blank">rankcore.org</a> and click the invite button, or run <code>/bot invite</code> in any server where RankCore is already present.</p></div>
      <div class="steps">
        <div class="step" data-anim="fadeUp" data-delay="0.05"><div class="step-num">1</div><div class="step-body"><h5>Click the invite link</h5><p>Opens the Discord authorisation page. Make sure you're logged into the correct Discord account.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.1"><div class="step-num">2</div><div class="step-body"><h5>Select your server</h5><p>Choose from the dropdown. You need <strong>Manage Server</strong> permission on the target server.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.15"><div class="step-num">3</div><div class="step-body"><h5>Authorise permissions</h5><p>Review and click Authorise. RankCore requests only what it needs to function.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.2"><div class="step-num">4</div><div class="step-body"><h5>Verify it's working</h5><p>Run <code>/bot info</code> — you'll see status, latency, and shard info.</p></div></div>
      </div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.25"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>Recommended permission</strong>Grant <code>Administrator</code> for the smoothest setup. At minimum: <code>Manage Roles</code>, <code>Manage Channels</code>, <code>Send Messages</code>, <code>View Channels</code>.</div></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.3">
        <div class="example-label"><i data-lucide="play-circle"></i>Quick verify command</div>
        <div class="code-block"><span class="c">// Run in your server to confirm RankCore is connected</span>
/bot info
<span class="c">// Also useful:</span>
/bot ping    <span class="c">// latency check</span>
/botutils stats  <span class="c">// full system health</span></div>
      </div>`
    },
    { id:'hierarchy', title:'Role Hierarchy', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Move the <strong>RankCore</strong> role to the <strong>top</strong> of your role list in Server Settings → Roles. RankCore can only manage roles that are below its own role in the hierarchy.</p></div>
      <div class="callout warn" data-anim="fadeUp" data-delay="0.05"><i data-lucide="triangle-alert"></i><div class="callout-body"><strong>Most common setup issue</strong>If RankCore says "Missing Permissions" when adding/removing roles, the target role is above the RankCore role. Move RankCore higher in the list.</div></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.1">
        <div class="example-label"><i data-lucide="list-ordered"></i>Correct role order example</div>
        <div class="code-block"><span class="c">✅ Correct order (top to bottom)</span>
<span class="v">1.</span> RankCore              <span class="c">← must be here or higher</span>
<span class="v">2.</span> Server Manager
<span class="v">3.</span> Moderator
<span class="v">4.</span> Member
<span class="v">5.</span> @everyone</div>
      </div>`
    },
    { id:'slash-commands', title:'Slash Commands', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>RankCore uses Discord's native <code>/</code> slash commands. Type <code>/</code> in any channel to browse all available commands. No Message Content Intent required.</p></div>
      <div class="callout info" data-anim="fadeUp" data-delay="0.05"><i data-lucide="info"></i><div class="callout-body"><strong>Legacy prefix commands</strong>RankCore also supports prefix commands (default <code>!</code>). Change with <code>/prefix set [prefix]</code> or from the dashboard Settings → Prefix.</div></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.1">
        <div class="example-label"><i data-lucide="terminal"></i>Essential first commands</div>
        <div class="code-block"><span class="v">/bot info</span>         <span class="c">bot status + latency</span>
<span class="v">/help</span>             <span class="c">full command list with categories</span>
<span class="v">/prefix set !</span>     <span class="c">set legacy prefix to !</span>
<span class="v">/privacy delete</span>   <span class="c">delete your telemetry data</span></div>
      </div>`
    },
    { id:'dashboard', title:'Dashboard Setup', render:()=>`
      <div class="steps">
        <div class="step" data-anim="fadeUp"><div class="step-num">1</div><div class="step-body"><h5>Log in</h5><p>Go to <a href="https://rankcore.org" target="_blank">rankcore.org</a> and authenticate with Discord OAuth2.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.05"><div class="step-num">2</div><div class="step-body"><h5>Select your server</h5><p>Click your server card. Only servers where you have Manage Server permission appear.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.1"><div class="step-num">3</div><div class="step-body"><h5>Navigate hubs</h5><p>Features are grouped: <strong>Moderation</strong>, <strong>Community</strong>, <strong>Tools</strong>, <strong>Settings</strong>. Use the sidebar to navigate.</p></div></div>
      </div>`
    },
  ]
},

'premium': {
  name:'Premium Plans', icon:'crown', color:'#f59e0b', tags:['billing','subscription'], desc:'Compare tiers, upgrade, and redeem codes. Guild-scoped — one sub covers the whole server.',
  sections:[
    { id:'plans', title:'Plan Comparison', render:()=>`
      <div class="plan-grid" data-anim="fadeUp">
        <div class="plan-card lift"><div class="plan-name" style="color:var(--dim)">🔓 Free</div><div class="plan-price">€0<span>/mo</span></div><div class="plan-yrly">&nbsp;</div><div class="plan-features">
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>10 Custom Commands</div>
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>10 Autoresponders</div>
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>2 Ticket Categories</div>
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>Welcome Images</div>
          <div class="plan-feature"><i data-lucide="x" class="no"></i>Music 24/7</div>
          <div class="plan-feature"><i data-lucide="x" class="no"></i>Anti-Nuke</div>
          <div class="plan-feature"><i data-lucide="x" class="no"></i>AI Chatbot</div>
        </div></div>
        <div class="plan-card lift"><div class="plan-name" style="color:var(--blue)">⭐ Basic</div><div class="plan-price">€2.99<span>/mo</span></div><div class="plan-yrly">€24.99/yr — save 30%</div><div class="plan-features">
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>25 Custom Commands</div>
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>5 Ticket Categories</div>
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>Music 24/7</div>
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>Anti-Nuke & Anti-Raid</div>
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>Advanced AutoMod</div>
          <div class="plan-feature"><i data-lucide="x" class="no"></i>Music Filters</div>
          <div class="plan-feature"><i data-lucide="x" class="no"></i>AI Chatbot</div>
        </div></div>
        <div class="plan-card pro-card lift"><div class="plan-name" style="color:var(--brand2)">💎 Pro</div><div class="plan-price">€5.99<span>/mo</span></div><div class="plan-yrly">€49.99/yr — save 30%</div><div class="plan-features">
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>75 Custom Commands</div>
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>15 Ticket Categories</div>
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>Music Filters</div>
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>AI Chatbot</div>
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>Image Gen & VirusTotal</div>
          <div class="plan-feature"><i data-lucide="x" class="no"></i>Custom Branding</div>
        </div></div>
        <div class="plan-card elite-card lift"><div class="plan-name" style="color:var(--gold)">👑 Elite</div><div class="plan-price">€12.99<span>/mo</span></div><div class="plan-yrly">€99.99/yr — save 35%</div><div class="plan-features">
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>Unlimited everything</div>
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>All Pro features</div>
          <div class="plan-feature"><i data-lucide="check" class="yes"></i>Custom Branding (sep. sub)</div>
        </div></div>
      </div>
      <div class="callout info" data-anim="fadeUp" data-delay="0.1"><i data-lucide="info"></i><div class="callout-body"><strong>Guild-scoped</strong>One subscription covers all members of a server. Transfer to a different server at any time from the billing portal.</div></div>`
    },
    { id:'upgrade', title:'How to Upgrade', render:()=>`
      <div class="steps">
        <div class="step" data-anim="fadeUp"><div class="step-num">1</div><div class="step-body"><h5>Open /subscriptions in the dashboard</h5><p>Or click Premium in the sidebar.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.05"><div class="step-num">2</div><div class="step-body"><h5>Select plan and billing cycle</h5><p>Yearly saves 30–35%. Choose the server to apply it to.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.1"><div class="step-num">3</div><div class="step-body"><h5>Pay via Stripe — activates instantly</h5><p>No payment data stored on our servers. Features unlock immediately.</p></div></div>
      </div>
      <div class="callout danger" data-anim="fadeUp" data-delay="0.15"><i data-lucide="triangle-alert"></i><div class="callout-body"><strong>No chargebacks</strong>Initiating a chargeback without contacting support first results in a permanent global blacklist. Email <a href="mailto:support@rankcore.org">support@rankcore.org</a> first.</div></div>`
    },
    { id:'redeem', title:'Redeem a Code', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Received a premium code from a giveaway or promotion?</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="gift"></i>Code redemption commands</div>
        <div class="code-block"><span class="v">/redeem code:YOUR_CODE</span>       <span class="c">personal premium code</span>
<span class="v">/guildredeem code:YOUR_CODE</span>  <span class="c">apply to current server</span></div>
      </div>`
    },
  ]
},

'dashboard-overview': {
  name:'Dashboard Guide', icon:'layout-dashboard', color:'#60a5fa', tags:['setup','navigation'], desc:'Navigate hubs, manage permissions, and find every feature in the dashboard.',
  sections:[
    { id:'hubs', title:'Hub Structure', render:()=>`
      <div class="table-wrap" data-anim="fadeUp"><table class="dtable"><thead><tr><th>Hub</th><th>Features</th></tr></thead><tbody>
        <tr><td>Overview</td><td>Server stats, quick actions, recent activity, bot status</td></tr>
        <tr><td>Moderation</td><td>AutoMod, Logs, Ghost Ping, Verify, Anti-Nuke, Anti-Raid, IP Verification, Mass Join, Anti-Scam</td></tr>
        <tr><td>Community</td><td>Welcome, Goodbye, Booster, Leveling, Reaction Roles, Giveaways, JTC, Suggestions, Counting, Confessions, Invite Config, UwU/Cat Lock, Music</td></tr>
        <tr><td>Tools</td><td>Tickets, Autoresponders, Staff Apps, Embed Builder, Sticky Messages, Uptime, YouTube, Twitch, RankCore AI</td></tr>
        <tr><td>Settings</td><td>Prefix, Command Manager, Dashboard Roles, Global Permissions, Custom Commands, Custom Branding, Auto-Role</td></tr>
      </tbody></table></div>`
    },
    { id:'permissions', title:'Dashboard Permissions', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>By default, users with <strong>Manage Server</strong> can access the dashboard. Grant dashboard access to specific roles without giving them Manage Server using <strong>Settings → Dashboard Roles</strong>.</p></div>
      <div class="callout info" data-anim="fadeUp" data-delay="0.05"><i data-lucide="info"></i><div class="callout-body"><strong>Dashboard role levels</strong>Admin (full access), Manager (most settings), Moderator (moderation tools only).</div></div>`
    },
  ]
},

};