'use strict';

/**
 * Ține la zi mesajul cu Saphirex Launcher din #descărcări: la fiecare release nou de pe GitHub
 * editează versiunea și mărimea (și lista de funcții), restul mesajului rămâne neschimbat.
 */

const { EmbedBuilder } = require('discord.js');

const CHANNEL_ID  = '1564954941854846986';
const MESSAGE_ID  = '1567801443044560999';
const RELEASES    = 'https://api.github.com/repos/fanedevvv/saphirex-launcher-releases/releases/latest';
const DL          = 'https://github.com/fanedevvv/saphirex-launcher-releases/releases/latest/download';
const INTERVAL_MS = 10 * 60 * 1000;

let lastVersion = null;
let running = false;

function describe(version, sizeMb) {
  return [
    '## <:games:1567801369900089405> Saphirex Launcher',
    'Intră pe **rpg.saphirex.ro** direct din launcher — fără configurări, fără bătăi de cap.',
    '',
    '### <:join:1567801374501109820> Descărcare',
    `> <:files:1567796970964394044> **[Installer (recomandat)](${DL}/SaphirexLauncher-Setup.exe)** — se instalează și îți pune scurtătură pe desktop`,
    `> <:pages:1567801372223479808> **[Portable](${DL}/SaphirexLauncher-Portable.exe)** — rulează direct, fără instalare`,
    '',
    // Launcher-ul nu e semnat cu certificat, așa că browserul și Windows îl pot marca la prima descărcare
    '### <:warn:1567797033224642605> Dacă primești un avertisment',
    '> <:arrow:1567796951527850055> **Chrome / Edge** („periculos” sau „nu e descărcat des”): la descărcare apasă **⋯** → **Păstrează** (*Keep*)',
    '> <:arrow:1567796951527850055> **Windows** („Windows protected your PC”): apasă **Mai multe informații** (*More info*) → **Rulează oricum** (*Run anyway*)',
    '-# Avertismentul apare pentru că launcher-ul nu are un certificat plătit. Descarcă-l doar din linkurile de aici.',
    '',
    // Alarme false la antivirus: launcher-ul injectează SA-MP exact ca samp.exe, iar motoarele euristice văd tiparul
    '### <:lockk:1567796977809367122> Antivirus (alarmă falsă)',
    '> <:arrow:1567796951527850055> 1-2 antiviruși pot da o alarmă de tip `Heur` sau `ml.score`. E **alarmă falsă**: launcher-ul injectează SA-MP exact ca `samp.exe` original, iar motoarele care ghicesc după tipare se sperie de asta.',
    '> <:arrow:1567796951527850055> Build-urile sunt făcute automat de GitHub și se descarcă doar din linkurile oficiale de mai sus — nimeni nu umblă la ele între timp.',
    '-# Dacă ar fi un virus adevărat l-ar marca zeci de antiviruși, nu unul-doi cu nume de „bănuială”.',
    '',
    '### <:sparkles:1567797006288560209> Ce primești',
    '> <:refresh:1567801365500137522> **Actualizări automate** — launcher-ul se updatează singur',
    '> <:thunderr:1567797012991189134> **Conectare rapidă** la server dintr-un singur click',
    '> <:info:1567801367811330098> **Status live** — jucătorii online, ping-ul și detaliile serverului',
    '> <:pages:1567801372223479808> **Staff** — echipa serverului, cu profilul de Discord al fiecăruia',
    '> <:files:1567796970964394044> **Bug-uri** — raportezi cu `/bug` și vezi în launcher când e rezolvat',
    '> <:lockk:1567796977809367122> **Sigur** — descărcare oficială direct de pe GitHub',
    '',
    '### <:info:1567801367811330098> Detalii',
    `> <:arrow:1567796951527850055> **Versiune:** \`v${version}\``,
    `> <:arrow:1567796951527850055> **Mărime:** ~${sizeMb} MB`,
    '> <:arrow:1567796951527850055> **Sistem:** Windows 10 / 11',
  ].join('\n');
}

async function sync(client) {
  if (running || !client.isReady()) return;
  running = true;
  try {
    const res = await fetch(RELEASES, { headers: { 'User-Agent': 'rankcore-saphirex', Accept: 'application/vnd.github+json' } });
    if (!res.ok) return;
    const rel = await res.json();
    const version = /^v?(\d+\.\d+\.\d+)/.exec(rel.tag_name || '')?.[1];
    const setup = rel.assets?.find((a) => a.name === 'SaphirexLauncher-Setup.exe');
    if (!version || !setup || version === lastVersion) return;

    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    const message = await channel?.messages?.fetch(MESSAGE_ID).catch(() => null);
    if (!message?.editable || !message.embeds[0]) return;

    const description = describe(version, Math.round(setup.size / 1048576));
    if (message.embeds[0].description !== description) {
      const embed = EmbedBuilder.from(message.embeds[0]).setDescription(description).setTimestamp(new Date(rel.published_at));
      await message.edit({ embeds: [embed] }); // butoanele de descărcare rămân neschimbate
      console.log(`[saphirex] Mesajul cu launcher-ul arată acum v${version}`);
    }
    lastVersion = version;
  } catch (err) {
    console.warn('[saphirex] Nu am putut actualiza mesajul cu launcher-ul:', err.message);
  } finally {
    running = false;
  }
}

module.exports = function startSaphirexLauncherMessage(client) {
  // Pornește după login (ca changelogAnnouncer); sync() așteaptă oricum ca botul să fie gata
  setTimeout(() => sync(client), 20_000);
  setInterval(() => sync(client), INTERVAL_MS);
};

module.exports.describe = describe;
