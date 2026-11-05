import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
  if (!DISCORD_BOT_TOKEN) {
    return new Response(JSON.stringify({ error: 'DISCORD_BOT_TOKEN is not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const headers = {
    'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  };

  try {
    // Fetch bot user info
    const botRes = await fetch('https://discord.com/api/v10/users/@me', { headers });
    const botData = await botRes.json();
    if (!botRes.ok) throw new Error(`Bot user fetch failed: ${JSON.stringify(botData)}`);

    // Fetch bot's guilds with member counts
    const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds?with_counts=true', { headers });
    const guildsData = await guildsRes.json();
    if (!guildsRes.ok) throw new Error(`Guilds fetch failed: ${JSON.stringify(guildsData)}`);

    // Fetch gateway bot info (shards, session limits)
    const gatewayRes = await fetch('https://discord.com/api/v10/gateway/bot', { headers });
    const gatewayData = await gatewayRes.json();
    if (!gatewayRes.ok) throw new Error(`Gateway fetch failed: ${JSON.stringify(gatewayData)}`);

    // Calculate total approximate members across guilds
    let totalMembers = 0;
    const guildDetails = [];

    for (const guild of guildsData) {
      const memberCount = guild.approximate_member_count ?? 0;
      totalMembers += memberCount;
      guildDetails.push({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        memberCount,
        owner: guild.owner || false,
      });
    }

    const result = {
      bot: {
        username: botData.username,
        discriminator: botData.discriminator,
        id: botData.id,
        avatar: botData.avatar,
      },
      servers: guildsData.length,
      totalMembers,
      guilds: guildDetails,
      shards: gatewayData.shards || 1,
      sessionStartLimit: {
        total: gatewayData.session_start_limit?.total || 0,
        remaining: gatewayData.session_start_limit?.remaining || 0,
        resetAfter: gatewayData.session_start_limit?.reset_after || 0,
        maxConcurrency: gatewayData.session_start_limit?.max_concurrency || 1,
      },
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching Discord bot stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
