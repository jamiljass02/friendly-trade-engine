import { useMemo } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Position } from "@/hooks/usePositions";

const INDICES = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"];

function extractUnderlying(symbol: string): string {
  const match = symbol.match(/^([A-Z&]+)\d/);
  return match ? match[1] : symbol;
}

interface HoldingsViewProps {
  positions: Position[];
  loading: boolean;
}

interface HoldingGroup {
  label: string;
  items: Position[];
  totalPnl: number;
  totalValue: number;
  collateral: number;
}

const HoldingsView = ({ positions, loading }: HoldingsViewProps) => {
  const groups = useMemo((): HoldingGroup[] => {
    const futures = positions.filter((p) => p.type === "FUT");
    const ceOptions = positions.filter((p) => p.type === "CE");
    const peOptions = positions.filter((p) => p.type === "PE");
    const stocks = positions.filter((p) => p.type === "EQ");

    const makeGroup = (label: string, items: Position[]): HoldingGroup => {
      const totalPnl = items.reduce((s, p) => s + p.pnl, 0);
      const totalValue = items.reduce((s, p) => s + p.ltp * p.qty, 0);
      const collateral = items.reduce((s, p) => {
        if (p.type === "FUT") return s + p.avgPrice * p.qty * 0.12;
        if (p.side === "SELL") return s + p.avgPrice * p.qty * 0.15;
        return s + p.avgPrice * p.qty * 0.05;
      }, 0);
      return { label, items, totalPnl, totalValue, collateral };
    };

    return [
      makeGroup("Futures Holdings", futures),
      makeGroup("Call Options (CE)", ceOptions),
      makeGroup("Put Options (PE)", peOptions),
      makeGroup("Stock Holdings", stocks),
    ];
  }, [positions]);

  const totalCollateral = groups.reduce((s, g) => s + g.collateral, 0);

  return (
    <div className="space-y-4">
      {/* Collateral Summary */}
      <div className="glass-card rounded-xl px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Collateral Utilization by Asset Class</h3>
          <span className="text-xs font-mono text-foreground">
            Total: ₹{totalCollateral.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-muted gap-0.5">
          {groups.filter((g) => g.collateral > 0).map((g) => {
            const pct = totalCollateral > 0 ? (g.collateral / totalCollateral) * 100 : 0;
            const colors: Record<string, string> = {
              "Futures Holdings": "bg-primary",
              "Call Options (CE)": "bg-profit",
              "Put Options (PE)": "bg-loss",
              "Stock Holdings": "bg-warning",
            };
            return (
              <div
                key={g.label}
                className={cn("h-full rounded-sm transition-all", colors[g.label] || "bg-accent")}
                style={{ width: `${pct}%` }}
                title={`${g.label}: ${pct.toFixed(1)}%`}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          {groups.filter((g) => g.collateral > 0).map((g) => {
            const pct = totalCollateral > 0 ? (g.collateral / totalCollateral) * 100 : 0;
            const dotColors: Record<string, string> = {
              "Futures Holdings": "bg-primary",
              "Call Options (CE)": "bg-profit",
              "Put Options (PE)": "bg-loss",
              "Stock Holdings": "bg-warning",
            };
            return (
              <div key={g.label} className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", dotColors[g.label])} />
                <span className="text-[9px] text-muted-foreground">
                  {g.label.split(" ")[0]} {pct.toFixed(0)}% · ₹{g.collateral.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Holding Groups */}
      {groups.map((group) => (
        <div key={group.label} className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
                {group.items.length}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-[9px] text-muted-foreground mr-1.5">Value:</span>
                <span className="font-mono font-semibold text-foreground">₹{group.totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex items-center gap-1">
                {group.totalPnl >= 0 ? <ArrowUpRight className="w-3 h-3 text-profit" /> : <ArrowDownRight className="w-3 h-3 text-loss" />}
                <span className={cn("font-mono font-bold", group.totalPnl >= 0 ? "text-profit" : "text-loss")}>
                  {group.totalPnl >= 0 ? "+" : ""}₹{Math.abs(group.totalPnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>

          {group.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-secondary/20">
                    {["Symbol", "Direction", "Qty", "Avg Price", "LTP", "Current Value", "P&L", "Margin/Collateral"].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((pos, i) => {
                    const value = pos.ltp * pos.qty;
                    const margin = pos.type === "FUT" ? pos.avgPrice * pos.qty * 0.12 : pos.side === "SELL" ? pos.avgPrice * pos.qty * 0.15 : pos.avgPrice * pos.qty * 0.05;
                    return (
                      <tr key={i} className="data-row">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[9px] font-bold px-1 py-0.5 rounded",
                              INDICES.includes(extractUnderlying(pos.symbol)) ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent-foreground"
                            )}>
                              {INDICES.includes(extractUnderlying(pos.symbol)) ? "IDX" : "STK"}
                            </span>
                            <span className="font-mono text-[11px] text-foreground truncate max-w-[180px]">{pos.symbol}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded",
                            pos.side === "BUY" ? "bg-success/10 text-profit" : "bg-destructive/10 text-loss"
                          )}>
                            {pos.side === "BUY" ? "LONG" : "SHORT"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-foreground">{pos.qty}</td>
                        <td className="px-4 py-2.5 font-mono text-foreground">₹{pos.avgPrice.toFixed(2)}</td>
                        <td className="px-4 py-2.5 font-mono text-foreground">₹{pos.ltp.toFixed(2)}</td>
                        <td className="px-4 py-2.5 font-mono text-foreground">₹{value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn("font-mono font-semibold", pos.pnl >= 0 ? "text-profit" : "text-loss")}>
                            {pos.pnl >= 0 ? "+" : ""}₹{Math.abs(pos.pnl).toFixed(0)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">₹{margin.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-6 text-center text-xs text-muted-foreground">No holdings</div>
          )}
        </div>
      ))}
    </div>
  );
};

export default HoldingsView;
