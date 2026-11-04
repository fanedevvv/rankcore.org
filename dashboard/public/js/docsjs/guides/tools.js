// ─────────────────────────────────────────────────────────────────────────────

export const toolsGuides = {

'tickets': {
  name:'Ticket System', icon:'ticket', color:'#6C53FF', tags:['tickets','support'], desc:'A full-featured support ticket system with categories, transcripts, and role-based access.',
  sections:[
    { id:'setup', title:'Setting Up Tickets', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Configure tickets at <strong>Tools → Ticket System</strong> in the dashboard. You can create multiple categories for different request types (e.g. Support, Appeals, Reports).</p></div>
      <div class="steps">
        <div class="step" data-anim="fadeUp"><div class="step-num">1</div><div class="step-body"><h5>Create a category</h5><p>Give it a name, emoji, and description. Each category can have its own channel, role access, and open/close messages.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.05"><div class="step-num">2</div><div class="step-body"><h5>Set the panel channel</h5><p>Choose the channel where the ticket open button is posted.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.1"><div class="step-num">3</div><div class="step-body"><h5>Assign support roles</h5><p>Roles that can see and manage tickets. Non-support members only see their own tickets.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.15"><div class="step-num">4</div><div class="step-body"><h5>Send the panel</h5><p>Click Send Panel — Roco posts the embed with the open button.</p></div></div>
      </div>`},
    { id:'commands', title:'Ticket Commands', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['ticket close','Close the current ticket — prompts for a reason'],['ticket add @user','Add a user to the current ticket'],['ticket remove @user','Remove a user from the current ticket'],['ticket rename','Rename the ticket channel'],['ticket transcript','Generate an HTML transcript and DM it'],['ticket claim','Claim a ticket as yours (removes other support staff)'],['ticket unclaim','Release your claim on a ticket']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
    { id:'transcripts', title:'Transcripts', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>When a ticket is closed, Roco can automatically generate a full HTML transcript and post it to a transcript log channel and/or DM the ticket opener.</p></div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.05"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>Transcript channel</strong>Set a dedicated transcript channel in the dashboard — every closed ticket posts its log there for audit purposes.</div></div>`},
  ]
},

'custom-commands': {
  name:'Custom Commands', icon:'terminal', color:'#6C53FF', tags:['commands','slash','automation'], desc:'Create your own slash commands with rich responses, variables, and conditional logic.',
  sections:[
    { id:'overview', title:'What are Custom Commands?', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Custom Commands let you register your own <code>/command</code> that triggers a configured response — plain text, an embed, a role action, or a chain of actions.</p></div>
      <div class="card-block" data-anim="fadeUp" data-delay="0.05"><h4><i data-lucide="list"></i>Response types</h4>
        <div class="tags"><span class="tag purple">Plain text</span><span class="tag purple">Embed</span><span class="tag purple">Add/remove role</span><span class="tag purple">Send to another channel</span><span class="tag purple">Ephemeral (only visible to user)</span></div>
      </div>`},
    { id:'variables', title:'Variables', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Use dynamic variables in your command responses to personalise output.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="code-2"></i>Available variables</div>
        <div class="code-block"><span class="v">{user}</span>         <span class="c">display name of the user who ran the command</span>
<span class="v">{user.mention}</span>  <span class="c">@mention the user</span>
<span class="v">{user.id}</span>       <span class="c">user Discord ID</span>
<span class="v">{server}</span>        <span class="c">server name</span>
<span class="v">{server.count}</span>  <span class="c">total member count</span>
<span class="v">{channel}</span>       <span class="c">current channel name</span>
<span class="v">{args}</span>          <span class="c">text the user passed as an argument</span></div>
      </div>`},
    { id:'limits', title:'Limits by Plan', render:()=>`
      <div class="table-wrap" data-anim="fadeUp"><table class="dtable"><thead><tr><th>Plan</th><th>Custom Commands</th></tr></thead><tbody>
        <tr><td>Free</td><td>5</td></tr>
        <tr><td>Basic</td><td>25</td></tr>
        <tr><td>Pro</td><td>100</td></tr>
        <tr><td>Elite</td><td>Unlimited</td></tr>
      </tbody></table></div>`},
  ]
},

'autoresponders': {
  name:'Autoresponders', icon:'message-square-reply', color:'#6C53FF', tags:['autoresponder','trigger','automation'], desc:'Automatically reply to messages that match keywords, phrases, or regex patterns.',
  sections:[
    { id:'setup', title:'Creating an Autoresponder', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Go to <strong>Tools → Autoresponders</strong> in the dashboard. Each autoresponder has a trigger and a response.</p></div>
      <div class="table-wrap" data-anim="fadeUp" data-delay="0.05"><table class="dtable"><thead><tr><th>Trigger Type</th><th>Behaviour</th></tr></thead><tbody>
        <tr><td>Exact match</td><td>Message must exactly equal the trigger</td></tr>
        <tr><td>Contains</td><td>Trigger appears anywhere in the message</td></tr>
        <tr><td>Starts with</td><td>Message begins with the trigger</td></tr>
        <tr><td>Ends with</td><td>Message ends with the trigger</td></tr>
        <tr><td>Regex</td><td>Full regular expression match (Pro+)</td></tr>
      </tbody></table></div>`},
    { id:'options', title:'Response Options', render:()=>`
      <div class="card-block" data-anim="fadeUp"><h4><i data-lucide="settings"></i>Configuration options</h4>
        <div class="tags"><span class="tag blue">Plain text or embed response</span><span class="tag blue">Delete trigger message</span><span class="tag blue">Restrict to channels</span><span class="tag blue">Restrict to roles</span><span class="tag blue">Case sensitive toggle</span><span class="tag blue">Cooldown per user</span></div>
      </div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.05"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>Wildcards</strong>Use <code>*</code> as a wildcard in contains-mode triggers. E.g. <code>how*join</code> matches "how do I join", "how can I join", etc.</div></div>`},
  ]
},


'staff-apps': {
  name:'Staff Applications', icon:'clipboard-list', color:'#6C53FF', tags:['applications','staff','forms'], desc:'Build custom application forms and manage submissions directly in Discord.',
  sections:[
    { id:'setup', title:'Creating an Application', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Go to <strong>Tools → Staff Applications</strong>. Build a form with up to 10 questions — short answer, paragraph, or multiple choice.</p></div>
      <div class="steps">
        <div class="step" data-anim="fadeUp"><div class="step-num">1</div><div class="step-body"><h5>Create the form</h5><p>Add questions, set required/optional, and configure the submission channel.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.05"><div class="step-num">2</div><div class="step-body"><h5>Send the panel</h5><p>Post the application panel to a channel. Users click Apply to open the form.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.1"><div class="step-num">3</div><div class="step-body"><h5>Review submissions</h5><p>Staff use Accept / Deny buttons directly on the submitted embed. Accepted users can be auto-assigned a role.</p></div></div>
      </div>`},
    { id:'options', title:'Options & Automation', render:()=>`
      <div class="card-block" data-anim="fadeUp"><h4><i data-lucide="settings-2"></i>Available options</h4>
        <div class="tags"><span class="tag purple">Auto-role on accept</span><span class="tag purple">DM applicant on decision</span><span class="tag purple">Cooldown between submissions</span><span class="tag purple">Require a minimum role to apply</span><span class="tag purple">Acceptance/denial message customisation</span></div>
      </div>`},
  ]
},

'embed-builder': {
  name:'Embed Builder', icon:'layers', color:'#6C53FF', tags:['embed','messages','builder'], desc:'Create and send rich Discord embeds with a visual builder — no coding required.',
  sections:[
    { id:'overview', title:'Using the Embed Builder', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Access the Embed Builder at <strong>Tools → Embed Builder</strong> in the dashboard. Build embeds visually and send them to any channel the bot has access to.</p></div>
      <div class="card-block" data-anim="fadeUp" data-delay="0.05"><h4><i data-lucide="list"></i>Configurable fields</h4>
        <div class="tags"><span class="tag blue">Title &amp; URL</span><span class="tag blue">Description</span><span class="tag blue">Colour</span><span class="tag blue">Author (name, icon, URL)</span><span class="tag blue">Footer (text, icon)</span><span class="tag blue">Thumbnail &amp; image</span><span class="tag blue">Fields (inline or block)</span><span class="tag blue">Timestamp</span></div>
      </div>`},
    { id:'saved', title:'Saved Embeds', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Save embed templates to reuse across announcements, rules posts, or ticket panels. Saved embeds can also be sent via the bot command.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="terminal"></i>Sending a saved embed via command</div>
        <div class="code-block"><span class="v">/embed send name:rules-embed channel:#rules</span>   <span class="c">send saved embed to a channel</span>
<span class="v">/embed edit name:rules-embed</span>                  <span class="c">open the builder to edit it</span></div>
      </div>
      <div class="callout info" data-anim="fadeUp" data-delay="0.1"><i data-lucide="info"></i><div class="callout-body"><strong>Embed limits</strong>Free: 5 saved embeds · Basic: 20 · Pro: 100 · Elite: Unlimited</div></div>`},
  ]
},

};