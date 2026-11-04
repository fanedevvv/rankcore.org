// docsjs/guides/fun.js — Fun Commands, Polls, Counting, Confessions, AFK, Reputation
// ─────────────────────────────────────────────────────────────────────────────

export const funGuides = {

'fun-commands': {
  name:'Fun Commands', icon:'laugh', color:'#f472b6', tags:['fun','games','actions'], desc:'Actions, games, and interactive activities — hug, kiss, truth or dare, and more.',
  sections:[
    { id:'actions', title:'Social Actions', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Social action commands send animated responses mentioning the target user. All use <code>/fun [action] user:@someone</code>.</p></div>
      <div class="cmd-grid" data-anim="fadeUp" data-delay="0.05">
        ${[['hug','Give someone a warm hug 🤗'],['kiss','Kiss someone 😘'],['pat','Pat someone gently 🥰'],['cuddle','Cuddle someone 🥺'],['slap','Give someone a slap 👋'],['tickle','Tickle someone 🤣'],['poke','Poke someone 👉'],['bite','Bite someone 😈'],['lick','Lick someone 😛']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/fun ${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
    { id:'games', title:'Games & Random', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['8ball question:…','Ask the magic 8-ball a yes/no question 🎱'],['dice-roll','Roll a six-sided dice 🎲'],['coin-flip','Flip a coin — heads or tails 🪙'],['rps','Rock Paper Scissors — challenge another user'],['would-you-rather','Get a random would you rather question'],['truth-or-dare','Get a random truth or dare'],['never-have-i-ever','Get a never have I ever prompt'],['joke','Get a random joke 🤣'],['advice','Get a random piece of advice']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/fun ${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
    { id:'misc', title:'Miscellaneous', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['pp-size','Check the size of your pp (random every time) 😳'],['gay','Check how gay someone is 🌈'],['clanker user:…','See how much of a clanker someone is'],['compatibility user1: user2:','Check compatibility between two users ❤️']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/fun ${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.05"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>All results are random</strong>Fun commands produce random or pseudo-random results each time. None of the outputs reflect actual data about users.</div></div>`},
  ]
},

'polls': {
  name:'Polls', icon:'bar-chart-2', color:'#38bdf8', tags:['poll','vote'], desc:'Create live polls with up to 5 options, real-time vote counts, and auto-end.',
  sections:[
    { id:'create', title:'Creating a Poll', render:()=>`
      <div class="example-block" data-anim="fadeUp">
        <div class="example-label"><i data-lucide="terminal"></i>Start a poll</div>
        <div class="code-block"><span class="v">/poll create</span>
  question:  "Should we add a study channel?"
  option1:   "Yes please"
  option2:   "No thanks"
  option3:   "Maybe later"         <span class="c">(optional)</span>
  duration:  60                    <span class="c">(minutes — up to 7 days)</span></div>
      </div>
      <div class="prose" data-anim="fadeUp" data-delay="0.05"><p>Polls support 2–5 options. Live vote counts are shown on each option button and update in real time as users vote. Each user can only vote once and may change their vote before the poll ends.</p></div>`},
    { id:'management', title:'Managing Polls', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['poll end message_id:…','End a poll early and announce the result immediately'],['poll results message_id:…','View current results without ending the poll']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>
      <div class="callout info" data-anim="fadeUp" data-delay="0.05"><i data-lucide="info"></i><div class="callout-body"><strong>Polls survive restarts</strong>All votes are persisted to the database. Active polls are reloaded on bot startup so no data is lost during restarts.</div></div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.1"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>Duration choices</strong>5 min · 15 min · 30 min · 1 hr · 3 hr · 6 hr · 12 hr · 24 hr · 3 days · 7 days</div></div>`},
  ]
},

'counting': {
  name:'Counting', icon:'hash', color:'#34d399', tags:['counting','game','channel'], desc:'Collaborative counting game with milestones, fail actions, and countdown mode.',
  sections:[
    { id:'setup', title:'Setup', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Configure at <strong>Fun → Counting</strong> in the dashboard. Designate a channel — members count up one at a time. The same user cannot count twice in a row.</p></div>
      <div class="steps">
        <div class="step" data-anim="fadeUp"><div class="step-num">1</div><div class="step-body"><h5>Set the counting channel</h5><p>Only messages in this channel trigger the counting system.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.05"><div class="step-num">2</div><div class="step-body"><h5>Configure fail action</h5><p>What happens when someone sends the wrong number: delete only, reset to 0, or reset + timeout.</p></div></div>
        <div class="step" data-anim="fadeUp" data-delay="0.1"><div class="step-num">3</div><div class="step-body"><h5>Set milestones (optional)</h5><p>Give roles or send a message when the count hits specific numbers.</p></div></div>
      </div>`},
    { id:'modes', title:'Modes & Rules', render:()=>`
      <div class="table-wrap" data-anim="fadeUp"><table class="dtable"><thead><tr><th>Rule</th><th>Detail</th></tr></thead><tbody>
        <tr><td>No double counting</td><td>Same user cannot count twice in a row</td></tr>
        <tr><td>Whole numbers only</td><td>Decimals and commas are rejected</td></tr>
        <tr><td>Countdown mode</td><td>Count down from a set number instead of up</td></tr>
        <tr><td>Fail action</td><td>Delete, reset count to 0, or reset + timeout the offender</td></tr>
        <tr><td>Warning message</td><td>Auto-deletes after 30 seconds to keep the channel clean</td></tr>
      </tbody></table></div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.05"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>Milestone roles</strong>Set up automatic role grants when the count reaches specific numbers — great for community achievements.</div></div>`},
  ]
},

'confessions': {
  name:'Confessions', icon:'message-circle', color:'#a78bfa', tags:['confessions','anonymous'], desc:'Anonymous confession system with review mode, categories, word filter, and full moderation tools.',
  sections:[
    { id:'setup', title:'Setup', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Configure at <strong>Fun → Confessions</strong> or run <code>/confession setup</code>. You need at minimum a confession channel.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="terminal"></i>Quick setup</div>
        <div class="code-block"><span class="v">/confession setup</span>
  confess_channel:  #confessions
  review_channel:   #confession-review   <span class="c">(optional)</span>
  log_channel:      #mod-logs            <span class="c">(optional)</span></div>
      </div>
      <div class="callout info" data-anim="fadeUp" data-delay="0.1"><i data-lucide="info"></i><div class="callout-body"><strong>Sending a confession</strong>Members use <code>/confession send text:…</code>. The submission is fully anonymous — the author is never revealed to other members.</div></div>`},
    { id:'review', title:'Review Mode', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Enable review mode to queue every confession before it goes public. Staff approve or deny from the review channel.</p></div>
      <div class="example-block" data-anim="fadeUp" data-delay="0.05">
        <div class="example-label"><i data-lucide="terminal"></i>Configure review</div>
        <div class="code-block"><span class="v">/confession config review</span>
  enabled:              true
  anonymous:            true             <span class="c">(hide submitter from reviewer)</span>
  auto_approve_minutes: 60               <span class="c">(auto-approve after 60 min, 0 = off)</span></div>
      </div>`},
    { id:'categories', title:'Categories', render:()=>`
      <div class="prose" data-anim="fadeUp"><p>Enable categories so members choose a type before submitting. Each category can post to its own channel.</p></div>
      <div class="cmd-grid" data-anim="fadeUp" data-delay="0.05">
        ${[['confession categories toggle enabled:true','Enable the category picker'],['confession categories add label:Vent emoji:😔','Add a category'],['confession categories add label:Wholesome emoji:💛 channel:#wholesome','Category with its own channel'],['confession categories remove label:Vent','Remove a category'],['confession categories list','List all categories']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>`},
    { id:'moderation', title:'Moderation & Word Filter', render:()=>`
      <div class="card-block" data-anim="fadeUp"><h4><i data-lucide="shield"></i>Mod commands</h4><div class="prose"><ul>
        <li><code>/confession blacklist user:@x add:true</code> — block a user permanently</li>
        <li><code>/confession trusted user:@x add:true</code> — bypass cooldown and review</li>
        <li><code>/confession config modroles role:@Mods add:true</code> — grant mod access</li>
        <li><code>/confession config cooldown seconds:300</code> — per-user cooldown</li>
        <li><code>/confession config length min:10 max:1000</code> — character limits</li>
      </ul></div></div>
      <div class="card-block" data-anim="fadeUp" data-delay="0.05"><h4><i data-lucide="filter"></i>Word filter</h4><div class="prose"><ul>
        <li><code>/confession filter toggle enabled:true action:block</code> — block or send to review</li>
        <li><code>/confession filter add words:badword,anotherbad</code> — add blocked words</li>
        <li><code>/confession filter remove word:badword</code></li>
        <li><code>/confession filter list</code> — view all blocked words</li>
      </ul></div></div>`},
  ]
},

'afk': {
  name:'AFK System', icon:'moon', color:'#94a3b8', tags:['afk','status','away'], desc:'Set an AFK status that auto-replies when you are mentioned.',
  sections:[
    { id:'usage', title:'Using AFK', render:()=>`
      <div class="cmd-grid" data-anim="fadeUp">
        ${[['afk set reason:Studying for exams','Mark yourself as AFK with an optional reason'],['afk set','Mark yourself as AFK with the default "AFK" status'],['afk remove','Remove your AFK status manually']].map(([c,d])=>`<div class="cmd-item"><span class="cmd-name">/${c}</span><span class="cmd-desc">${d}</span></div>`).join('')}
      </div>
      <div class="prose" data-anim="fadeUp" data-delay="0.05"><p>While AFK, any time someone mentions you Roco sends an automatic reply: <code>@User is AFK — Studying for exams (set 5 minutes ago)</code>. Your AFK status is cleared automatically the next time you send a message.</p></div>
      <div class="callout tip" data-anim="fadeUp" data-delay="0.1"><i data-lucide="lightbulb"></i><div class="callout-body"><strong>AFK is per-server</strong>Your AFK status only applies in the server where you set it. Set it in multiple servers separately if needed.</div></div>`},
  ]
},

'reputation': {
  name:'Reputation', icon:'star', color:'#f59e0b', tags:['rep','reputation','rating'], desc:'Give users star ratings and track community reputation over time.',
  sections:[
    { id:'usage', title:'Giving Reputation', render:()=>`
      <div class="example-block" data-anim="fadeUp">
        <div class="example-label"><i data-lucide="terminal"></i>Rep commands</div>
        <div class="code-block"><span class="v">/rep user:@Alice rating:5 reason:Helped me set up the bot</span>
<span class="v">/rep-stats user:@Alice</span>     <span class="c">view rep history and average rating</span></div>
      </div>
      <div class="card-block" data-anim="fadeUp" data-delay="0.05"><h4><i data-lucide="info"></i>Rules</h4><div class="prose"><ul>
        <li>Ratings are 1–5 stars</li>
        <li>You cannot rep yourself</li>
        <li>There is a cooldown between reps to the same user</li>
        <li><code>/rep-stats</code> shows total reps, average rating, and recent reviews</li>
      </ul></div></div>`},
  ]
},

};