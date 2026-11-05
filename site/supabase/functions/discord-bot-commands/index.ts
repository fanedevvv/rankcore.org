import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DiscordCommand {
  id: string;
  name: string;
  description: string;
  type?: number;
  options?: DiscordCommandOption[];
}

interface DiscordCommandOption {
  name: string;
  description: string;
  type: number;
  required?: boolean;
  options?: DiscordCommandOption[];
}

function buildUsage(cmd: DiscordCommand): string {
  let usage = `/${cmd.name}`;
  if (cmd.options) {
    for (const opt of cmd.options) {
      // Subcommand group (type 2) or subcommand (type 1)
      if (opt.type === 1 || opt.type === 2) {
        // Don't add to root usage, handled as subcommands
        continue;
      }
      usage += opt.required ? ` <${opt.name}>` : ` [${opt.name}]`;
    }
  }
  return usage;
}

function flattenCommands(cmd: DiscordCommand): { name: string; desc: string; usage: string }[] {
  const results: { name: string; desc: string; usage: string }[] = [];

  if (cmd.options) {
    const subcommands = cmd.options.filter(o => o.type === 1);
    const subgroups = cmd.options.filter(o => o.type === 2);

    if (subgroups.length > 0) {
      for (const group of subgroups) {
        if (group.options) {
          for (const sub of group.options) {
            let usage = `/${cmd.name} ${group.name} ${sub.name}`;
            if (sub.options) {
              for (const param of sub.options) {
                usage += param.required ? ` <${param.name}>` : ` [${param.name}]`;
              }
            }
            results.push({
              name: `/${cmd.name} ${group.name} ${sub.name}`,
              desc: sub.description,
              usage,
            });
          }
        }
      }
    }

    if (subcommands.length > 0) {
      for (const sub of subcommands) {
        let usage = `/${cmd.name} ${sub.name}`;
        if (sub.options) {
          for (const param of sub.options) {
            usage += param.required ? ` <${param.name}>` : ` [${param.name}]`;
          }
        }
        results.push({
          name: `/${cmd.name} ${sub.name}`,
          desc: sub.description,
          usage,
        });
      }
    }

    // If no subcommands/groups, it's a regular command
    if (subcommands.length === 0 && subgroups.length === 0) {
      results.push({
        name: `/${cmd.name}`,
        desc: cmd.description,
        usage: buildUsage(cmd),
      });
    }
  } else {
    results.push({
      name: `/${cmd.name}`,
      desc: cmd.description,
      usage: `/${cmd.name}`,
    });
  }

  return results;
}

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

  try {
    // First get the bot's application ID
    const botRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}` },
    });
    const botData = await botRes.json();
    if (!botRes.ok) throw new Error(`Bot user fetch failed: ${JSON.stringify(botData)}`);

    const applicationId = botData.id;

    // Fetch global application commands
    const cmdsRes = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
      headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}` },
    });
    const cmdsData = await cmdsRes.json();
    if (!cmdsRes.ok) throw new Error(`Commands fetch failed: ${JSON.stringify(cmdsData)}`);

    // Flatten all commands (including subcommands)
    const allCommands: { name: string; desc: string; usage: string; parentName: string }[] = [];

    for (const cmd of cmdsData) {
      const flattened = flattenCommands(cmd);
      for (const f of flattened) {
        allCommands.push({ ...f, parentName: cmd.name });
      }
    }

    return new Response(JSON.stringify({
      commands: allCommands,
      totalRaw: cmdsData.length,
      totalFlattened: allCommands.length,
      rawCommands: cmdsData, // include raw data for debugging/categorization
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching Discord commands:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
