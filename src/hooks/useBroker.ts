import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useShoonyaSession } from "@/hooks/useShoonyaSession";
import { brokerFetch } from "@/lib/broker-api";

const NO_DATA_ACTIONS = new Set([
  "search_scrip",
  "option_chain",
  "orders",
  "positions",
  "holdings",
  "funds",
  "market_data",
]);

function parseBrokerError(action: string, payload: unknown): string | null {
  if (!payload) return "Empty broker response";
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) return null;
  if (typeof payload !== "object") return null;

  const data = payload as Record<string, unknown>;
  const stat = String(data.stat ?? "").trim().toUpperCase();
  const explicitError = data.error ?? data.emsg ?? data.message;
  const errorText = String(explicitError ?? "");

  if (/no data/i.test(errorText) && NO_DATA_ACTIONS.has(action)) {
    return null;
  }

  if (explicitError && stat !== "OK") {
    return String(explicitError);
  }

  if (stat && stat !== "OK") {
    return String(explicitError ?? `${action} failed`);
  }

  return null;
}

export function useBroker() {
  const { session, clearSession } = useShoonyaSession();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const callBrokerAPI = async (action: string, params: Record<string, unknown> = {}) => {
    if (!session) throw new Error("Not connected");

    setIsLoading(true);
    try {
      const { ok, status, data } = await brokerFetch({
        action,
        session_token: session.sessionToken,
        uid: session.userCode,
        ...params,
      });

      if (!ok) {
        const message = parseBrokerError(action, data) || `Broker request failed (${status})`;
        throw new Error(message);
      }

      const brokerError = parseBrokerError(action, data);
      if (brokerError) throw new Error(brokerError);

      return data;
    } finally {
      setIsLoading(false);
    }
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
