// docsjs/faq.js — FAQ data for each guide and FAQ renderer
// ─────────────────────────────────────────────────────────────────────────────

export const FAQS = {
  'getting-started': [
    { q: 'Why doesn\'t RankCore respond to commands?', a: 'Check that the RankCore role has <strong>Send Messages</strong> and <strong>View Channel</strong> permissions in the channel. Also verify the bot is online with <code>/bot ping</code>.' },
    { q: 'How do I give RankCore Administrator permission?', a: 'Go to Server Settings → Roles → find the RankCore role → toggle the Administrator permission ON. This is the easiest way to ensure everything works.' },
    { q: 'Can I add RankCore to multiple servers?', a: 'Yes. Use the invite link for each server separately. Each server gets its own independent configuration.' },
    { q: 'Why can\'t I see the dashboard for my server?', a: 'You must have the <strong>Manage Server</strong> Discord permission on that server, OR have been granted a Dashboard Role by an admin in Settings → Dashboard Roles.' },
    { q: 'How do I change the command prefix?', a: 'Run <code>/prefix set [prefix]</code> in Discord, or go to Settings → Prefix in the dashboard.' },
  ],
  'tickets': [
    { q: 'Why does the ticket dropdown show "This interaction failed"?', a: 'This was a known issue caused by database lookups happening before the interaction was acknowledged. Update to the latest version. Make sure MongoDB has a stable connection.' },
    { q: 'Can users have multiple tickets open at once?', a: 'Yes — configure "Max tickets per user" in the dashboard. Set to 1 to enforce one-at-a-time, or higher to allow multiple.' },
    { q: 'How do I prevent specific users from opening tickets?', a: 'Use the "Blacklisted Roles" setting in the ticket dashboard. Assign a "Blacklisted" role to problem users and add that role to the blacklist.' },
    { q: 'Where can I find closed ticket transcripts?', a: 'They\'re posted to your configured log channel automatically on close. Web transcripts are also stored at /guild/:id/transcripts in the dashboard.' },
    { q: 'Why aren\'t ticket buttons responding after a bot restart?', a: 'Buttons are stateless — they re-read from the database every time. A restart should not affect them. If they fail, check the console for errors and verify the database connection.' },
    { q: 'Can I use IP Verification as a ticket prerequisite?', a: 'Indirectly — set an "Unverified Role" in IP Verification and add that role to the ticket blacklist. Users who haven\'t verified will be blocked from opening tickets.' },
  ],
  'custom-commands': [
    { q: 'My command doesn\'t appear in Discord after creating it', a: 'Discord can take up to 1 hour to propagate global slash commands. Usually it\'s instant, but during Discord\'s API maintenance it can take longer. Check the Command Manager to confirm it registered.' },
    { q: 'How do I make a command only visible to admins?', a: 'Set "Required Permission" to "Administrator" in the Rules tab. Discord will automatically hide the command from users without that permission.' },
    { q: 'I\'ve hit the 100 custom command limit — what can I do?', a: 'Discord allows 100 custom slash commands per server. RankCore\'s own commands are global and don\'t count towards it, so delete custom commands you no longer use.' },
    { q: 'Can I use {arg:name} in embed field values?', a: 'Yes — all <code>{variables}</code> including argument references work in embed titles, descriptions, author text, field names, field values, and footer text.' },
    { q: 'What happens if an action fails (e.g. adding a role)?', a: 'The response is still sent to Discord. Actions that fail silently log an error server-side. Ensure RankCore has the correct permissions and its role is above the target role.' },
    { q: 'Can I make a command that only works in specific channels?', a: 'Yes — go to the Rules tab when creating the command, and add channel IDs to the "Allowed Channels" field (one per line). Only those channels will let the command run.' },
  ],
  'ip-verification': [
    { q: 'Will users know their IP is being collected?', a: 'Yes — the verification gate page shows a clear consent notice before any data is collected. Consent is required and validated server-side.' },
    { q: 'Can admins see the actual IP addresses?', a: 'No. IPs are always displayed as <code>[hidden]</code> in the dashboard. Only the verification outcome, risk score, country, and flags are visible to admins.' },
    { q: 'What happens if a legitimate user gets blocked?', a: 'Admins can manually approve blocked users directly from the Records table in the dashboard, which grants the verified role immediately.' },
    { q: 'Does blocking VPNs stop staff who use VPNs?', a: 'You can add trusted Discord IDs or adjust the risk threshold. Alternatively, manually approve staff members who trigger the VPN check.' },
    { q: 'How long is verification data stored?', a: 'Until the server removes the bot (30-day queue) or a user requests deletion. Admins can also delete individual records from the dashboard.' },
    { q: 'Can I require re-verification periodically?', a: 'Yes — enable "Re-verification interval" in the dashboard. Users will be asked to re-verify after the configured number of days.' },
  ],
  'premium': [
    { q: 'Is premium per-server or per-account?', a: 'Per-server (guild-scoped). One subscription covers the entire server — all members benefit from it. You can transfer it to a different server at any time.' },
    { q: 'What happens to my data if I cancel premium?', a: 'Your configuration stays but premium-only features will stop working. Data is retained for 30 days in case you resubscribe. Nothing is deleted immediately.' },
    { q: 'Can I upgrade or downgrade mid-cycle?', a: 'Yes — contact support or manage via the Stripe portal. Upgrades are prorated; downgrades take effect at the end of the billing cycle.' },
    { q: 'I purchased premium but it\'s not showing in my server', a: 'Make sure you selected the correct server during checkout. If it\'s not applied, contact support@rankcore.org with your transaction receipt.' },
    { q: 'Do yearly plans auto-renew?', a: 'Yes, all subscriptions auto-renew via Stripe. You can cancel at any time from the billing portal, and access continues until the period ends.' },
  ],
  'moderation': [
    { q: 'Can I silence a ban so the user doesn\'t know why?', a: 'Yes — use the <code>silent:True</code> option with <code>/ban</code>. No DM is sent to the banned user.' },
    { q: 'How do I bulk-delete old messages?', a: 'Use <code>/purge all [amount]</code> (up to 100). Discord only allows deleting messages less than 14 days old via the API. Older messages must be deleted manually or using channel nuke.' },
    { q: 'What\'s the difference between lockdown and slowmode?', a: 'Lockdown prevents anyone from sending messages. Slowmode sets a delay between messages but still allows sending. Lockdown is for emergencies; slowmode is for managing heavy traffic.' },
    { q: 'Why can\'t RankCore kick/ban a user above me in roles?', a: 'Discord enforces role hierarchy at the API level. RankCore\'s role must be higher than the target user\'s highest role. Move the RankCore role higher in Server Settings → Roles.' },
  ],
  'antinuke': [
    { q: 'Will anti-nuke affect legitimate admin actions?', a: 'Add trusted roles (e.g. your admin role) to the Anti-Nuke whitelist. Actions by users with trusted roles won\'t trigger anti-nuke.' },
    { q: 'Can I get false positives from bots doing bulk operations?', a: 'Yes — whitelist any bot IDs that legitimately perform bulk operations (e.g. backup bots, verification bots). Add their user IDs to the Anti-Nuke bot whitelist.' },
    { q: 'What does "remove dangerous permissions" action do?', a: 'It removes Administrator, Manage Guild, Manage Channels, Manage Roles, and Kick/Ban Members permissions from the perpetrator\'s highest role.' },
  ],
  'music': [
    { q: 'Why isn\'t RankCore playing music?', a: 'Ensure you\'re in a voice channel, and RankCore has Connect and Speak permissions in that channel. Also verify the bot is online and the music system is healthy with <code>/botutils stats</code>.' },
    { q: 'Can I use Spotify links?', a: 'Yes — paste a Spotify track, playlist, or album URL directly into <code>/music play</code>. RankCore resolves it via the Spotify API.' },
    { q: 'Why does 24/7 mode disconnect after a while?', a: '24/7 mode requires Basic tier or higher. If you\'re on Basic+, check that the 24/7 option is enabled in Community → Music in the dashboard.' },
    { q: 'How many songs can I queue at once?', a: 'There\'s no hard limit on the queue itself, but playlists are capped by plan: Free: 50 tracks/playlist, Basic: 75, Pro: 200, Elite: unlimited.' },
  ],
  'custom-branding': [
    { q: 'Will the CB bot have the same slash commands as RankCore?', a: 'Yes — all RankCore slash commands are registered to your bot\'s application ID when you launch Custom Branding. You can hide individual commands from your CB bot in the settings.' },
    { q: 'Does my custom bot need to be in any servers first?', a: 'No — RankCore handles everything including inviting the bot to your server when you launch from the dashboard.' },
    { q: 'What happens if I restart the main RankCore bot?', a: 'Custom Branding runs as a separate isolated process. It continues running independently and is not affected by main bot restarts.' },
    { q: 'Can multiple servers use the same CB bot?', a: 'Yes — one bot token can be used for one Custom Branding subscription. Multiple servers cannot use the same CB bot simultaneously (each needs their own subscription).' },
  ],

  'economy': [
    { q: 'Is the economy global or per-server?', a: 'Global. Your coins, bank balance, and transaction history carry across every server that has RankCore.' },
    { q: 'What happens to my coins if I delete my account?', a: 'All coins, bank balance, and transaction history are permanently erased. This cannot be undone.' },
    { q: 'Can I get banned for cheating the economy?', a: 'Yes. Using exploits, bots, or alternative accounts to farm coins is against the ToS and can result in an account ban.' },
    { q: 'Why did my heist fail even though I had enough coins?', a: 'Heist success is random and not guaranteed. The 1-hour cooldown applies whether you win or lose.' },
  ],
  'games': [
    { q: "Why won't my opponent's game load?", a: "The challenged user must click Accept. If they don't respond within the timeout window (usually 30 seconds), the game expires. Also ensure the opponent is not a bot." },
    { q: 'Can I play singleplayer games in DMs?', a: 'No — games use Discord interactions that require a server context. They must be played in a server channel.' },
  ],
  'family': [
    { q: 'Can I be in multiple families at once?', a: 'You can only have one marriage at a time. You can be adopted into a family while also having your own adopted children.' },
    { q: "What happens if a kidnap attempt fails?", a: "Nothing — no penalty other than triggering the 12-hour cooldown. The victim's parent is not notified of failed attempts." },
    { q: 'Do family relationships persist across servers?', a: 'Yes. Family data (marriages, adoptions, items) is global, just like the economy.' },
  ],
  'troubleshooting': [
    { q: "RankCore was working before and suddenly stopped", a: "Check rankcore.org/status for any active incidents. Also check that the bot hasn't been removed from the server or had its permissions changed." },
    { q: 'I see a "This interaction failed" error', a: 'This usually means the bot took too long to respond (over 3 seconds) or is offline. Check the status page and try again. If persistent, it may be a database connection issue.' },
    { q: 'How do I view errors specific to my server?', a: 'Go to Settings → Guild Errors in the dashboard. This shows a log of recent bot errors, their source, and timestamp — useful for debugging specific feature failures.' },
    { q: 'RankCore kicked me from a voice channel / did something unexpected', a: 'This is usually anti-nuke or anti-raid triggering. Check Security → Anti-Nuke and Anti-Raid settings and whitelist yourself or your management roles.' },
  ],
  'invite-tracking': [
    { q: 'Why does my invite count show 0?', a: 'Invite tracking only counts invites created after the feature was enabled. Historical invites before setup will not be counted.' },
    { q: "Can I manually add bonus invites to a member?", a: "Yes — use the Bonus Invites feature in the dashboard under Moderation → Invite Tracker to manually adjust a member's invite count." },
    { q: 'Why is the same member counted as both fake and left?', a: 'Fake invites are members who joined and left quickly (within a short window). Left invites are members who left after staying longer. They are tracked separately and both subtract from net invites.' },
  ],
  'fun-commands': [
    { q: 'Are the fun command results (pp size, gay %, clanker) real?', a: 'No — all results are randomly generated for entertainment only. They do not reflect any real data about users.' },
    { q: 'Can I disable specific fun commands on my server?', a: 'Yes — go to Settings → Guild Commands in the dashboard. You can enable or disable any individual command for your server.' },
  ],
  'confessions': [
    { q: 'Can moderators see who submitted a confession?', a: 'Only if anonymous mode is disabled in review settings. With anonymous mode on, the submitter is hidden even from reviewers. The bot internally tracks authors for blacklist enforcement only.' },
    { q: 'A confession got past the word filter — what do I do?', a: 'Add the specific phrase to the filter via <code>/confession filter add</code>. For sophisticated evasion (letter substitution, spaces), use regex mode (Pro+) or manually deny in review mode.' },
    { q: 'Can I see confession statistics?', a: 'Yes — run <code>/confession stats</code> to see total submissions, approval rate, pending reviews, and filter hit count.' },
  ],
};

// ── Render FAQs for a guide ─────────────────────────────────────────────────
export function renderFaqSection(guideId) {
  const faqs = FAQS[guideId];
  if (!faqs?.length) return '';

  const items = faqs.map((faq, i) => `
    <div class="faq-item" data-anim="fadeUp" data-delay="${0.05 * i}">
      <button class="faq-q" aria-expanded="false" data-idx="${i}">
        <span>${faq.q}</span>
        <span class="faq-chevron">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      <div class="faq-a" hidden>
        <div class="faq-a-inner prose">${faq.a}</div>
      </div>
    </div>`).join('');

  return `
    <div class="guide-section" id="gs-faq" data-anim="fadeUp">
      <div class="section-header">
        <div class="section-num">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <h2 class="section-title">Frequently Asked Questions</h2>
      </div>
      <div class="faq-list">${items}</div>
    </div>`;
}

// Wire up FAQ accordion interactions
export function initFaqAccordion() {
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      const answer   = btn.nextElementSibling;
      const chevron  = btn.querySelector('.faq-chevron');

      btn.setAttribute('aria-expanded', !expanded);
      answer.hidden = expanded;
      chevron.style.transform = expanded ? '' : 'rotate(180deg)';
    });
  });
}