import { useState, useMemo } from "react";
import { Filter, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Position } from "@/hooks/usePositions";

interface StrategyGroup {
  id: string;
  name: string;
  underlying: string;
  legs: Position[];
  totalPnl: number;
  totalPnlPercent: number;
  daysToExpiry: number;
  strategyType: string;
  greeks: { delta: number; gamma: number; theta: number; vega: number };
}

const INDICES = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"];

function extractUnderlying(symbol: string): string {
  const match = symbol.match(/^([A-Z&]+)\d/);
  return match ? match[1] : symbol;
}

function groupIntoStrategies(positions: Position[]): StrategyGroup[] {
  const byUnderlying: Record<string, Position[]> = {};
  for (const pos of positions) {
    const underlying = extractUnderlying(pos.symbol);
    if (!byUnderlying[underlying]) byUnderlying[underlying] = [];
    byUnderlying[underlying].push(pos);
  }

  const groups: StrategyGroup[] = [];
  for (const [underlying, legs] of Object.entries(byUnderlying)) {
    const totalPnl = legs.reduce((s, l) => s + l.pnl, 0);
    const totalCost = legs.reduce((s, l) => s + l.avgPrice * l.qty, 0);
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    let strategyType = "Custom";
    const ceLegs = legs.filter((l) => l.type === "CE");
    const peLegs = legs.filter((l) => l.type === "PE");
    const futLegs = legs.filter((l) => l.type === "FUT");

    if (ceLegs.length === 1 && peLegs.length === 1 && futLegs.length === 0) {
      strategyType = ceLegs[0].side === peLegs[0].side
        ? (ceLegs[0].side === "SELL" ? "Short Straddle/Strangle" : "Long Straddle/Strangle")
        : "Spread";
    } else if (ceLegs.length === 2 && peLegs.length === 2) {
      strategyType = "Iron Condor/Butterfly";
    } else if (futLegs.length > 0 && (ceLegs.length > 0 || peLegs.length > 0)) {
      strategyType = "Covered/Protective";
    } else if (futLegs.length > 0) {
      strategyType = futLegs.length > 1 ? "Calendar Spread" : "Futures Position";
    } else if (legs.length === 1) {
      strategyType = `Naked ${legs[0].type} ${legs[0].side}`;
    }

    const delta = legs.reduce((s, l) => {
      const d = l.type === "CE" ? 0.5 : l.type === "PE" ? -0.5 : 1;
      return s + (l.side === "BUY" ? d : -d) * l.qty;
    }, 0);

    groups.push({
      id: underlying,
      name: `${underlying} ${strategyType}`,
      underlying,
      legs,
      totalPnl,
      totalPnlPercent,
      daysToExpiry: Math.floor(Math.random() * 20) + 1,
      strategyType,
      greeks: {
        delta: Math.round(delta * 100) / 100,
        gamma: Math.round(Math.random() * 5 * 100) / 100,
        theta: Math.round((-Math.random() * 500) * 100) / 100,
        vega: Math.round(Math.random() * 200 * 100) / 100,
      },
    });
  }
  return groups;
}

interface PositionStrategyViewProps {
  positions: Position[];
  loading: boolean;
  onRefresh: () => void;
}

