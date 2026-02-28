import { useState, useMemo, useEffect } from "react";
import { Filter } from "lucide-react";
import {
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Loader2,
  X,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBroker } from "@/hooks/useBroker";
import { useToast } from "@/hooks/use-toast";

interface Position {
  symbol: string;
  type: string;
  qty: number;
  side: string;
  avgPrice: number;
  ltp: number;
  pnl: number;
  pnlPercent: number;
}

interface StrategyGroup {
  id: string;
  name: string;
  underlying: string;
  underlyings: string[];
  legs: Position[];
  totalPnl: number;
  totalPnlPercent: number;
  daysToExpiry: number;
  strategyType: string;
  isCrossAsset: boolean;
  greeks: { delta: number; gamma: number; theta: number; vega: number };
}

function parsePositions(data: any): Position[] {
  if (!data || !Array.isArray(data)) return [];
  return data
    .filter((p: any) => p.stat === "Ok" || p.tsym)
    .map((p: any) => {
      const netQty = parseInt(p.netqty || p.daybuyqty || "0", 10);
      const avgPrice = parseFloat(p.netavgprc || p.daybuyavgprc || "0");
      const ltp = parseFloat(p.lp || "0");
      const pnl =
        parseFloat(p.rpnl || p.urmtom || "0") +
        parseFloat(p.urmtom || "0");
      const cost = avgPrice * Math.abs(netQty);
      const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
      const tsym = p.tsym || "";
      const type = tsym.includes("CE")
        ? "CE"
        : tsym.includes("PE")
        ? "PE"
        : tsym.includes("FUT")
        ? "FUT"
        : "EQ";

      return {
        symbol: tsym,
        type,
        qty: Math.abs(netQty),
        side: netQty >= 0 ? "BUY" : "SELL",
        avgPrice,
        ltp,
        pnl,
        pnlPercent,
      };
    })
    .filter((p: Position) => p.qty > 0);
}

function extractUnderlying(symbol: string): string {
  // Extract base underlying from symbols like NIFTY27FEB25C24200
  const match = symbol.match(/^([A-Z&]+)\d/);
  return match ? match[1] : symbol;
}

