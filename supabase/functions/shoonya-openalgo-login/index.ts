// Direct login via OpenAlgo's Shoonya endpoint.
// POST { userid, password, totp } -> proxy /api/shoonya/login
// Returns { session_token, username, actid }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RAW_PROXY = (Deno.env.get("SHOONYA_PROXY_URL") || "").replace(/\/+$/, "");
// SHOONYA_PROXY_URL may point at :3000 (legacy passthrough). OpenAlgo runs on :5000.
// Allow override with SHOONYA_OPENALGO_URL; otherwise swap port if needed.
const OPENALGO_BASE = (Deno.env.get("SHOONYA_OPENALGO_URL") || RAW_PROXY.replace(/:\d+$/, ":5000"))
  .replace(/\/+$/, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!OPENALGO_BASE) {
      return json({ error: "OpenAlgo URL not configured." }, 500);
    }

    const { userid, password, totp } = await req.json();
    if (!userid || !password || !totp) {
      return json({ error: "userid, password and totp are required." }, 400);
    }

    const url = `${OPENALGO_BASE}/api/shoonya/login`;
    console.log("OpenAlgo login ->", url, "uid:", userid);

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userid: String(userid).toUpperCase(),
        password,
        totp,
      }),
    });

    const text = await upstream.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!upstream.ok) {
      console.error("OpenAlgo login failed:", upstream.status, text.slice(0, 300));
      return json({ error: data?.error || data?.message || `Login failed (${upstream.status})` }, 400);
    }

    // OpenAlgo typically returns { status, token, ... } or wraps Shoonya's response
    const token =
      data.token || data.susertoken || data.session_token || data.data?.token || data.data?.susertoken;
    const uname = data.uname || data.username || data.data?.uname || userid;
    const actid = data.actid || data.data?.actid || userid;

    if (!token) {
      console.error("OpenAlgo no token in response:", text.slice(0, 300));
      return json({ error: data?.emsg || data?.message || "Login succeeded but no session token returned." }, 400);
    }

    return json({
      status: "connected",
      session_token: token,
      username: uname,
      actid,
    });
  } catch (err) {
    console.error("openalgo-login error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
