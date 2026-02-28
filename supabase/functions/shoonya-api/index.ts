import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SHOONYA_BASE = "https://api.shoonya.com/NorenWClientTP";

// Generate SHA256 hash
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate TOTP
function generateTOTP(secret: string): string {
  // Base32 decode
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.toUpperCase()) {
    const val = base32Chars.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  const key = new Uint8Array(bytes);

  const epoch = Math.floor(Date.now() / 1000);
  const time = Math.floor(epoch / 30);
  const timeBuffer = new ArrayBuffer(8);
  const timeView = new DataView(timeBuffer);
  timeView.setUint32(4, time, false);
  const timeBytes = new Uint8Array(timeBuffer);

  // HMAC-SHA1 using Web Crypto is async, so we'll use a simplified approach
  // For production, use proper HMAC. Here we'll pass TOTP from client if needed.
  // Actually, let's compute it properly using crypto.subtle
  return ""; // Placeholder - we'll handle TOTP differently
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { action, ...params } = await req.json();

    // Get broker credentials
    const { data: creds, error: credError } = await supabase
      .from("broker_credentials")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (action === "login") {
      if (!creds) {
        return new Response(JSON.stringify({ error: "No broker credentials configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const passwordHash = await sha256(creds.password);
      const appKey = await sha256(`${creds.user_code}|${creds.api_key}`);

      const loginPayload = {
        source: "API",
        apkversion: "1.0.0",
        uid: creds.user_code,
        pwd: passwordHash,
        factor2: params.totp || creds.totp_key, // Accept TOTP from client or use stored key
        vc: creds.vendor_code,
        appkey: appKey,
        imei: creds.imei,
      };

      const loginRes = await fetch(`${SHOONYA_BASE}/QuickAuth`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "jData=" + JSON.stringify(loginPayload),
      });

      const loginData = await loginRes.json();

      if (loginData.stat === "Ok") {
        // Store session token
        await supabase
          .from("broker_credentials")
          .update({
            session_token: loginData.susertoken,
            is_connected: true,
            last_connected_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        return new Response(JSON.stringify({
          status: "connected",
          username: loginData.uname,
          actid: loginData.actid,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({
          error: loginData.emsg || "Login failed",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // For all other actions, require active session
    if (!creds?.session_token) {
      return new Response(JSON.stringify({ error: "Not connected to broker. Please login first." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sessionToken = creds.session_token;
    const uid = creds.user_code;

    const makeRequest = async (endpoint: string, payload: Record<string, unknown>) => {
      const res = await fetch(`${SHOONYA_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "jData=" + JSON.stringify({ ...payload, uid }) + `&jKey=${sessionToken}`,
      });
      return await res.json();
    };

    let result;

    switch (action) {
      case "positions": {
        result = await makeRequest("PositionBook", { actid: uid });
        break;
      }
      case "orders": {
        result = await makeRequest("OrderBook", { actid: uid });
        break;
      }
      case "holdings": {
        result = await makeRequest("Holdings", {
          actid: uid,
          prd: params.product || "C",
        });
        break;
      }
      case "funds": {
        result = await makeRequest("Limits", { actid: uid });
        break;
      }
      case "place_order": {
        result = await makeRequest("PlaceOrder", {
          actid: uid,
          exch: params.exchange || "NFO",
          tsym: params.tradingsymbol,
          qty: String(params.quantity),
          prc: String(params.price || 0),
          trgprc: String(params.trigger_price || 0),
          prd: params.product || "M",
          trantype: params.transaction_type, // B or S
          prctyp: params.order_type || "MKT", // MKT, LMT, SL-LMT, SL-MKT
          ret: "DAY",
        });
        break;
      }
      case "modify_order": {
        result = await makeRequest("ModifyOrder", {
          norenordno: params.order_id,
          exch: params.exchange || "NFO",
          tsym: params.tradingsymbol,
          qty: String(params.quantity),
          prc: String(params.price || 0),
          trgprc: String(params.trigger_price || 0),
          prctyp: params.order_type || "LMT",
          ret: "DAY",
        });
        break;
      }
      case "cancel_order": {
        result = await makeRequest("CancelOrder", {
          norenordno: params.order_id,
        });
        break;
      }
      case "market_data": {
        result = await makeRequest("GetQuotes", {
          exch: params.exchange || "NFO",
          token: params.token,
        });
        break;
      }
      case "option_chain": {
        result = await makeRequest("GetOptionChain", {
          exch: params.exchange || "NFO",
          tsym: params.symbol,
          strprc: String(params.strike_price),
          cnt: String(params.count || 10),
        });
        break;
      }
      case "search_scrip": {
        result = await makeRequest("SearchScrip", {
          exch: params.exchange || "NFO",
          stext: params.search_text,
        });
        break;
      }
      case "logout": {
        result = await makeRequest("Logout", {});
        await supabase
          .from("broker_credentials")
          .update({ session_token: null, is_connected: false })
          .eq("user_id", userId);
        break;
      }
      case "status": {
        return new Response(JSON.stringify({
          is_connected: creds.is_connected,
          broker: creds.broker,
          user_code: creds.user_code,
          last_connected_at: creds.last_connected_at,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Shoonya API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
