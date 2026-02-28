import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useShoonyaSession } from "@/hooks/useShoonyaSession";
import { xhrFetch } from "@/lib/xhr-fetch";

const FUNCTION_URL = "https://ytzzmnharipqcucfachn.supabase.co/functions/v1/shoonya-api";

export function useBroker() {
  const { session, clearSession } = useShoonyaSession();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const callBrokerAPI = async (action: string, params: Record<string, unknown> = {}) => {
    if (!session) throw new Error("Not connected");

    const { ok, data } = await xhrFetch(FUNCTION_URL, {
      action,
      session_token: session.sessionToken,
      uid: session.userCode,
      ...params,
    });

    if (!ok || data.error) throw new Error(data.error || "Request failed");
    return data;
  };

  const logout = async () => {
    try {
      await callBrokerAPI("logout");
    } catch {
      // Ignore logout errors
    }
    clearSession();
    toast({ title: "Disconnected", description: "Broker session closed." });
  };

  const getPositions = () => callBrokerAPI("positions");
  const getOrders = () => callBrokerAPI("orders");
  const getHoldings = (product?: string) => callBrokerAPI("holdings", { product });
  const getFunds = () => callBrokerAPI("funds");

  const placeOrder = (params: {
    exchange?: string;
    tradingsymbol: string;
    quantity: number;
    price?: number;
    trigger_price?: number;
    product?: string;
    transaction_type: "B" | "S";
    order_type?: string;
  }) => callBrokerAPI("place_order", params);

  const modifyOrder = (params: {
    order_id: string;
    exchange?: string;
    tradingsymbol: string;
    quantity: number;
    price?: number;
    trigger_price?: number;
    order_type?: string;
  }) => callBrokerAPI("modify_order", params);

  const cancelOrder = (orderId: string) => callBrokerAPI("cancel_order", { order_id: orderId });

  const getMarketData = (token: string, exchange?: string) =>
    callBrokerAPI("market_data", { token, exchange });

  const searchScrip = (searchText: string, exchange?: string) =>
    callBrokerAPI("search_scrip", { search_text: searchText, exchange });

  const getOptionChain = (symbol: string, strikePrice: number, count?: number) =>
    callBrokerAPI("option_chain", { symbol, strike_price: strikePrice, count });

  return {
    isConnected: !!session,
    isLoading,
    session,
    logout,
    getPositions,
    getOrders,
    getHoldings,
    getFunds,
    placeOrder,
    modifyOrder,
    cancelOrder,
    getMarketData,
    searchScrip,
    getOptionChain,
  };
}
