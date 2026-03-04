import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, RefreshCw, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useBroker } from "@/hooks/useBroker";
import { cn } from "@/lib/utils";

interface Holding {
  symbol: string;
  qty: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  pnlPercent: number;
  exchange: string;
}

function parseHoldings(data: any): Holding[] {
  if (!data || !Array.isArray(data)) return [];
  return data
    .filter((h: any) => h.stat === "Ok" || h.exch_tsym)
    .map((h: any) => {
      const qty = parseInt(h.holdqty || h.btstqty || h.dpqty || "0", 10);
      const avgPrice = parseFloat(h.upldprc || h.brkcolqty || "0");
      const ltp = parseFloat(h.lp || "0");
      const pnl = (ltp - avgPrice) * qty;
      const cost = avgPrice * qty;
      return {
        symbol: h.exch_tsym?.[0]?.tsym || h.tsym || "Unknown",
        qty,
        avgPrice,
        ltp,
        pnl,
        pnlPercent: cost > 0 ? (pnl / cost) * 100 : 0,
        exchange: h.exch_tsym?.[0]?.exch || h.exch || "NSE",
      };
    })
    .filter((h: Holding) => h.qty > 0);
}

function generateMockHoldings(): Holding[] {
  return [
    { symbol: "RELIANCE", qty: 50, avgPrice: 1180.00, ltp: 1302.50, pnl: 6125, pnlPercent: 10.38, exchange: "NSE" },
    { symbol: "TCS", qty: 30, avgPrice: 3650.00, ltp: 3842.60, pnl: 5778, pnlPercent: 5.28, exchange: "NSE" },
    { symbol: "HDFCBANK", qty: 100, avgPrice: 1520.00, ltp: 1652.80, pnl: 13280, pnlPercent: 8.74, exchange: "NSE" },
    { symbol: "INFY", qty: 75, avgPrice: 1420.00, ltp: 1385.40, pnl: -2595, pnlPercent: -2.43, exchange: "NSE" },
    { symbol: "SBIN", qty: 200, avgPrice: 580.00, ltp: 612.30, pnl: 6460, pnlPercent: 5.57, exchange: "NSE" },
    { symbol: "TATAMOTORS", qty: 80, avgPrice: 685.00, ltp: 742.50, pnl: 4600, pnlPercent: 8.39, exchange: "NSE" },
    { symbol: "ICICIBANK", qty: 120, avgPrice: 1025.00, ltp: 1098.20, pnl: 8784, pnlPercent: 7.14, exchange: "NSE" },
    { symbol: "BAJFINANCE", qty: 15, avgPrice: 6820.00, ltp: 7105.40, pnl: 4281, pnlPercent: 4.18, exchange: "NSE" },
  ];
}

const Holdings = () => {
  const { isConnected, getHoldings } = useBroker();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHoldings = useCallback(async () => {
    if (!isConnected) {
      setHoldings(generateMockHoldings());
      return;
    }
    setLoading(true);
    try {
      const data = await getHoldings();
      const parsed = parseHoldings(data);
      setHoldings(parsed.length > 0 ? parsed : generateMockHoldings());
    } catch {
      setHoldings(generateMockHoldings());
    } finally {
      setLoading(false);
    }
  }, [isConnected, getHoldings]);

  useEffect(() => { fetchHoldings(); }, [isConnected]);

  const totalInvested = holdings.reduce((s, h) => s + h.avgPrice * h.qty, 0);
  const totalCurrent = holdings.reduce((s, h) => s + h.ltp * h.qty, 0);
  const totalPnl = holdings.reduce((s, h) => s + h.pnl, 0);
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Holdings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Your long-term equity portfolio</p>
          </div>
          <button onClick={fetchHoldings} disabled={loading} className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" /> : <RefreshCw className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="glass-card rounded-xl px-4 py-3">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Invested</p>
            <p className="text-lg font-mono font-bold text-foreground mt-0.5">₹{totalInvested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="glass-card rounded-xl px-4 py-3">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Current Value</p>
            <p className="text-lg font-mono font-bold text-foreground mt-0.5">₹{totalCurrent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="glass-card rounded-xl px-4 py-3">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total P&L</p>
            <p className={cn("text-lg font-mono font-bold mt-0.5", totalPnl >= 0 ? "text-profit" : "text-loss")}>
              {totalPnl >= 0 ? "+" : ""}₹{Math.abs(totalPnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="glass-card rounded-xl px-4 py-3">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Returns</p>
            <p className={cn("text-lg font-mono font-bold mt-0.5", totalPnlPct >= 0 ? "text-profit" : "text-loss")}>
              {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Portfolio Holdings</h3>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">{holdings.length}</span>
            </div>
          </div>

          {holdings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-secondary/20">
                    {["Symbol", "Qty", "Avg Price", "LTP", "Invested", "Current", "P&L", "Returns"].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h, i) => {
                    const invested = h.avgPrice * h.qty;
                    const current = h.ltp * h.qty;
                    return (
                      <tr key={i} className="data-row border-b border-border/20 hover:bg-secondary/10">
                        <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-foreground">{h.symbol}</td>
                        <td className="px-4 py-2.5 font-mono text-foreground">{h.qty}</td>
                        <td className="px-4 py-2.5 font-mono text-foreground">₹{h.avgPrice.toFixed(2)}</td>
                        <td className="px-4 py-2.5 font-mono text-foreground">₹{h.ltp.toFixed(2)}</td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">₹{invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                        <td className="px-4 py-2.5 font-mono text-foreground">₹{current.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            {h.pnl >= 0 ? <ArrowUpRight className="w-3 h-3 text-profit" /> : <ArrowDownRight className="w-3 h-3 text-loss" />}
                            <span className={cn("font-mono font-semibold", h.pnl >= 0 ? "text-profit" : "text-loss")}>
                              {h.pnl >= 0 ? "+" : ""}₹{Math.abs(h.pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn("font-mono font-semibold", h.pnlPercent >= 0 ? "text-profit" : "text-loss")}>
                            {h.pnlPercent >= 0 ? "+" : ""}{h.pnlPercent.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              {loading ? "Loading holdings..." : "No holdings found. Connect your broker to view holdings."}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Holdings;
