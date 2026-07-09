// Exchanges Shoonya PRISM OAuth `request_code` for a session token.
// Calls Shoonya directly from Lovable Cloud, so whitelist the cloud egress IP.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_KEY = Deno.env.get("SHOONYA_OAUTH_API_KEY") || "";
const API_SECRET = Deno.env.get("SHOONYA_OAUTH_API_SECRET") || "";
// Call Shoonya API directly (no proxy).
const SHOONYA_BASE = "https://api.shoonya.com/NorenWClientTP";

async function sha256(message: string): Promise<string> {
  const buf = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function cleanResponseText(text: string) {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function callShoonya(endpoint: string, payload: Record<string, unknown>, jKey?: string) {
  console.log(`[shoonya ${endpoint}] payload:`, JSON.stringify(payload));
  let res: Response;
  try {
    const body = new URLSearchParams({ jData: JSON.stringify(payload) });
    if (jKey) body.set("jKey", jKey);

    res = await fetch(`${SHOONYA_BASE}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (err) {
    return { stat: "Not_Ok", emsg: `Shoonya API unreachable: ${(err as Error).message}` };
  }

  const text = await res.text();
  console.log(`[shoonya ${endpoint}] status=${res.status} body=`, text.slice(0, 500));
  const cleanText = cleanResponseText(text);

  try {
    const parsed = JSON.parse(text);
    if (!res.ok) {
      const parsedText = typeof parsed === "string" ? cleanResponseText(parsed) : JSON.stringify(parsed);
      return { stat: "Not_Ok", emsg: `Shoonya API failed (${res.status}): ${parsedText.slice(0, 240)}` };
    }
    if (!parsed || typeof parsed !== "object") {
      return { stat: "Not_Ok", emsg: `Shoonya API returned invalid response: ${String(parsed).slice(0, 240)}` };
    }
    return parsed;
  } catch {
    return { stat: "Not_Ok", emsg: `Shoonya API returned non-JSON (${res.status}): ${cleanText.slice(0, 240)}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!API_KEY || !API_SECRET) {
      return new Response(JSON.stringify({
        error: "OAuth not configured. Missing SHOONYA_OAUTH_API_KEY / SHOONYA_OAUTH_API_SECRET.",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { request_code, uid } = await req.json();
    if (!request_code || !uid) {
      return new Response(JSON.stringify({ error: "Missing request_code or uid." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Shoonya OAuth (PRISM) token exchange via QuickAuth.
    // Per Shoonya/Flattrade docs:
    //   appkey = SHA256( api_key + request_code + api_secret )
    // Endpoint: /NorenWClientTP/QuickAuth
    const appkey = await sha256(`${API_KEY}${request_code}${API_SECRET}`);

    console.log(`[exchange] uid=${uid} api_key=${API_KEY} request_code=${String(request_code).slice(0, 8)}...`);

    const result = await callShoonya("QuickAuth", {
      source: "API",
      apkversion: "1.0.0",
      uid,
      api_key: API_KEY,
      request_code,
      appkey,
    });

    console.log(`[exchange] result stat=${result?.stat} emsg=${result?.emsg ?? "(none)"}`);

    if (String(result?.stat ?? "").toUpperCase() === "OK") {
      return new Response(JSON.stringify({
        status: "connected",
        session_token: result.susertoken,
        username: result.uname,
        actid: result.actid || uid,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      error: result?.emsg || `OAuth exchange failed (stat=${result?.stat ?? "unknown"}).`,
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("OAuth exchange error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
