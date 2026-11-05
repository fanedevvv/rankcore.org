// docsjs/guides/advanced.js
export const advancedGuides = {

'custom-branding': {
  name:'Custom Branding', icon:'paintbrush', color:'#c084fc', tags:['branding','identity','elite'], desc:'Run RankCore under your own bot identity — custom name, avatar, status, and token.',
  sections:[
    { id:'what', title:'What is Custom Branding?', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Custom Branding runs RankCore under a completely separate Discord application — your own bot with your name, avatar, and identity. Members see YOUR bot. All features work identically behind the scenes.</p></div>
      <div class="card-block" data-anim="fadeUp" data-delay="0.05"><h4><i data-lucide="package"></i>What you can customise</h4><div class="prose"><ul>
        <li>Bot name (up to 32 characters)</li>
        <li>Custom avatar URL</li>
        <li>Embed accent colour and footer text</li>
        <li>Discord status: Playing / Listening / Watching / Competing / Custom</li>
        <li>Online status: online / idle / dnd / invisible</li>
        <li>Per-command visibility — hide any commands from your CB bot</li>
      </ul></div></div>
      <div class="tags" data-anim="fadeUp" data-delay="0.1"><span class="tag gold">Separate standalone subscription</span></div>`},
    { id:'setup', title:'Setup', render:()=>`
      <div class="steps">
        <div class="step" data-anim="fadeUp"><div class="step-num">1</div><div class="step-body"><h5>Create a Discord Application</h5><p>Go to <a href="https://discord.com/developers/applications" target="_blank">discord.com/developers/applications</a> → New Application. Name it what your community will see.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.05"><div class="step-num">2</div><div class="step-body"><h5>Create a Bot user &amp; copy token</h5><p>Under the Bot tab → Add Bot → copy the token. <strong>Never share it.</strong></p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.1"><div class="step-num">3</div><div class="step-body"><h5>Open Settings → Custom Branding</h5><p>Paste the token (stored AES-256-GCM encrypted), configure identity, click Launch.</p></div></div>
      </div>
      <div class="callout danger" data-anim="fadeUp" data-delay="0.15"><i data-lucide="key"></i><div class="callout-body"><strong>Token security</strong>A bot token is like a password. Never share it, commit it to git, or paste it anywhere except the RankCore dashboard. If compromised, regenerate it immediately in the Discord Developer Portal.</div></div>`},
  ]
},

'backups': {
  name:'Server Backups', icon:'database-backup', color:'#22d3ee', tags:['backup','restore'], desc:'Save and restore server configurations — channels, roles, settings, and more.',
  sections:[
    { id:'what', title:'What is Backed Up', render:()=>`
      <div class="card-block" data-anim="fadeUp"><h4><i data-lucide="list"></i>Backup includes</h4><div class="prose"><ul>
        <li>All channels — names, topics, permissions, position</li>
        <li>All roles — permissions, colours, hoisting</li>
        <li>Server icon and banner URL</li>
        <li>AFK channel and timeout settings</li>
        <li>RankCore feature configurations</li>
      </ul></div></div>
      <div class="tags" data-anim="fadeUp" data-delay="0.05"><span class="tag blue">Free: 2</span><span class="tag gold">Basic: 5</span><span class="tag purple">Pro: 15</span><span class="tag green">Elite: ∞</span></div>`},
    { id:'commands', title:'Commands', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        <div class="cmd-item"><span class="cmd-name">/backup create</span><span class="cmd-desc">Save the current server state</span></div>
        <div class="cmd-item"><span class="cmd-name">/backup restore</span><span class="cmd-desc">Restore. Scope options: channels, roles, both, noxx-config</span></div>
        <div class="cmd-item"><span class="cmd-name">/backup list</span><span class="cmd-desc">All saved backups with timestamps</span></div>
        <div class="cmd-item"><span class="cmd-name">/backup state</span><span class="cmd-desc">Details of what a specific backup contains</span></div>
      </div>
      <div class="callout warn" data-anim="fadeUp" data-delay="0.05"><i data-lucide="triangle-alert"></i><div class="callout-body"><strong>Restore is destructive</strong>Restoring channels deletes current channels and recreates them. Always create a new backup before restoring.</div></div>`},
  ]
},

'ai-chatbot': {
  name:'AI Chatbot', icon:'sparkles', color:'#8b6fff', tags:['ai','chatbot','pro'], desc:'Chat with RankCore AI in the dashboard or deploy it as a live chatbot in your server channels.',
  sections:[
    { id:'overview', title:'Overview', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>RankCore AI gives you two ways to use AI in your community:</p></div>
      <div class="table-wrap" data-anim="fadeUp" data-delay="0.05"><table class="dtable"><thead><tr><th>Mode</th><th>Where</th><th>Plan</th></tr></thead><tbody>
        <tr><td><strong>Dashboard AI Chat</strong></td><td>Chat with RankCore AI at <a href="/ai">/ai</a> — private to you, no setup</td><td>All tiers (free)</td></tr>
        <tr><td><strong>In-Server Chatbot</strong></td><td>A designated channel where your members chat with the AI</td><td>Pro+</td></tr>
      </tbody></table></div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.1"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>Dashboard AI</strong>Available at <a href="/ai">/ai</a> with no configuration. Supports multi-turn conversation, code formatting, and markdown. Great for admins who want AI assistance for writing announcements, rule sets, or server descriptions.</div></div>`},
    { id:'in-server', title:'In-Server Chatbot Setup', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>The in-server chatbot makes RankCore AI available to your members directly inside Discord. Go to <strong>Fun → AI Chatbot</strong> in the dashboard to configure it.</p></div>
      <div class="steps">
        <div class="step" data-anim="fadeUp"><div class="step-num">1</div><div class="step-body"><h5>Choose a chatbot channel</h5><p>This is the channel where members send messages and receive AI replies. RankCore responds to every message in this channel.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.05"><div class="step-num">2</div><div class="step-body"><h5>Write a system prompt</h5><p>Define the AI's personality, focus, and rules for your server. See the <a href="#gs-prompts">Writing a Good Prompt</a> section below.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.1"><div class="step-num">3</div><div class="step-body"><h5>Configure access &amp; limits</h5><p>Set allowed roles, per-user cooldown, and the model to use.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.15"><div class="step-num">4</div><div class="step-body"><h5>Enable and save</h5><p>Toggle the chatbot on — RankCore starts responding in that channel immediately.</p></div></div>
      </div>
      <div class="callout warn" data-anim="fadeUp" data-delay="0.2"><i data-lucide="triangle-alert"></i><div class="callout-body"><strong>Channel visibility</strong>Make sure the chatbot channel is clearly labelled so members know what it's for. Consider setting slowmode to avoid spam.</div></div>`},
    { id:'config', title:'Configuration Options', render:()=>`
      <div class="table-wrap" data-anim="fadeUp"><table class="dtable"><thead><tr><th>Setting</th><th>Description</th></tr></thead><tbody>
        <tr><td>Chatbot channel</td><td>The channel where the AI listens and replies</td></tr>
        <tr><td>System prompt</td><td>Instructions that define the AI's personality and behaviour</td></tr>
        <tr><td>Allowed roles</td><td>Restrict access — leave empty to allow all members</td></tr>
        <tr><td>Per-user cooldown</td><td>Minimum seconds between a user's messages (0 = none)</td></tr>
        <tr><td>Model</td><td>Choose from available Groq models (speed vs quality tradeoff)</td></tr>
        <tr><td>Ignore bots</td><td>Toggle whether the AI responds to messages from other bots</td></tr>
        <tr><td>Reply mode</td><td>Reply-to-message (threads the response) or plain message</td></tr>
      </tbody></table></div>`},
    { id:'prompts', title:'Writing a Good System Prompt', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>The system prompt is the most important configuration. It sets the AI's name, tone, scope, and limits. A good prompt makes the AI feel native to your community rather than generic.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="bot"></i>Example — Gaming community helper</div>
        <div class="code-block"><span class="c">You are Aria, the helper for the Pixel Gaming community.</span>
<span class="c">You are friendly, concise, and focused on gaming topics.</span>
<span class="c">Answer questions about server rules, events, and games we play.</span>
<span class="c">For ban appeals, always direct users to #appeals.</span>
<span class="c">Never discuss politics, religion, or controversial topics.</span>
<span class="c">Keep responses under 3 short paragraphs.</span></div>
      </div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.1">
        <div class="example-label"><i data-lucide="bot"></i>Example — Study server tutor</div>
        <div class="code-block"><span class="c">You are a patient study tutor for a university Discord server.</span>
<span class="c">Help students understand concepts — do not write their essays for them.</span>
<span class="c">Subjects covered: maths, physics, computer science, history.</span>
<span class="c">If a question is outside those topics, politely say you can't help.</span>
<span class="c">Always show your working for maths problems step by step.</span></div>
      </div>
      <div class="card-block" data-anim="fadeUp" data-delay="0.15"><h4><i data-lucide="check-circle-2"></i>Prompt best practices</h4><div class="prose"><ul>
        <li>Give the AI a <strong>name</strong> — it makes interactions feel intentional</li>
        <li>State what it <strong>should not</strong> do as clearly as what it should</li>
        <li>Mention key server channels (e.g. "direct ban appeals to #appeals")</li>
        <li>Set a <strong>response length</strong> expectation — Discord messages look best short</li>
        <li>Add tone guidance: formal, casual, friendly, professional</li>
      </ul></div></div>`},
    { id:'limits', title:'Limits & Availability', render:()=>`
      <div class="table-wrap" data-anim="fadeUp"><table class="dtable"><thead><tr><th>Feature</th><th>Free</th><th>Basic</th><th>Pro</th><th>Elite</th></tr></thead><tbody>
        <tr><td>Dashboard AI (/ai)</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
        <tr><td>In-server chatbot</td><td>❌</td><td>❌</td><td>✅</td><td>✅</td></tr>
        <tr><td>Custom system prompt</td><td>—</td><td>—</td><td>✅</td><td>✅</td></tr>
        <tr><td>Model selection</td><td>—</td><td>—</td><td>✅</td><td>✅ + priority</td></tr>
      </tbody></table></div>
      <div class="callout brand" data-anim="fadeUp" data-delay="0.05"><i data-lucide="zap"></i><div class="callout-body"><strong>Pro+ required</strong>Upgrade at <a href="/premium">rankcore.org/premium</a> to unlock the in-server chatbot and all configuration options.</div></div>`},
  ]
},

};