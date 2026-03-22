import { useState, useEffect, useCallback, useRef } from "react";
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
  prevPnl?: number;
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

// Simulate LTP ticks for mock data
function applyMockTick(positions: Position[]): Position[] {
  return positions.map((p) => {
    const change = (Math.random() - 0.48) * p.ltp * 0.002; // slight upward bias
    const newLtp = Math.max(0.05, p.ltp + change);
    const mult = p.side === "BUY" ? 1 : -1;
    const newPnl = (newLtp - p.avgPrice) * p.qty * mult;
    const cost = p.avgPrice * p.qty;
    return {
      ...p,
      prevPnl: p.pnl,
      ltp: Math.round(newLtp * 100) / 100,
      pnl: Math.round(newPnl * 100) / 100,
      pnlPercent: cost > 0 ? Math.round((newPnl / cost) * 10000) / 100 : 0,
    };
  });
}

export interface Alert {
  id: string;
  type: "margin" | "expiry";
  message: string;
  severity: "warning" | "critical";
  timestamp: number;
}

function computeAlerts(positions: Position[]): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();

  // Margin alert (mock: >80% util)
  const marginUsed = positions.reduce((s, p) => {
    const n = p.avgPrice * p.qty;
    return s + (p.type === "FUT" ? n * 0.12 : p.side === "SELL" ? n * 0.15 : n * 0.05);
  }, 0);
  const util = (marginUsed / 500000) * 100;
  if (util > 80) {
    alerts.push({
      id: "margin-high",
      type: "margin",
      message: `Margin utilization at ${util.toFixed(0)}% — consider reducing exposure`,
      severity: util > 95 ? "critical" : "warning",
      timestamp: Date.now(),
    });
  }

  // Expiry warnings
  const expiryMatch = (sym: string) => {
    const m = sym.match(/(\d{2})([A-Z]{3})(\d{2})/);
    if (!m) return null;
    const months: Record<string, number> = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
    return new Date(2000 + parseInt(m[3]), months[m[2]] || 0, parseInt(m[1]));
  };

  const checked = new Set<string>();
  for (const p of positions) {
    const exp = expiryMatch(p.symbol);
    if (!exp) continue;
    const dte = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
    const expKey = p.symbol.match(/(\d{2}[A-Z]{3}\d{2})/)?.[1] || "";
    if (checked.has(expKey)) continue;
    checked.add(expKey);

    if (dte <= 1) {
      alerts.push({ id: `exp-${expKey}`, type: "expiry", message: `Expiry TODAY for ${expKey} contracts`, severity: "critical", timestamp: Date.now() });
    } else if (dte <= 3) {
      alerts.push({ id: `exp-${expKey}`, type: "expiry", message: `${dte} days to expiry for ${expKey} contracts`, severity: "critical", timestamp: Date.now() });
    } else if (dte <= 7) {
      alerts.push({ id: `exp-${expKey}`, type: "expiry", message: `${dte} days to expiry for ${expKey} contracts`, severity: "warning", timestamp: Date.now() });
    }
  }

  return alerts;
}

export function usePositions() {
  const { isConnected, getPositions } = useBroker();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!isConnected) {
      setPositions((prev) => prev.length > 0 ? prev : generateMockPositions());
      return;
    }
    setLoading(true);
    try {
      const data = await getPositions();
      const parsed = parsePositions(data);
      setPositions((prev) => {
        const newPos = parsed;
        // Carry prevPnl for flash animations
        return newPos.map((np) => {
          const old = prev.find((o) => o.symbol === np.symbol);
          return { ...np, prevPnl: old?.pnl };
        });
      });
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [isConnected, getPositions]);

  // Initial fetch
  useEffect(() => {
    fetchPositions();
  }, [isConnected]);

  // Auto-refresh: broker every 5s, mock tick every 1s
  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }

    if (isConnected) {
      intervalRef.current = setInterval(fetchPositions, 5000);
    } else {
      // Mock LTP ticks every 1s
      tickRef.current = setInterval(() => {
        setPositions((prev) => applyMockTick(prev));
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [autoRefresh, isConnected, fetchPositions]);

  // Compute alerts whenever positions change
  useEffect(() => {
    setAlerts(computeAlerts(positions));
  }, [positions]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return {
    positions,
    loading,
    alerts,
    autoRefresh,
    setAutoRefresh,
    dismissAlert,
    refresh: fetchPositions,
  };
}
