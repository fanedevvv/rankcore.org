// ── Cheesy lines by tier ──────────────────────────────────────────────────────

const LINES = {
  // 1–20% — doomed
  doomed: [
    "Two magnets, same pole. Destined to repel.",
    "The stars crossed, then crossed back out.",
    "Even Romeo and Juliet had better odds.",
    "Love tried. Love failed. Love left.",
    "A love story — told backwards.",
    "The universe said no. Repeatedly.",
    "Not even a GPS could navigate this relationship.",
    "Some doors are locked for a reason. 🚪",
    "Astrology is weeping right now.",
    "History will not remember this ship.",
    "The vibe check failed. Catastrophically.",
    "Love is blind. Even blind love saw this coming.",
    "A tragedy in one act. No intermission.",
    "This ship sailed. Straight into an iceberg. 🧊",
  ],

  // 21–40% — rocky
  rocky: [
    "Sparks fly, but most burn out quickly.",
    "You're a plot twist in each other's story.",
    "Love: difficult. Worth it? Jury's out.",
    "Like oil and water — beautiful when shaken.",
    "You'd need a miracle. Miracles happen.",
    "A rough draft of a love story. Keep editing.",
    "The rollercoaster hasn't stopped yet. Hang on. 🎢",
    "Opposites attract. Eventually. Maybe.",
    "Against all odds — which are, admittedly, bad.",
    "Plot armour may be required.",
    "Love is a battlefield. Pack accordingly. 🎒",
    "Two puzzle pieces. Different boxes.",
    "The rom-com hasn't reached the good part yet.",
    "Chaotic energy. Questionable chemistry. Possible love.",
  ],

  // 41–60% — potential
  potential: [
    "The heart wants what the heart wants — eventually.",
    "A slow burn that might just catch fire.",
    "Written in pencil, not pen. There's hope.",
    "Butterflies are warming up their wings.",
    "Somewhere between 'maybe' and 'definitely maybe'.",
    "A love story loading… please wait. <:n_loading:1567796992556666982>",
    "The ingredients are there. Someone just needs to cook.",
    "Right person, wrong timeline — or is it? <:1430986244921495654:1567796929587576852>",
    "The pilot episode of something great.",
    "Could be nothing. Could be everything.",
    "Promising. Very promising.",
    "The universe is on the fence. 🌌",
    "A coin flip away from something magical.",
    "Potential: through the roof. Execution: pending.",
  ],

  // 61–80% — lovely
  lovely: [
    "Two hearts, one frequency.",
    "Someone out there is writing fanfiction about you two.",
    "You complete each other's sentences — and playlists.",
    "The universe is conspiring in your favour.",
    "Hold on tight — this one's special.",
    "Your energy? Dangerously compatible.",
    "A love story the poets wish they wrote.",
    "Built different. Built for each other.",
    "Even the stars are shipping this. <:boost:1567796953599836280>",
    "Where you lead, they follow. Willingly.",
    "This could go in a museum. <:files:1567796970964394044>",
    "Certified wholesome. Certified electric.",
    "The kind of love songs are written about.",
    "The sequel is always better. This is the sequel.",
    "Rare. Like finding WiFi in the middle of nowhere. <:ping:1567796998902521920>",
  ],

  // 81–99% — soulmates
  soulmates: [
    "Your hearts beat in perfect sync. <:boost:1567796953599836280>",
    "Written in the stars since the Big Bang.",
    "Scientists can't explain it. We don't need to.",
    "If love had a leaderboard, you'd top it.",
    "Soulmates? The word was invented for this moment.",
    "The universe kept rearranging itself just for this.",
    "Two souls. One wavelength. No signal lost.",
    "Forget butterflies — this is a whole zoo. 🦋",
    "Someone planned this. It wasn't an accident.",
    "This kind of love only happens once. Guard it.",
    "The math doesn't lie. Neither does the heart.",
    "Statistically improbable. Emotionally inevitable.",
    "Destiny called. You both picked up. 📞",
    "If love were a sport, you'd both be MVPs. <:1430986209995526274:1567796911350747206>",
    "Even the moon is jealous of your glow tonight. 🌙",
  ],

  // 100% — perfect
  perfect: [
    "Mathematically, cosmically, undeniably perfect. 💍",
    "100%. No notes. No revisions. Perfection. <:Red_Heart:1567796949271191642>",
    "The algorithm has spoken. You are it.",
    "Beyond soulmates. Beyond science. Beyond words.",
    "The universe ran out of superlatives. <:boost:1567796953599836280>",
  ],
};

