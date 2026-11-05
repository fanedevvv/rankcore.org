import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create admin user
    const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: "admin@yakuza.my",
      password: "nuimipasa",
      email_confirm: true,
    });

    if (createError && !createError.message.includes("already been registered")) {
      throw createError;
    }

    const userId = user?.user?.id;
    if (userId) {
      // Assign admin role
      await supabaseAdmin.from("user_roles").upsert({
        user_id: userId,
        role: "admin",
      }, { onConflict: "user_id,role" });
    } else {
      // User already exists, find them
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const existing = users?.users?.find((u: any) => u.email === "admin@yakuza.my");
      if (existing) {
        await supabaseAdmin.from("user_roles").upsert({
          user_id: existing.id,
          role: "admin",
        }, { onConflict: "user_id,role" });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
