import { useState, useEffect, useCallback } from "react";
import { useBroker } from "@/hooks/useBroker";

export interface Position {
  symbol: string;
  type: string;
  qty: number;
  side: string;
  avgPrice: number;
  ltp: number;
  pnl: number;
  pnlPercent: number;
  rawData?: Record<string, unknown>;
}

function parsePositions(data: any): Position[] {
  if (!data || !Array.isArray(data)) return [];
  return data
    .filter((p: any) => p.stat === "Ok" || p.tsym)
    .map((p: any) => {
      const netQty = parseInt(p.netqty || p.daybuyqty || "0", 10);
      const avgPrice = parseFloat(p.netavgprc || p.daybuyavgprc || "0");
      const ltp = parseFloat(p.lp || "0");
      const pnl = parseFloat(p.rpnl || p.urmtom || "0") + parseFloat(p.urmtom || "0");
      const cost = avgPrice * Math.abs(netQty);
      const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
      const tsym = p.tsym || "";
      const type = tsym.includes("CE") ? "CE" : tsym.includes("PE") ? "PE" : tsym.includes("FUT") ? "FUT" : "EQ";

      return {
        symbol: tsym,
        type,
        qty: Math.abs(netQty),
        side: netQty >= 0 ? "BUY" : "SELL",
        avgPrice,
        ltp,
        pnl,
        pnlPercent,
        rawData: p,
      };
    })
    .filter((p: Position) => p.qty > 0);
}

function generateMockPositions(): Position[] {
  return [
    { symbol: "NIFTY27FEB25C24200", type: "CE", qty: 25, side: "SELL", avgPrice: 185.50, ltp: 162.30, pnl: 580, pnlPercent: 12.5 },
    { symbol: "NIFTY27FEB25P24200", type: "PE", qty: 25, side: "SELL", avgPrice: 192.00, ltp: 178.45, pnl: 338.75, pnlPercent: 7.1 },
    { symbol: "BANKNIFTY27FEB25C52000", type: "CE", qty: 15, side: "SELL", avgPrice: 320.00, ltp: 285.60, pnl: 516, pnlPercent: 10.8 },
    { symbol: "BANKNIFTY27FEB25C52500", type: "CE", qty: 15, side: "BUY", avgPrice: 180.00, ltp: 155.20, pnl: -372, pnlPercent: -13.8 },
    { symbol: "BANKNIFTY27FEB25P51000", type: "PE", qty: 15, side: "SELL", avgPrice: 290.00, ltp: 265.80, pnl: 363, pnlPercent: 8.3 },
    { symbol: "BANKNIFTY27FEB25P50500", type: "PE", qty: 15, side: "BUY", avgPrice: 160.00, ltp: 142.50, pnl: -262.5, pnlPercent: -10.9 },
    { symbol: "RELIANCE27FEB25FUT", type: "FUT", qty: 250, side: "BUY", avgPrice: 1285.00, ltp: 1302.50, pnl: 4375, pnlPercent: 1.4 },
    { symbol: "RELIANCE27FEB25C1340", type: "CE", qty: 250, side: "SELL", avgPrice: 32.50, ltp: 24.80, pnl: 1925, pnlPercent: 23.7 },
    { symbol: "TCS27MAR25C3900", type: "CE", qty: 150, side: "SELL", avgPrice: 85.00, ltp: 72.40, pnl: 1890, pnlPercent: 14.8 },
    { symbol: "TCS27MAR25P3700", type: "PE", qty: 150, side: "SELL", avgPrice: 62.00, ltp: 55.30, pnl: 1005, pnlPercent: 10.8 },
    { symbol: "HDFCBANK27FEB25FUT", type: "FUT", qty: 550, side: "BUY", avgPrice: 1638.00, ltp: 1652.80, pnl: 8140, pnlPercent: 0.9 },
  ];
}

export function usePositions() {
  const { isConnected, getPositions } = useBroker();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPositions = useCallback(async () => {
    if (!isConnected) {
      setPositions(generateMockPositions());
      return;
    }
    setLoading(true);
    try {
      const data = await getPositions();
      const parsed = parsePositions(data);
      setPositions(parsed.length > 0 ? parsed : generateMockPositions());
    } catch {
      setPositions(generateMockPositions());
    } finally {
      setLoading(false);
    }
  }, [isConnected, getPositions]);

  useEffect(() => {
    fetchPositions();
  }, [isConnected]);

  return { positions, loading, refresh: fetchPositions };
}
