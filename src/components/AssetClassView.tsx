import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Position } from "@/hooks/usePositions";

const INDICES = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"];

function extractUnderlying(symbol: string): string {
  const match = symbol.match(/^([A-Z&]+)\d/);
  return match ? match[1] : symbol;
}

interface AssetGroup {
  label: string;
  positions: Position[];
  totalPnl: number;
}

function classifyPositions(positions: Position[]) {
  const groups: Record<string, Position[]> = {
    "Index Options": [],
    "Stock Options": [],
    "Index Futures": [],
    "Stock Futures": [],
  };

  for (const p of positions) {
    const underlying = extractUnderlying(p.symbol);
    const isIndex = INDICES.includes(underlying);
    const isFut = p.type === "FUT";

    if (isIndex && isFut) groups["Index Futures"].push(p);
    else if (isIndex) groups["Index Options"].push(p);
    else if (isFut) groups["Stock Futures"].push(p);
    else groups["Stock Options"].push(p);
  }

  return Object.entries(groups).map(([label, positions]) => ({
    label,
    positions,
    totalPnl: positions.reduce((s, p) => s + p.pnl, 0),
  }));
}

interface AssetClassViewProps {
  positions: Position[];
  loading: boolean;
}

const AssetClassView = ({ positions, loading }: AssetClassViewProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["Index Options"]));
  const groups = useMemo(() => classifyPositions(positions), [positions]);

  const toggle = (label: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isOpen = expanded.has(group.label);
        return (
          <div key={group.label} className="glass-card rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(group.label)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">{group.label}</span>
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
                  {group.positions.length} positions
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {group.totalPnl >= 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-profit" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-loss" />
                  )}
                  <span className={cn("text-sm font-mono font-bold", group.totalPnl >= 0 ? "text-profit" : "text-loss")}>
                    {group.totalPnl >= 0 ? "+" : ""}₹{Math.abs(group.totalPnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {isOpen && group.positions.length > 0 && (
              <div className="border-t border-border/50 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/20">
                      {["Symbol", "Type", "Side", "Qty", "Avg Price", "LTP", "P&L", "P&L %"].map((h) => (
                        <th key={h} className="text-left px-4 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.positions.map((pos, i) => (
                      <tr key={i} className="data-row">
                        <td className="px-4 py-2.5 font-mono text-foreground text-[11px] truncate max-w-[200px]">{pos.symbol}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                            pos.type === "CE" ? "bg-success/10 text-profit" : pos.type === "PE" ? "bg-destructive/10 text-loss" : "bg-accent/10 text-accent-foreground"
                          )}>{pos.type}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                            pos.side === "BUY" ? "bg-success/10 text-profit" : "bg-destructive/10 text-loss"
                          )}>{pos.side}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-foreground">{pos.qty}</td>
                        <td className="px-4 py-2.5 font-mono text-foreground">₹{pos.avgPrice.toFixed(2)}</td>
                        <td className="px-4 py-2.5 font-mono text-foreground">₹{pos.ltp.toFixed(2)}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn("font-mono font-semibold", pos.pnl >= 0 ? "text-profit" : "text-loss")}>
                            {pos.pnl >= 0 ? "+" : ""}₹{Math.abs(pos.pnl).toFixed(0)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn("font-mono text-[10px]", pos.pnlPercent >= 0 ? "text-profit" : "text-loss")}>
                            {pos.pnlPercent >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isOpen && group.positions.length === 0 && (
              <div className="border-t border-border/50 px-5 py-6 text-center text-xs text-muted-foreground">
                No positions in this asset class
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AssetClassView;