// ── Easter eggs ───────────────────────────────────────────────────────────────
// Each entry: { test: (a, b) => bool, line: string, tier?: string }
// `tier` overrides the colour theme when provided.
// `a` and `b` are already normalised (lowercased, emoji-stripped, trimmed).

const EASTER_EGGS = [
  // ── Same name ──────────────────────────────────────────────────────────────
  {
    test: (a, b) => a === b,
    line: "Loving yourself first. Iconic. 🪞",
    tier: 'lovely',
  },

  // ── Classic literature ─────────────────────────────────────────────────────
  {
    test: (a, b) => pair(a, b, 'romeo', 'juliet'),
    line: "Star-crossed and absolutely iconic. <:Red_Heart:1567796949271191642>",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'romeo', 'rosaline'),
    line: "The original heartbreak. He traded up, you know.",
    tier: 'doomed',
  },
  {
    test: (a, b) => pair(a, b, 'elizabeth', 'darcy') || pair(a, b, 'lizzie', 'darcy') || pair(a, b, 'lizzie bennet', 'mr darcy'),
    line: "It is a truth universally acknowledged… <:files:1567796970964394044>",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'scarlett', 'rhett') || pair(a, b, 'scarlett ohara', 'rhett butler'),
    line: "Frankly my dear — actually, please care. <:Red_Heart:1567796949271191642>",
    tier: 'rocky',
  },
  {
    test: (a, b) => pair(a, b, 'heathcliff', 'catherine') || pair(a, b, 'heathcliff', 'cathy'),
    line: "Wuthering Heights called. It's not a compliment. 🌩️",
    tier: 'doomed',
  },
  {
    test: (a, b) => pair(a, b, 'jane', 'rochester') || pair(a, b, 'jane eyre', 'mr rochester'),
    line: "Reader, they married. Eventually. Dramatically.",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'gatsby', 'daisy') || pair(a, b, 'jay gatsby', 'daisy buchanan'),
    line: "Old sport, this was never going to work. <:LEgreen:1567796933307666515>",
    tier: 'doomed',
  },

  // ── Movies ────────────────────────────────────────────────────────────────
  {
    test: (a, b) => pair(a, b, 'jack', 'rose') || pair(a, b, 'jack dawson', 'rose dewitt'),
    line: "There was room on that door, Rose. 🚢",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'noah', 'allie') || pair(a, b, 'noah calhoun', 'allie hamilton'),
    line: "If you're a bird, I'm a bird. 🐦",
    tier: 'perfect',
  },
  {
    test: (a, b) => pair(a, b, 'edward', 'bella') || pair(a, b, 'edward cullen', 'bella swan'),
    line: "Eternal. Icy. Somehow still a vibe. 🧛",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'harry', 'ginny') || pair(a, b, 'harry potter', 'ginny weasley'),
    line: "The chosen one chose wisely. <:thunderr:1567797012991189134>",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'hermione', 'ron') || pair(a, b, 'hermione granger', 'ron weasley'),
    line: "Bickering since year one. In love since year one. 🦁",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'han', 'leia') || pair(a, b, 'han solo', 'princess leia'),
    line: "I know. <:boost:1567796953599836280>",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'wall-e', 'eve'),
    line: "Across galaxies of trash, love found a way. <:n_bot:1567796985816154144><:Red_Heart:1567796949271191642>",
    tier: 'perfect',
  },
  {
    test: (a, b) => pair(a, b, 'shrek', 'fiona'),
    line: "Better out than in — and better together. 🧅",
    tier: 'perfect',
  },
  {
    test: (a, b) => pair(a, b, 'donkey', 'dragon'),
    line: "Nobody believed in this ship. Nobody was more wrong. 🐉",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'batman', 'catwoman') || pair(a, b, 'bruce wayne', 'selina kyle') || pair(a, b, 'bruce', 'selina'),
    line: "Hero. Villain. Complicated. 🦇🐱",
    tier: 'rocky',
  },
  {
    test: (a, b) => pair(a, b, 'ken', 'barbie'),
    line: "Life in plastic. It's fantastic. <:Red_Heart:1567796949271191642>",
    tier: 'perfect',
  },

  // ── TV Shows ──────────────────────────────────────────────────────────────
  {
    test: (a, b) => pair(a, b, 'jim', 'pam') || pair(a, b, 'jim halpert', 'pam beesly'),
    line: "The slow burn to end all slow burns. 📷",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'michael', 'holly') || pair(a, b, 'michael scott', 'holly flax'),
    line: "She's my morning. My evening. My soulmate.",
    tier: 'perfect',
  },
  {
    test: (a, b) => pair(a, b, 'dwight', 'angela') || pair(a, b, 'dwight schrute', 'angela martin'),
    line: "Secret. Complicated. Absolutely fated. 🐱",
    tier: 'lovely',
  },
  {
    test: (a, b) => pair(a, b, 'chandler', 'monica') || pair(a, b, 'chandler bing', 'monica geller'),
    line: "Could this BE any more compatible? <:eco:1567796967197900842>",
    tier: 'perfect',
  },
  {
    test: (a, b) => pair(a, b, 'ross', 'rachel') || pair(a, b, 'ross geller', 'rachel green'),
    line: "They were on a break. Love wasn't.",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'joey', 'food') || pair(a, b, 'joey tribbiani', 'food'),
    line: "Joey doesn't share food. But he'd share this. 🍕",
    tier: 'perfect',
  },
  {
    test: (a, b) => pair(a, b, 'mulder', 'scully') || pair(a, b, 'fox mulder', 'dana scully'),
    line: "The truth is out there. So is this ship. 👽",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'sherlock', 'watson') || pair(a, b, 'sherlock holmes', 'john watson'),
    line: "Elementary, my dear Watson. Obviously meant to be.",
    tier: 'lovely',
  },
  {
    test: (a, b) => pair(a, b, 'chuck', 'blair') || pair(a, b, 'chuck bass', 'blair waldorf'),
    line: "I'm Chuck Bass. That's apparently enough. 🎩",
    tier: 'rocky',
  },
  {
    test: (a, b) => pair(a, b, 'meredith', 'derek') || pair(a, b, 'meredith grey', 'derek shepherd'),
    line: "Pick me. Choose me. Love me. 🏥",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'leslie', 'ben') || pair(a, b, 'leslie knope', 'ben wyatt'),
    line: "Overly enthusiastic. Perfectly matched. Waffles involved. 🧇",
    tier: 'perfect',
  },

  // ── Real/celebrity ────────────────────────────────────────────────────────
  {
    test: (a, b) => pair(a, b, 'taylor', 'travis') || pair(a, b, 'taylor swift', 'travis kelce'),
    line: "She's a mastermind. He caught the ball AND the girl. 🏈",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'beyonce', 'jay-z') || pair(a, b, 'beyoncé', 'jay z') || pair(a, b, 'bey', 'hov'),
    line: "Empire state of love. <:1430986209995526274:1567796911350747206>",
    tier: 'perfect',
  },
  {
    test: (a, b) => pair(a, b, 'kim', 'kanye') || pair(a, b, 'kim kardashian', 'kanye west'),
    line: "A historic collab. Complicated discography.",
    tier: 'rocky',
  },
  {
    test: (a, b) => pair(a, b, 'brad', 'jennifer') || pair(a, b, 'brad pitt', 'jennifer aniston'),
    line: "We're still not over it. <:Red_Heart:1567796949271191642>",
    tier: 'doomed',
  },
  {
    test: (a, b) => pair(a, b, 'brad', 'angelina') || pair(a, b, 'brad pitt', 'angelina jolie'),
    line: "Complicated. Beautiful. Very complicated.",
    tier: 'rocky',
  },

  // ── Games ─────────────────────────────────────────────────────────────────
  {
    test: (a, b) => pair(a, b, 'mario', 'peach') || pair(a, b, 'mario', 'princess peach'),
    line: "He crossed worlds, jumped castles — all for you. 🍄",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'link', 'zelda') || pair(a, b, 'link', 'princess zelda'),
    line: "A legend of love. Hyrule approves. 🗡️",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'kratos', 'atreus'),
    line: "Boy. Just… boy. 🪓",
    tier: 'lovely',
  },
  {
    test: (a, b) => pair(a, b, 'geralt', 'yennefer') || pair(a, b, 'geralt of rivia', 'yennefer'),
    line: "Bound by destiny. Annoyed by destiny. Love anyway. ⚔️",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'joel', 'ellie') || pair(a, b, 'joel miller', 'ellie williams'),
    line: "You're gonna be okay, kiddo. 🍄",
    tier: 'perfect',
  },
  {
    test: (a, b) => includes(a, 'minecraft') || includes(b, 'minecraft'),
    line: "Would die for you. Respawns. Dies again. ⛏️",
    tier: 'lovely',
  },
  {
    test: (a, b) => includes(a, 'fortnite') || includes(b, 'fortnite'),
    line: "No build mode? Love still finds a way.",
    tier: 'potential',
  },

  // ── Anime ─────────────────────────────────────────────────────────────────
  {
    test: (a, b) => pair(a, b, 'naruto', 'hinata') || pair(a, b, 'naruto uzumaki', 'hinata hyuga'),
    line: "She believed in him first. That matters. 🍜",
    tier: 'soulmates',
  },
  {
    test: (a, b) => pair(a, b, 'naruto', 'sasuke') || pair(a, b, 'naruto uzumaki', 'sasuke uchiha'),
    line: "A bond that transcends rivalry, friendship, and common sense. 🍜",
    tier: 'lovely',
  },
  {
    test: (a, b) => pair(a, b, 'goku', 'chi-chi') || pair(a, b, 'goku', 'chichi'),
    line: "He trains constantly. She somehow still loves him. 🐉",
    tier: 'lovely',
  },
  {
    test: (a, b) => pair(a, b, 'vegeta', 'bulma'),
    line: "He insulted her. She built him a spaceship. It's love. <:boost:1567796953599836280>",
    tier: 'rocky',
  },
  {
    test: (a, b) => pair(a, b, 'light', 'l') || pair(a, b, 'light yagami', 'l lawliet'),
    line: "A deadly game of cat and mouse. <:files:1567796970964394044>",
    tier: 'doomed',
  },

  // ── Miscellaneous fun ─────────────────────────────────────────────────────
  {
    test: (a, b) => pair(a, b, 'tom', 'jerry'),
    line: "Chaos. Pure chaos. And yet, inseparable. 🐭🐱",
    tier: 'rocky',
  },
  {
    test: (a, b) => pair(a, b, 'spongebob', 'patrick') || pair(a, b, 'spongebob squarepants', 'patrick star'),
    line: "Best friends. Possibly more. Bikini Bottom is not telling. 🌊",
    tier: 'lovely',
  },
  {
    test: (a, b) => pair(a, b, 'tom', 'jerry'),
    line: "Eternal rivals. Eternal companions. Same thing, really. 🐭",
    tier: 'rocky',
  },
  {
    test: (a, b) => includes(a, 'claude') || includes(b, 'claude'),
    line: "An AI is involved. Unexpectedly wholesome. <:n_bot:1567796985816154144><:Red_Heart:1567796949271191642>",
    tier: 'potential',
  },
  {
    test: (a, b) => includes(a, 'chatgpt') || includes(b, 'chatgpt'),
    line: "Competitor detected. Claude is concerned. <:n_bot:1567796985816154144>",
    tier: 'doomed',
  },
  {
    test: (a, b) => includes(a, 'siri') || includes(b, 'siri'),
    line: "I'm sorry, I didn't understand that love.",
    tier: 'rocky',
  },
  {
    test: (a, b) => includes(a, 'alexa') || includes(b, 'alexa'),
    line: "Alexa, play 'Can't Help Falling in Love'. <:n_music:1567796993403658261>",
    tier: 'lovely',
  },
  {
    test: (a, b) => includes(a, 'mom') || includes(b, 'mom') || includes(a, 'mum') || includes(b, 'mum'),
    line: "Sir, this is a Wendy's. 👀",
    tier: 'doomed',
  },
  {
    test: (a, b) => includes(a, 'pizza') || includes(b, 'pizza'),
    line: "A love that truly delivers. 🍕",
    tier: 'perfect',
  },
  {
    test: (a, b) => includes(a, 'coffee') || includes(b, 'coffee'),
    line: "The most stable relationship of all time. <:eco:1567796967197900842>",
    tier: 'perfect',
  },
  {
    test: (a, b) => includes(a, 'sleep') || includes(b, 'sleep'),
    line: "The greatest love story of our generation. 😴",
    tier: 'perfect',
  },
  {
    test: (a, b) => includes(a, 'wifi') || includes(b, 'wifi') || includes(a, 'wi-fi') || includes(b, 'wi-fi'),
    line: "Connection: strong. Always. <:ping:1567796998902521920><:Red_Heart:1567796949271191642>",
    tier: 'perfect',
  },
  {
    test: (a, b) => includes(a, 'cat') || includes(b, 'cat'),
    line: "A cat is involved. The cat is indifferent. Typical. 🐱",
    tier: 'rocky',
  },
  {
    test: (a, b) => includes(a, 'dog') || includes(b, 'dog'),
    line: "A dog is involved. The dog approves enthusiastically. 🐶",
    tier: 'lovely',
  },
  {
    test: (a, b) => includes(a, 'money') || includes(b, 'money') || includes(a, 'cash') || includes(b, 'cash'),
    line: "Can't buy love. Can't stop trying, apparently. <:Currency:1567796932041121873>",
    tier: 'rocky',
  },
  {
    test: (a, b) => includes(a, 'gym') || includes(b, 'gym') || includes(a, 'protein') || includes(b, 'protein'),
    line: "Do you even lift, bro? Apparently love does. 💪",
    tier: 'lovely',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True if a===x && b===y OR a===y && b===x (order-insensitive pair match) */
function pair(a, b, x, y) {
  return (a === x && b === y) || (a === y && b === x);
}

/** True if name contains substring */
function includes(name, sub) {
  return name.includes(sub);
}

/**
 * Normalises a name for easter egg matching.
 * Strips emoji, collapses whitespace, lowercases.
 */
function normalise(name) {
  return name
    .replace(/\p{Emoji_Presentation}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns tier name based on percent. */
function getTier(percent) {
  if (percent <= 20) return 'doomed';
  if (percent <= 40) return 'rocky';
  if (percent <= 60) return 'potential';
  if (percent <= 80) return 'lovely';
  if (percent < 100) return 'soulmates';
  return 'perfect';
}

/**
 * Returns { line, tier } — checks easter eggs first, falls back to the pool.
 * `tier` in the result may differ from the percent-based tier if an easter
 * egg overrides it (e.g. "shrek + fiona" always gives 'perfect').
 *
 * @param {string} nameA
 * @param {string} nameB
 * @param {number} percent  1–100
 * @param {number} seed     Integer for deterministic pool selection
 */
function getCheesyLine(nameA, nameB, percent, seed) {
  const a = normalise(nameA);
  const b = normalise(nameB);

  for (const egg of EASTER_EGGS) {
    if (egg.test(a, b)) {
      return {
        line: egg.line,
        tier: egg.tier ?? getTier(percent),
      };
    }
  }

  const tier = getTier(percent);
  const pool = LINES[tier];
  return {
    line: pool[seed % pool.length],
    tier,
  };
}

module.exports = { getCheesyLine, getTier, LINES, EASTER_EGGS };