const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SHOONYA_BASE = "https://api.shoonya.com/NorenWClientTP";

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    // Direct login - no auth required
    if (action === "direct_login") {
      const { user_code, password, totp, api_key, vendor_code, imei } = params;

      if (!user_code || !password || !api_key) {
        return new Response(JSON.stringify({ error: "Missing required credentials" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const passwordHash = await sha256(password);
      const appKey = await sha256(`${user_code}|${api_key}`);
      const vcCandidates = vendor_code
        ? [String(vendor_code).trim()]
        : [String(user_code).trim(), `${String(user_code).trim()}_U`, "NA"];

      let loginData: any = null;

      for (const vc of vcCandidates) {
        const loginPayload = {
          source: "API",
          apkversion: "1.0.0",
          uid: user_code,
          pwd: passwordHash,
          factor2: String(totp ?? "").trim(),
          vc,
          appkey: appKey,
          imei: imei || "tradex-app",
        };

        const loginRes = await fetch(`${SHOONYA_BASE}/QuickAuth`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "jData=" + JSON.stringify(loginPayload),
        });

        const loginText = await loginRes.text();
        try {
          loginData = JSON.parse(loginText);
        } catch {
          console.error("Non-JSON login response:", loginText.slice(0, 300));
          loginData = { stat: "Not_Ok", emsg: "Broker server returned an invalid response. Please try again in a moment." };
          continue;
        }

        if (String(loginData?.stat ?? "").toUpperCase() === "OK") {
          break;
        }
      }

      if (String(loginData?.stat ?? "").toUpperCase() === "OK") {
        return new Response(JSON.stringify({
          status: "connected",
          session_token: loginData.susertoken,
          username: loginData.uname,
          actid: loginData.actid,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        error: loginData?.emsg || loginData?.error || "Login failed",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require session_token and uid from client
    const { session_token, uid } = params;
    if (!session_token || !uid) {
      return new Response(JSON.stringify({ error: "Not connected. Please login first." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const makeRequest = async (endpoint: string, payload: Record<string, unknown>) => {
      const res = await fetch(`${SHOONYA_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "jData=" + JSON.stringify({ ...payload, uid }) + `&jKey=${session_token}`,
      });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        console.error(`Non-JSON response from ${endpoint}:`, text.slice(0, 300));
        return { stat: "Not_Ok", emsg: "Broker server returned an invalid response. Please retry." };
      }
    };

    let result;

    switch (action) {
      case "positions":
        result = await makeRequest("PositionBook", { actid: uid });
        break;
      case "orders":
        result = await makeRequest("OrderBook", { actid: uid });
        break;
      case "holdings":
        result = await makeRequest("Holdings", { actid: uid, prd: params.product || "C" });
        break;
      case "funds":
        result = await makeRequest("Limits", { actid: uid });
        break;
      case "place_order":
        result = await makeRequest("PlaceOrder", {
          actid: uid,
          exch: params.exchange || "NFO",
          tsym: params.tradingsymbol,
          qty: String(params.quantity),
          prc: String(params.price || 0),
          trgprc: String(params.trigger_price || 0),
          prd: params.product || "M",
          trantype: params.transaction_type,
          prctyp: params.order_type || "MKT",
          ret: "DAY",
        });
        break;
      case "modify_order":
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
      case "cancel_order":
        result = await makeRequest("CancelOrder", { norenordno: params.order_id });
        break;
      case "market_data":
        result = await makeRequest("GetQuotes", { exch: params.exchange || "NFO", token: params.token });
        break;
      case "option_chain":
        result = await makeRequest("GetOptionChain", {
          exch: params.exchange || "NFO",
          tsym: params.symbol,
          strprc: String(params.strike_price),
          cnt: String(params.count || 10),
        });
        break;
      case "search_scrip":
        result = await makeRequest("SearchScrip", { exch: params.exchange || "NFO", stext: params.search_text });
        break;
      case "logout":
        result = await makeRequest("Logout", {});
        break;
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
