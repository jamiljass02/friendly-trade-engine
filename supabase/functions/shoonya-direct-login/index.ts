// Direct Shoonya QuickAuth login for API-only accounts.
// POST { uid, password, totp, vendor_code? } -> { session_token, username, actid }
// Routes via the whitelisted proxy gateway so Shoonya sees the user's IP.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHOONYA_BASE = (Deno.env.get("SHOONYA_API_BASE_URL") || "https://api.shoonya.com/NorenWClientTP")
  .replace(/\/+$/, "");

const API_KEY = Deno.env.get("SHOONYA_OAUTH_API_KEY") || "";
const VENDOR_CODE_DEFAULT = Deno.env.get("SHOONYA_VENDOR_CODE") || "";
const IMEI_DEFAULT = Deno.env.get("SHOONYA_IMEI") || "abc1234";

async function sha256(message: string): Promise<string> {
  const buf = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!API_KEY) {
      return json({ error: "SHOONYA_OAUTH_API_KEY not configured." }, 500);
    }

    const { uid, password, totp, vendor_code, imei } = await req.json();
    if (!uid || !password || !totp) {
      return json({ error: "uid, password and totp are required." }, 400);
    }

    const cleanUid = String(uid).trim().toUpperCase();
    const vc = (vendor_code || VENDOR_CODE_DEFAULT || cleanUid).toString().trim();
    const imeiVal = (imei || IMEI_DEFAULT).toString().trim();

    const pwdHash = await sha256(String(password));
    const appkey = await sha256(`${cleanUid}|${API_KEY}`);

    const payload = {
      apkversion: "1.0.0",
      uid: cleanUid,
      pwd: pwdHash,
      factor2: String(totp),
      vc,
      appkey,
      imei: imeiVal,
      source: "API",
    };

    console.log(`[direct-login] uid=${cleanUid} vc=${vc} via ${SHOONYA_BASE}`);

    const body = new URLSearchParams({ jData: JSON.stringify(payload) });
    let upstream: Response;
    try {
      upstream = await fetch(`${SHOONYA_BASE}/QuickAuth`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (err) {
      return json({ error: `Shoonya unreachable: ${(err as Error).message}` }, 502);
    }

    const text = await upstream.text();
    console.log(`[direct-login] status=${upstream.status} body=`, text.slice(0, 400));

    let data: any;
    try { data = JSON.parse(text); } catch {
      return json({ error: `Non-JSON response (${upstream.status}): ${text.slice(0, 200)}` }, 502);
    }

    if (String(data?.stat ?? "").toUpperCase() !== "OK" || !data.susertoken) {
      return json({ error: data?.emsg || `Login failed (stat=${data?.stat ?? "unknown"})` }, 400);
    }

    return json({
      status: "connected",
      session_token: data.susertoken,
      username: data.uname || cleanUid,
      actid: data.actid || cleanUid,
    });
  } catch (err) {
    console.error("direct-login error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
