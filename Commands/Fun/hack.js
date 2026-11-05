const { SlashCommandBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const ms = require("ms");

const font = (size, weight = 400) =>
  `${weight} ${size}px ${GlobalFonts.has("Fira Code") ? "Fira Code" : GlobalFonts.has("Consolas") ? "Consolas" : "monospace"}`;

function generateRandomIP() {
  return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

function generateRandomMAC() {
  const chars = '0123456789ABCDEF';
  let mac = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 2 === 0) mac += ':';
    mac += chars[Math.floor(Math.random() * chars.length)];
  }
  return mac;
}

function generateRandomHash() {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 32; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

function generateFakeData(target) {
  const locations = ['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'San Jose, CA'];
  const browsers = ['Chrome 118.0.5993.88', 'Firefox 119.0', 'Safari 17.1', 'Edge 118.0.2088.76'];
  const devices = ['Windows 11 Pro', 'macOS Sonoma 14.1', 'Ubuntu 22.04 LTS', 'Android 14', 'iOS 17.1'];
  const passwords = ['password123', 'qwerty456', 'letmein789', 'admin2023', 'welcome1', '123456789'];

  return {
    ip: generateRandomIP(),
    location: locations[Math.floor(Math.random() * locations.length)],
    mac: generateRandomMAC(),
    browser: browsers[Math.floor(Math.random() * browsers.length)],
    device: devices[Math.floor(Math.random() * devices.length)],
    email: `${target.username}@gmail.com`,
    password: passwords[Math.floor(Math.random() * passwords.length)],
    hash: generateRandomHash(),
    accounts: Math.floor(Math.random() * 20) + 5,
    files: Math.floor(Math.random() * 50) + 10,
    cookies: Math.floor(Math.random() * 200) + 50
  };
}

async function renderHackingCanvas(target, stage = 'complete') {
  const W = 1000, H = 700;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Hacker color scheme
  const BG = "#000000";
  const GREEN = "#00ff00";
  const RED = "#ff0000";
  const YELLOW = "#ffff00";
  const WHITE = "#ffffff";
  const GRAY = "#808080";
  const DARK_GREEN = "#008000";

  const MONO_FONT = GlobalFonts.has("Fira Code") ? "Fira Code" : 
                   GlobalFonts.has("Consolas") ? "Consolas" : "monospace";

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Matrix-style background effect
  ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillRect(x, y, 2, Math.random() * 20 + 5);
  }

  // Terminal window
  const termX = 20, termY = 20, termW = W - 40, termH = H - 40;
  
  // Terminal border
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 2;
  ctx.strokeRect(termX, termY, termW, termH);

  // Terminal header
  ctx.fillStyle = DARK_GREEN;
  ctx.fillRect(termX + 2, termY + 2, termW - 4, 30);
  
  ctx.fillStyle = WHITE;
  ctx.font = `bold 14px ${MONO_FONT}`;
  ctx.fillText("HACKER TERMINAL v2.1.3 - UNAUTHORIZED ACCESS", termX + 10, termY + 22);

  // Terminal buttons
  const buttonY = termY + 8;
  ctx.fillStyle = RED;
  ctx.fillRect(termX + termW - 80, buttonY, 15, 15);
  ctx.fillStyle = YELLOW;
  ctx.fillRect(termX + termW - 60, buttonY, 15, 15);
  ctx.fillStyle = GREEN;
  ctx.fillRect(termX + termW - 40, buttonY, 15, 15);

  // Generate fake data
  const fakeData = generateFakeData(target);

  // Terminal content
  let yPos = termY + 60;
  const lineHeight = 20;
  
  ctx.font = `12px ${MONO_FONT}`;

  const lines = [
    { text: `root@hacker:~$ ./hack_user.sh ${target.username}`, color: GREEN },
    { text: "", color: WHITE },
    { text: "[+] INITIALIZING HACK PROTOCOL...", color: GREEN },
    { text: "[+] TARGET ACQUIRED: " + target.username, color: GREEN },
    { text: "[!] BYPASSING SECURITY MEASURES...", color: YELLOW },
    { text: "", color: WHITE },
    { text: "=== SYSTEM INFORMATION ===", color: RED },
    { text: `IP Address: ${fakeData.ip}`, color: WHITE },
    { text: `Location: ${fakeData.location}`, color: WHITE },
    { text: `MAC Address: ${fakeData.mac}`, color: WHITE },
    { text: `Device: ${fakeData.device}`, color: WHITE },
    { text: `Browser: ${fakeData.browser}`, color: WHITE },
    { text: "", color: WHITE },
    { text: "=== CREDENTIALS EXTRACTED ===", color: RED },
    { text: `Email: ${fakeData.email}`, color: WHITE },
    { text: `Password: ${fakeData.password}`, color: WHITE },
    { text: `Session Hash: ${fakeData.hash}`, color: GRAY },
    { text: "", color: WHITE },
    { text: "=== DATA BREACH SUMMARY ===", color: RED },
    { text: `Social Media Accounts: ${fakeData.accounts} compromised`, color: WHITE },
    { text: `Files Accessed: ${fakeData.files} documents`, color: WHITE },
    { text: `Cookies Stolen: ${fakeData.cookies} entries`, color: WHITE },
    { text: "", color: WHITE },
    { text: "[+] DOWNLOADING PERSONAL DATA...", color: GREEN },
    { text: "████████████████████████ 100%", color: GREEN },
    { text: "", color: WHITE },
    { text: "[!] WARNING: ILLEGAL ACTIVITY DETECTED", color: RED },
    { text: "[!] THIS IS A SIMULATION - NO REAL HACKING OCCURRED", color: RED },
    { text: "", color: WHITE },
    { text: `[+] HACK COMPLETE - ${target.username} PWNED!`, color: GREEN },
    { text: "", color: WHITE },
    { text: "root@hacker:~$ _", color: GREEN }
  ];

  // Draw terminal lines
  lines.forEach((line, index) => {
    if (yPos + lineHeight > termY + termH - 20) return; // Don't overflow
    
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, termX + 15, yPos);
    yPos += lineHeight;
  });

  // Glitch effect
  if (Math.random() > 0.7) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.1)";
    ctx.fillRect(0, Math.random() * H, W, 2);
  }

  // Scanlines effect
  ctx.fillStyle = "rgba(0, 255, 0, 0.05)";
  for (let i = 0; i < H; i += 4) {
    ctx.fillRect(0, i, W, 1);
  }

  return canvas.toBuffer("image/png");
}

