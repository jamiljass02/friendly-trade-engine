// Exchanges Shoonya PRISM OAuth `request_code` for a session token.
// All upstream HTTP calls go through SHOONYA_PROXY_URL so they originate
// from the whitelisted static IP.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PROXY_URL = (Deno.env.get("SHOONYA_PROXY_URL") || "").replace(/\/+$/, "");
const API_KEY = Deno.env.get("SHOONYA_OAUTH_API_KEY") || "";
const API_SECRET = Deno.env.get("SHOONYA_OAUTH_API_SECRET") || "";

async function sha256(message: string): Promise<string> {
  const buf = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function callProxy(endpoint: string, payload: Record<string, unknown>) {
  const res = await fetch(`${PROXY_URL}/shoonya`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, payload, jKey: null }),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(`Non-JSON from proxy ${endpoint}:`, text.slice(0, 300));
    return { stat: "Not_Ok", emsg: "Broker proxy returned invalid response." };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!PROXY_URL || !API_KEY || !API_SECRET) {
      return new Response(JSON.stringify({
        error: "OAuth not configured. Missing SHOONYA_PROXY_URL / SHOONYA_OAUTH_API_KEY / SHOONYA_OAUTH_API_SECRET.",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { request_code, uid } = await req.json();
    if (!request_code || !uid) {
      return new Response(JSON.stringify({ error: "Missing request_code or uid." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Shoonya OAuth token exchange (PRISM):
    //   appkey  = SHA256( api_key + api_secret )
    //   jKey    = SHA256( uid + request_code + api_secret )
    // Endpoint: /NorenWClientTP/QuickAuth (with apkversion + source=API + appkey + jKey)
    const appkey = await sha256(`${API_KEY}${API_SECRET}`);
    const jKey = await sha256(`${uid}${request_code}${API_SECRET}`);

    const result = await callProxy("QuickAuth", {
      source: "API",
      apkversion: "1.0.0",
      uid,
      appkey,
      jKey,
    });

    if (String(result?.stat ?? "").toUpperCase() === "OK") {
      return new Response(JSON.stringify({
        status: "connected",
        session_token: result.susertoken,
        username: result.uname,
        actid: result.actid || uid,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      error: result?.emsg || "OAuth exchange failed. Please retry the login.",
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("OAuth exchange error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
