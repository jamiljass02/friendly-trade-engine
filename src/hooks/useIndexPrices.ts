import { useState, useEffect, useCallback } from "react";
import { useBroker } from "@/hooks/useBroker";

interface IndexPrice {
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export function useIndexPrices() {
  const { isConnected, getMarketData } = useBroker();
  const [prices, setPrices] = useState<IndexPrice[]>([
    { name: "NIFTY", price: 0, change: 0, changePercent: 0 },
    { name: "BANKNIFTY", price: 0, change: 0, changePercent: 0 },
    { name: "SENSEX", price: 0, change: 0, changePercent: 0 },
  ]);
  const [loading, setLoading] = useState(false);

  const fetchPrices = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      // Shoonya token codes for indices
      const indices = [
        { name: "NIFTY", token: "26000", exchange: "NSE" },
        { name: "BANKNIFTY", token: "26009", exchange: "NSE" },
        { name: "SENSEX", token: "1", exchange: "BSE" },
      ];

      const results = await Promise.allSettled(
        indices.map((idx) => getMarketData(idx.token, idx.exchange))
      );

      const updated = indices.map((idx, i) => {
        const result = results[i];
        if (result.status === "fulfilled" && result.value) {
          const d = result.value;
          const lp = parseFloat(d.lp || "0");
          const close = parseFloat(d.c || d.pc || "0");
          const change = lp - close;
          const changePct = close > 0 ? (change / close) * 100 : 0;
          return {
            name: idx.name,
            price: lp,
            change,
            changePercent: changePct,
          };
        }
        return prices[i] || { name: idx.name, price: 0, change: 0, changePercent: 0 };
      });

      setPrices(updated);
    } catch (err) {
      console.error("Failed to fetch index prices:", err);
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    fetchPrices();
    if (!isConnected) return;
    const interval = setInterval(fetchPrices, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [isConnected, fetchPrices]);

  return { prices, loading, refresh: fetchPrices };
}