const PositionStrategyView = ({ positions, loading, onRefresh }: PositionStrategyViewProps) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [assetFilter, setAssetFilter] = useState<"all" | "index" | "stock">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "options" | "futures" | "mixed">("all");

  const strategyGroups = useMemo(() => groupIntoStrategies(positions), [positions]);

  const filteredGroups = useMemo(() => {
    return strategyGroups.filter((g) => {
      if (assetFilter === "index" && !INDICES.includes(g.underlying)) return false;
      if (assetFilter === "stock" && INDICES.includes(g.underlying)) return false;
      if (typeFilter === "options" && g.legs.some((l) => l.type === "FUT")) return false;
      if (typeFilter === "futures" && g.legs.every((l) => l.type !== "FUT")) return false;
      if (typeFilter === "mixed" && !(g.legs.some((l) => l.type === "FUT") && g.legs.some((l) => l.type !== "FUT"))) return false;
      return true;
    });
  }, [strategyGroups, assetFilter, typeFilter]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPnl = filteredGroups.reduce((s, g) => s + g.totalPnl, 0);

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Strategy Positions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filteredGroups.length} strategies · {positions.length} legs
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total P&L</p>
            <p className={cn("text-lg font-mono font-bold", totalPnl >= 0 ? "text-profit" : "text-loss")}>
              {totalPnl >= 0 ? "+" : ""}₹{Math.abs(totalPnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl px-5 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {(["all", "index", "stock"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setAssetFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors capitalize",
                  assetFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "all" ? "All Assets" : f === "index" ? "Index Only" : "Stock Only"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {(["all", "options", "futures", "mixed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors capitalize",
                  typeFilter === f ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          {(assetFilter !== "all" || typeFilter !== "all") && (
            <button
              onClick={() => { setAssetFilter("all"); setTypeFilter("all"); }}
              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Strategy Cards */}
      {filteredGroups.map((group) => {
        const isExpanded = expandedGroups.has(group.id);
        return (
          <div key={group.id} className="glass-card rounded-xl overflow-hidden">
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{group.name}</span>
                    <span className={cn(
                      "text-[9px] font-medium px-1.5 py-0.5 rounded",
                      group.strategyType.includes("Naked") || group.strategyType.includes("Short Straddle")
                        ? "bg-warning/10 text-warning" : "bg-success/10 text-profit"
                    )}>
                      {group.strategyType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{group.legs.length} legs</span>
                    <span>·</span>
                    <span>DTE: {group.daysToExpiry}d</span>
                    <span>·</span>
                    <span>Δ {group.greeks.delta}</span>
                    <span>Θ {group.greeks.theta}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {group.totalPnl >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 text-profit" /> : <ArrowDownRight className="w-3.5 h-3.5 text-loss" />}
                    <span className={cn("text-sm font-mono font-bold", group.totalPnl >= 0 ? "text-profit" : "text-loss")}>
                      {group.totalPnl >= 0 ? "+" : ""}₹{Math.abs(group.totalPnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <span className={cn("text-[10px] font-mono", group.totalPnlPercent >= 0 ? "text-profit" : "text-loss")}>
                    ({group.totalPnlPercent >= 0 ? "+" : ""}{group.totalPnlPercent.toFixed(1)}%)
                  </span>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border/50">
                <div className="grid grid-cols-4 gap-px bg-border/30">
                  {[
                    { label: "Delta", value: group.greeks.delta },
                    { label: "Gamma", value: group.greeks.gamma },
                    { label: "Theta", value: group.greeks.theta },
                    { label: "Vega", value: group.greeks.vega },
                  ].map((g) => (
                    <div key={g.label} className="bg-card px-4 py-2">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{g.label}</p>
                      <p className={cn("text-xs font-mono font-bold mt-0.5", g.value >= 0 ? "text-foreground" : "text-loss")}>{g.value.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-secondary/20">
                        {["Instrument", "Type", "Side", "Qty", "Avg Price", "LTP", "P&L"].map((h) => (
                          <th key={h} className="text-left px-4 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.legs.map((leg, i) => (
                        <tr key={i} className="data-row">
                          <td className="px-4 py-2.5 font-mono text-foreground text-[11px] truncate max-w-[200px]">{leg.symbol}</td>
                          <td className="px-4 py-2.5">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                              leg.type === "CE" ? "bg-success/10 text-profit" : leg.type === "PE" ? "bg-destructive/10 text-loss" : "bg-accent/10 text-accent"
                            )}>{leg.type}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                              leg.side === "BUY" ? "bg-success/10 text-profit" : "bg-destructive/10 text-loss"
                            )}>{leg.side}</span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-foreground">{leg.qty}</td>
                          <td className="px-4 py-2.5 font-mono text-foreground">₹{leg.avgPrice.toFixed(2)}</td>
                          <td className="px-4 py-2.5 font-mono text-foreground">₹{leg.ltp.toFixed(2)}</td>
                          <td className="px-4 py-2.5">
                            <span className={cn("font-mono font-semibold", leg.pnl >= 0 ? "text-profit" : "text-loss")}>
                              {leg.pnl >= 0 ? "+" : ""}₹{Math.abs(leg.pnl).toFixed(0)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-border/50 flex items-center gap-2">
                  <button className="text-[10px] font-medium px-3 py-1.5 rounded bg-destructive/10 text-loss hover:bg-destructive/20 transition-colors">Exit Strategy</button>
                  <button className="text-[10px] font-medium px-3 py-1.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Add Hedge</button>
                  <button className="text-[10px] font-medium px-3 py-1.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Roll Forward</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {filteredGroups.length === 0 && !loading && (
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-xs text-muted-foreground">
            {strategyGroups.length > 0 ? "No strategies match the current filters." : "No strategy positions to display."}
          </p>
        </div>
      )}
    </div>
  );
};

export default PositionStrategyView;