async function renderLoadingCanvas(message, progress = 0) {
  const W = 800, H = 200;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const BG = "#000000";
  const GREEN = "#00ff00";
  const RED = "#ff0000";
  const WHITE = "#ffffff";

  const MONO_FONT = GlobalFonts.has("Fira Code") ? "Fira Code" : 
                   GlobalFonts.has("Consolas") ? "Consolas" : "monospace";

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Border
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  // Title
  ctx.fillStyle = RED;
  ctx.font = `bold 24px ${MONO_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("HACKING IN PROGRESS", W / 2, 50);

  // Status message
  ctx.fillStyle = WHITE;
  ctx.font = `16px ${MONO_FONT}`;
  ctx.fillText(message, W / 2, 90);

  // Progress bar
  const barX = 50, barY = 120, barW = W - 100, barH = 20;
  
  // Progress bar background
  ctx.strokeStyle = GREEN;
  ctx.strokeRect(barX, barY, barW, barH);
  
  // Progress bar fill
  ctx.fillStyle = GREEN;
  ctx.fillRect(barX + 2, barY + 2, (barW - 4) * (progress / 100), barH - 4);

  // Progress text
  ctx.fillStyle = WHITE;
  ctx.font = `12px ${MONO_FONT}`;
  ctx.fillText(`${Math.round(progress)}%`, W / 2, barY + barH + 20);

  // Loading dots
  const dots = ".".repeat((Math.floor(Date.now() / 500) % 4));
  ctx.fillStyle = GREEN;
  ctx.font = `20px ${MONO_FONT}`;
  ctx.fillText(dots, W / 2 + 100, 90);

  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hack')
    .setDescription("Hack someone. (Just for fun, don\'t try this in real life)")
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('Unlucky soul you want to hack.')
        .setRequired(true)
    ),
  async execute(interaction, client) {
    const snitchuserid = interaction.user.id;
    const hackself = interaction.user.id;
    try {
      const target = interaction.options.getUser('target');

             if (target.id === hackself) {
      return interaction.reply({
        content: `<:crossy:1567796959648030831> no you cant hack yourself dumbass.`,
        ephemeral: false
      });
    }
       if (target.id === process.env.OWNER_ID) {
      return interaction.reply({
        content: `<:crossy:1567796959648030831> no not this time. im snitchin. <@${process.env.OWNER_ID}>!!! <@${snitchuserid}> tried hacking you!!! BLACKLIST THEM NOW!!!`,
        ephemeral: false
      });
    
    }

    
      // Initial loading screen
      const loadingBuffer1 = await renderLoadingCanvas("INITIATING HACKING PROTOCOL...", 0);
      const loadingFile1 = new AttachmentBuilder(loadingBuffer1, { name: "hacking-1.png" });

      await interaction.reply({
        content: `<:LEred:1567796934545121280> **INITIATING HACKING PROTOCOL**\nTarget: ${target}\nPlease wait...`,
        files: [loadingFile1]
      });

      const time1 = "3s";
      setTimeout(async function () {
        const loadingBuffer2 = await renderLoadingCanvas("GAINING ACCESS TO SECURE SERVER...", 15);
        const loadingFile2 = new AttachmentBuilder(loadingBuffer2, { name: "hacking-2.png" });
        
        await interaction.editReply({
          content: `<:error:1567796968758050868> **ACCESS GRANTED**\nGaining access to ${target}'s secure server...`,
          files: [loadingFile2]
        });
      }, ms(time1));

      const time2 = "6s";
      setTimeout(async function () {
        const loadingBuffer3 = await renderLoadingCanvas("BYPASSING FIREWALLS AND ENCRYPTION...", 35);
        const loadingFile3 = new AttachmentBuilder(loadingBuffer3, { name: "hacking-3.png" });
        
        await interaction.editReply({
          content: `<:fire:1567796972125945888> **FIREWALL BREACHED**\nBypassing firewalls and encryption...`,
          files: [loadingFile3]
        });
      }, ms(time2));

      const time3 = "9s";
      setTimeout(async function () {
        const loadingBuffer4 = await renderLoadingCanvas("EXTRACTING CONFIDENTIAL INFORMATION...", 55);
        const loadingFile4 = new AttachmentBuilder(loadingBuffer4, { name: "hacking-4.png" });
        
        await interaction.editReply({
          content: `<:n_utils:1567796996830658573> **CONFIDENTIAL DATA EXPOSED**\nExtracting confidential information...`,
          files: [loadingFile4]
        });
      }, ms(time3));

      const time4 = "12s";
      setTimeout(async function () {
        const loadingBuffer5 = await renderLoadingCanvas("ACCESSING PERSONAL EMAILS...", 70);
        const loadingFile5 = new AttachmentBuilder(loadingBuffer5, { name: "hacking-5.png" });
        
        await interaction.editReply({
          content: `<:announcement:1567796950265241662> **EMAIL COMPROMISED**\nAccessing personal emails...\nEmail: ${target.username}@gmail.com\nPassword: ••••••••••`,
          files: [loadingFile5]
        });
      }, ms(time4));

      const time5 = "15s";
      setTimeout(async function () {
        const loadingBuffer6 = await renderLoadingCanvas("ANALYZING SOCIAL MEDIA ACCOUNTS...", 85);
        const loadingFile6 = new AttachmentBuilder(loadingBuffer6, { name: "hacking-6.png" });
        
        await interaction.editReply({
          content: `📱 **SOCIAL MEDIA ACCOUNTS HACKED**\nAnalyzing social media accounts...`,
          files: [loadingFile6]
        });
      }, ms(time5));

      const time6 = "18s";
      setTimeout(async function () {
        const loadingBuffer7 = await renderLoadingCanvas("LOCATING HIDDEN FILES...", 95);
        const loadingFile7 = new AttachmentBuilder(loadingBuffer7, { name: "hacking-7.png" });
        
        await interaction.editReply({
          content: `<:n_search:1567796994792230953> **HIDDEN FILES EXPOSED**\nLocating hidden files...\nFiles found: ${Math.floor(Math.random() * 50) + 10}`,
          files: [loadingFile7]
        });
      }, ms(time6));

      const time7 = "21s";
      setTimeout(async function () {
        const hackCompleteBuffer = await renderHackingCanvas(target, 'complete');
        const hackCompleteFile = new AttachmentBuilder(hackCompleteBuffer, { name: "hack-complete.png" });
        
        await interaction.editReply({
          content: `<a:tickyy:1567797045253644368> **HACK COMPLETE**\n<:minigames:1567796978929238076> Target: ${target}\n<:error:1567796968758050868> **DISCLAIMER: This is completely fake and for entertainment purposes only!**`,
          files: [hackCompleteFile]
        });

        // Send fake "hacked info" to user's DMs
        try {
          const dmHackBuffer = await renderHackingCanvas(target, 'complete');
          const dmHackFile = new AttachmentBuilder(dmHackBuffer, { name: "your-hacked-data.png" });
          
          await interaction.user.send({
            content: `<:LEred:1567796934545121280> **"HACKED" DATA FOR ${target.username}**\n\n<:error:1567796968758050868> **IMPORTANT:** This is completely FAKE data generated for fun! No real hacking occurred.\n\n<:minigames:1567796978929238076> This is just a prank command for entertainment purposes.`,
            files: [dmHackFile]
          });
        } catch (error) {
          // If DM fails, just continue
          console.log("Could not send DM to user");
        }
      }, ms(time7));

    } catch (error) {
      console.error(error);
      await interaction.editReply({
        content: "<:crossy:1567796959648030831> **HACK FAILED**\nTarget's security was too strong! (Or something went wrong...)",
        files: []
      });
    }
  }
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */
