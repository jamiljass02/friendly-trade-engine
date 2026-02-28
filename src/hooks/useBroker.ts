import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BrokerCredentials {
  user_code: string;
  password: string;
  totp_key: string;
  vendor_code: string;
  api_key: string;
  imei: string;
}

interface BrokerStatus {
  is_connected: boolean;
  broker: string;
  user_code: string;
  last_connected_at: string | null;
}

export function useBroker() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<BrokerStatus | null>(null);
  const { toast } = useToast();

  const callBrokerAPI = async (action: string, params: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await supabase.functions.invoke("shoonya-api", {
      body: { action, ...params },
    });

    if (response.error) throw new Error(response.error.message);
    return response.data;
  };

  const saveCredentials = async (creds: BrokerCredentials) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("broker_credentials")
        .upsert({
          user_id: user.id,
          broker: "shoonya",
          user_code: creds.user_code,
          password: creds.password,
          totp_key: creds.totp_key,
          vendor_code: creds.vendor_code,
          api_key: creds.api_key,
          imei: creds.imei || "tradex-app",
        }, { onConflict: "user_id" });

      if (error) throw error;
      toast({ title: "Credentials saved", description: "Broker credentials stored securely." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (totp?: string) => {
    setIsLoading(true);
    try {
      const result = await callBrokerAPI("login", { totp });
      setIsConnected(true);
      setStatus(prev => prev ? { ...prev, is_connected: true } : null);
      toast({ title: "Connected!", description: `Logged in as ${result.username}` });
      return result;
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await callBrokerAPI("logout");
      setIsConnected(false);
      setStatus(prev => prev ? { ...prev, is_connected: false } : null);
      toast({ title: "Disconnected", description: "Broker session closed." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
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

  const checkStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("broker_credentials")
        .select("is_connected, broker, user_code, last_connected_at")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setStatus(data as BrokerStatus);
        setIsConnected(data.is_connected || false);
      }
    } catch {
      // No credentials yet
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return {
    isConnected,
    isLoading,
    status,
    saveCredentials,
    login,
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
    checkStatus,
  };
}