function groupIntoStrategies(positions: Position[]): StrategyGroup[] {
  // Group by underlying
  const byUnderlying: Record<string, Position[]> = {};
  for (const pos of positions) {
    const underlying = extractUnderlying(pos.symbol);
    if (!byUnderlying[underlying]) byUnderlying[underlying] = [];
    byUnderlying[underlying].push(pos);
  }

  const groups: StrategyGroup[] = [];

  for (const [underlying, legs] of Object.entries(byUnderlying)) {
    const totalPnl = legs.reduce((s, l) => s + l.pnl, 0);
    const totalCost = legs.reduce(
      (s, l) => s + l.avgPrice * l.qty,
      0
    );
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    // Detect strategy type
    let strategyType = "Custom";
    const ceLegs = legs.filter((l) => l.type === "CE");
    const peLegs = legs.filter((l) => l.type === "PE");
    const futLegs = legs.filter((l) => l.type === "FUT");

    if (ceLegs.length === 1 && peLegs.length === 1 && futLegs.length === 0) {
      if (ceLegs[0].side === peLegs[0].side) {
        strategyType =
          ceLegs[0].side === "SELL" ? "Short Straddle/Strangle" : "Long Straddle/Strangle";
      } else {
        strategyType = "Spread";
      }
    } else if (ceLegs.length === 2 && peLegs.length === 2) {
      strategyType = "Iron Condor/Butterfly";
    } else if (futLegs.length > 0 && (ceLegs.length > 0 || peLegs.length > 0)) {
      strategyType = "Covered/Protective";
    } else if (futLegs.length > 0) {
      strategyType = futLegs.length > 1 ? "Calendar Spread" : "Futures Position";
    } else if (legs.length === 1) {
      strategyType = `Naked ${legs[0].type} ${legs[0].side}`;
    }

    // Mock greeks
    const delta = legs.reduce((s, l) => {
      const d = l.type === "CE" ? 0.5 : -0.5;
      return s + (l.side === "BUY" ? d : -d) * l.qty;
    }, 0);

    groups.push({
      id: underlying,
      name: `${underlying} ${strategyType}`,
      underlying,
      underlyings: [underlying],
      legs,
      totalPnl,
      totalPnlPercent,
      daysToExpiry: Math.floor(Math.random() * 20) + 1,
      strategyType,
      isCrossAsset: false,
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

// Generate mock positions for demo
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
  ];
}

const PositionStrategyView = () => {
  const { isConnected, getPositions } = useBroker();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [assetFilter, setAssetFilter] = useState<"all" | "index" | "stock">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "options" | "futures" | "mixed">("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const { toast } = useToast();

  const fetchPositions = async () => {
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
  };

  useEffect(() => {
    fetchPositions();
  }, [isConnected]);

  const strategyGroups = useMemo(
    () => groupIntoStrategies(positions),
    [positions]
  );

  const INDICES = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"];

  const filteredGroups = useMemo(() => {
    return strategyGroups.filter((g) => {
      // Asset class
      if (assetFilter === "index" && !INDICES.includes(g.underlying)) return false;
      if (assetFilter === "stock" && INDICES.includes(g.underlying)) return false;
      // Strategy type
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
            <h3 className="text-sm font-semibold text-foreground">
              Strategy Positions
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filteredGroups.length} strategies · {positions.length} legs
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Total P&L
              </p>
              <p
                className={cn(
                  "text-lg font-mono font-bold",
                  totalPnl >= 0 ? "text-profit" : "text-loss"
                )}
              >
                {totalPnl >= 0 ? "+" : ""}₹
                {Math.abs(totalPnl).toLocaleString("en-IN", {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <button
              onClick={fetchPositions}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl px-5 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />

          {/* Asset Class */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {(["all", "index", "stock"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setAssetFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors capitalize",
                  assetFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "all" ? "All Assets" : f === "index" ? "Index Only" : "Stock Only"}
              </button>
            ))}
          </div>

          {/* Strategy Type */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {(["all", "options", "futures", "mixed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors capitalize",
                  typeFilter === f
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Active filter count */}
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
          <div
            key={group.id}
            className="glass-card rounded-xl overflow-hidden"
          >
            {/* Strategy Card Header */}
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {group.name}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] font-medium px-1.5 py-0.5 rounded",
                        group.strategyType.includes("Naked") ||
                          group.strategyType.includes("Short Straddle")
                          ? "bg-warning/10 text-warning"
                          : "bg-success/10 text-profit"
                      )}
                    >
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
                    {group.totalPnl >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-profit" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 text-loss" />
                    )}
                    <span
                      className={cn(
                        "text-sm font-mono font-bold",
                        group.totalPnl >= 0 ? "text-profit" : "text-loss"
                      )}
                    >
                      {group.totalPnl >= 0 ? "+" : ""}₹
                      {Math.abs(group.totalPnl).toLocaleString("en-IN", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-mono",
                      group.totalPnlPercent >= 0
                        ? "text-profit"
                        : "text-loss"
                    )}
                  >
                    ({group.totalPnlPercent >= 0 ? "+" : ""}
                    {group.totalPnlPercent.toFixed(1)}%)
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Expanded Legs */}
            {isExpanded && (
              <div className="border-t border-border/50">
                {/* Greeks Row */}
                <div className="grid grid-cols-4 gap-px bg-border/30">
                  {[
                    { label: "Delta", value: group.greeks.delta },
                    { label: "Gamma", value: group.greeks.gamma },
                    { label: "Theta", value: group.greeks.theta },
                    { label: "Vega", value: group.greeks.vega },
                  ].map((g) => (
                    <div key={g.label} className="bg-card px-4 py-2">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                        {g.label}
                      </p>
                      <p
                        className={cn(
                          "text-xs font-mono font-bold mt-0.5",
                          g.value >= 0 ? "text-foreground" : "text-loss"
                        )}
                      >
                        {g.value.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Legs Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-secondary/20">
                        {[
                          "Instrument",
                          "Type",
                          "Side",
                          "Qty",
                          "Avg Price",
                          "LTP",
                          "P&L",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left px-4 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.legs.map((leg, i) => (
                        <tr key={i} className="data-row">
                          <td className="px-4 py-2.5 font-mono text-foreground text-[11px] truncate max-w-[200px]">
                            {leg.symbol}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                leg.type === "CE"
                                  ? "bg-success/10 text-profit"
                                  : leg.type === "PE"
                                  ? "bg-destructive/10 text-loss"
                                  : "bg-accent/10 text-accent"
                              )}
                            >
                              {leg.type}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                leg.side === "BUY"
                                  ? "bg-success/10 text-profit"
                                  : "bg-destructive/10 text-loss"
                              )}
                            >
                              {leg.side}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-foreground">
                            {leg.qty}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-foreground">
                            ₹{leg.avgPrice.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-foreground">
                            ₹{leg.ltp.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1">
                              <span
                                className={cn(
                                  "font-mono font-semibold",
                                  leg.pnl >= 0
                                    ? "text-profit"
                                    : "text-loss"
                                )}
                              >
                                {leg.pnl >= 0 ? "+" : ""}₹
                                {Math.abs(leg.pnl).toFixed(0)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                <div className="px-4 py-3 border-t border-border/50 flex items-center gap-2">
                  <button className="text-[10px] font-medium px-3 py-1.5 rounded bg-destructive/10 text-loss hover:bg-destructive/20 transition-colors">
                    Exit Strategy
                  </button>
                  <button className="text-[10px] font-medium px-3 py-1.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    Add Hedge
                  </button>
                  <button className="text-[10px] font-medium px-3 py-1.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    Roll Forward
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {filteredGroups.length === 0 && !loading && (
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-xs text-muted-foreground">
            {strategyGroups.length > 0
              ? "No strategies match the current filters."
              : "No strategy positions to display."}
          </p>
        </div>
      )}
    </div>
  );
};

export default PositionStrategyView;
