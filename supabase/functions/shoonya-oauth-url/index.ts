// Returns the Shoonya PRISM authorize URL with the server-held API_KEY.
// Keeps the API key out of the bundled frontend.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_KEY = Deno.env.get("SHOONYA_OAUTH_API_KEY") || "";
const REDIRECT_URL_DEFAULT = Deno.env.get("SHOONYA_OAUTH_REDIRECT_URL") || "";
const AUTHORIZE_BASE = "https://trade.shoonya.com/OAuthlogin/authorize/oauth";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: "SHOONYA_OAUTH_API_KEY not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const uid = (body.uid || url.searchParams.get("uid") || "").toString().trim().toUpperCase();
    const state = (body.state || url.searchParams.get("state") || crypto.randomUUID()).toString();
    const redirectUri = (body.redirect_uri || url.searchParams.get("redirect_uri") || REDIRECT_URL_DEFAULT).toString();

    if (!uid) {
      return new Response(JSON.stringify({ error: "uid is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!redirectUri) {
      return new Response(JSON.stringify({ error: "redirect_uri is required (or configure SHOONYA_OAUTH_REDIRECT_URL)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authorize = new URL(AUTHORIZE_BASE);
    authorize.searchParams.set("api_key", API_KEY);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("uid", uid);

    return new Response(JSON.stringify({ authorize_url: authorize.toString(), state }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
