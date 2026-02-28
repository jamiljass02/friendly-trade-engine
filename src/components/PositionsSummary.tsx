import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Wallet,
  Activity,
  Layers,
  PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface PositionsSummaryProps {
  positions: Position[];
  loading?: boolean;
}

const INDICES = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"];

function extractUnderlying(symbol: string): string {
  const match = symbol.match(/^([A-Z&]+)\d/);
  return match ? match[1] : symbol;
}

const PositionsSummary = ({ positions, loading }: PositionsSummaryProps) => {
  const stats = useMemo(() => {
    const todayPnl = positions.reduce((s, p) => s + p.pnl, 0);
    const overallPnl = todayPnl * 1.35; // Mock overall as slightly more

    // Margin calculation
    const totalMarginUsed = positions.reduce((s, p) => {
      const notional = p.avgPrice * p.qty;
      if (p.type === "FUT") return s + notional * 0.12;
      if (p.side === "SELL") return s + notional * 0.15;
      return s + notional * 0.05; // Premium for buys
    }, 0);
    const availableMargin = 500000 - totalMarginUsed; // Mock total capital

    // Counts
    const indexPositions = positions.filter((p) =>
      INDICES.includes(extractUnderlying(p.symbol))
    ).length;
    const stockPositions = positions.length - indexPositions;

    const futuresCount = positions.filter((p) => p.type === "FUT").length;
    const optionsCount = positions.length - futuresCount;

    // Net Greeks (mock calculation)
    let netDelta = 0, netGamma = 0, netTheta = 0;
    for (const p of positions) {
      const multiplier = p.side === "BUY" ? 1 : -1;
      if (p.type === "FUT") {
        netDelta += multiplier * p.qty;
      } else {
        const d = p.type === "CE" ? 0.5 : -0.5;
        netDelta += d * multiplier * p.qty;
        netGamma += 0.002 * p.qty;
        netTheta += (p.side === "SELL" ? 1 : -1) * p.ltp * 0.05 * p.qty;
      }
    }

    return {
      todayPnl: Math.round(todayPnl),
      overallPnl: Math.round(overallPnl),
      todayPnlPercent: totalMarginUsed > 0 ? (todayPnl / totalMarginUsed) * 100 : 0,
      totalMarginUsed: Math.round(totalMarginUsed),
      availableMargin: Math.round(availableMargin),
      marginUtilization: totalMarginUsed > 0 ? (totalMarginUsed / 500000) * 100 : 0,
      indexPositions,
      stockPositions,
      futuresCount,
      optionsCount,
      netDelta: Math.round(netDelta * 100) / 100,
      netGamma: Math.round(netGamma * 100) / 100,
      netTheta: Math.round(netTheta * 100) / 100,
    };
  }, [positions]);

  const cards = [
    {
      label: "Today's P&L",
      value: `${stats.todayPnl >= 0 ? "+" : ""}₹${Math.abs(stats.todayPnl).toLocaleString("en-IN")}`,
      sub: `${stats.todayPnlPercent >= 0 ? "+" : ""}${stats.todayPnlPercent.toFixed(2)}%`,
      color: stats.todayPnl >= 0 ? "text-profit" : "text-loss",
      subColor: stats.todayPnl >= 0 ? "text-profit" : "text-loss",
      icon: stats.todayPnl >= 0 ? TrendingUp : TrendingDown,
      iconColor: stats.todayPnl >= 0 ? "text-profit" : "text-loss",
    },
    {
      label: "Overall P&L",
      value: `${stats.overallPnl >= 0 ? "+" : ""}₹${Math.abs(stats.overallPnl).toLocaleString("en-IN")}`,
      sub: "All time",
      color: stats.overallPnl >= 0 ? "text-profit" : "text-loss",
      subColor: "text-muted-foreground",
      icon: BarChart3,
      iconColor: stats.overallPnl >= 0 ? "text-profit" : "text-loss",
    },
    {
      label: "Margin Used",
      value: `₹${stats.totalMarginUsed.toLocaleString("en-IN")}`,
      sub: `${stats.marginUtilization.toFixed(1)}% utilized`,
      color: "text-foreground",
      subColor: stats.marginUtilization > 80 ? "text-warning" : "text-muted-foreground",
      icon: Wallet,
      iconColor: stats.marginUtilization > 80 ? "text-warning" : "text-primary",
    },
    {
      label: "Available Margin",
      value: `₹${stats.availableMargin.toLocaleString("en-IN")}`,
      sub: "Free balance",
      color: stats.availableMargin > 0 ? "text-profit" : "text-loss",
      subColor: "text-muted-foreground",
      icon: Wallet,
      iconColor: stats.availableMargin > 0 ? "text-profit" : "text-loss",
    },
  ];

  const secondRow = [
    {
      label: "Index Positions",
      value: stats.indexPositions.toString(),
      sub: `${stats.indexPositions} legs`,
      icon: Activity,
      iconColor: "text-primary",
    },
    {
      label: "Stock Positions",
      value: stats.stockPositions.toString(),
      sub: `${stats.stockPositions} legs`,
      icon: Layers,
      iconColor: "text-accent",
    },
    {
      label: "Options / Futures",
      value: `${stats.optionsCount} / ${stats.futuresCount}`,
      sub: `${positions.length} total`,
      icon: PieChart,
      iconColor: "text-primary",
    },
  ];

  return (
    <div className="space-y-3">
      {/* Top Row - P&L and Margin */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="glass-card rounded-xl px-4 py-3.5 flex items-start justify-between"
          >
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                {card.label}
              </p>
              <p className={cn("text-lg font-mono font-bold mt-1", card.color)}>
                {loading ? "—" : card.value}
              </p>
              <p className={cn("text-[10px] font-mono mt-0.5", card.subColor)}>
                {loading ? "" : card.sub}
              </p>
            </div>
            <div className={cn("p-2 rounded-lg bg-secondary/50 mt-0.5", card.iconColor)}>
              <card.icon className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Second Row - Counts + Greeks */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {secondRow.map((card) => (
          <div
            key={card.label}
            className="glass-card rounded-xl px-4 py-3 flex items-center gap-3"
          >
            <div className={cn("p-1.5 rounded-lg bg-secondary/50", card.iconColor)}>
              <card.icon className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                {card.label}
              </p>
              <p className="text-sm font-mono font-bold text-foreground mt-0.5">
                {loading ? "—" : card.value}
              </p>
            </div>
          </div>
        ))}

        {/* Greeks Cards */}
        {[
          { label: "Net Delta", value: stats.netDelta, color: stats.netDelta >= 0 ? "text-profit" : "text-loss" },
          { label: "Net Gamma", value: stats.netGamma, color: "text-foreground" },
          { label: "Net Theta", value: stats.netTheta, color: stats.netTheta >= 0 ? "text-profit" : "text-loss" },
        ].map((g) => (
          <div
            key={g.label}
            className="glass-card rounded-xl px-4 py-3"
          >
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
              {g.label}
            </p>
            <p className={cn("text-sm font-mono font-bold mt-0.5", g.color)}>
              {loading ? "—" : g.value.toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      {/* Margin Utilization Bar */}
      {!loading && (
        <div className="glass-card rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Margin Utilization
            </span>
            <span className="text-[10px] font-mono text-foreground">
              ₹{stats.totalMarginUsed.toLocaleString("en-IN")} / ₹5,00,000
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                stats.marginUtilization > 80
                  ? "bg-warning"
                  : stats.marginUtilization > 60
                  ? "bg-primary"
                  : "bg-profit"
              )}
              style={{ width: `${Math.min(100, stats.marginUtilization)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-muted-foreground">
              {stats.marginUtilization.toFixed(1)}% used
            </span>
            <span className={cn("text-[9px] font-medium", stats.availableMargin > 0 ? "text-profit" : "text-loss")}>
              ₹{stats.availableMargin.toLocaleString("en-IN")} free
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PositionsSummary;
