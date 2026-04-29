const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PROXY_URL = (Deno.env.get("SHOONYA_PROXY_URL") || "").replace(/\/+$/, "");

const isGatewayHtml = (text: string) =>
  /502\s+Bad\s+Gateway|503\s+Service\s+Temporarily\s+Unavailable|<html/i.test(text);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callProxy(endpoint: string, payload: Record<string, unknown>, jKey?: string) {
  if (!PROXY_URL) {
    return { stat: "Not_Ok", emsg: "SHOONYA_PROXY_URL is not configured." };
  }

  const body = JSON.stringify({ endpoint, payload, jKey: jKey ?? null });
  let last: any = { stat: "Not_Ok", emsg: "Proxy unreachable" };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${PROXY_URL}/shoonya`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        if ((isGatewayHtml(text) || res.status >= 500) && attempt < 3) {
          await sleep(350 * attempt);
          continue;
        }
        last = {
          stat: "Not_Ok",
          emsg: isGatewayHtml(text) || res.status >= 500
            ? `Broker server is temporarily unavailable (${res.status || 502}). Please retry in a moment.`
            : "Broker server returned an invalid response.",
        };
        return last;
      }
    } catch (err) {
      console.error(`Proxy ${endpoint} attempt ${attempt} failed:`, err);
      if (attempt < 3) {
        await sleep(350 * attempt);
        continue;
      }
      last = { stat: "Not_Ok", emsg: "Unable to reach broker proxy. Check connection and retry." };
    }
  }
  return last;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    // All actions require session_token + uid (issued by shoonya-oauth-exchange)
    const { session_token, uid } = params;
    if (!session_token || !uid) {
      return new Response(JSON.stringify({ error: "Not connected. Please login with Shoonya first." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const makeRequest = (endpoint: string, payload: Record<string, unknown>) =>
      callProxy(endpoint, { ...payload, uid }, session_token);

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
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
