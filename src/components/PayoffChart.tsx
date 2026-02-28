import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { getDefaultSpotPrice, getInstrument } from "@/lib/instruments";

interface Leg {
  strike: number;
  type: "CE" | "PE";
  ltp: number;
  action: "BUY" | "SELL";
}

interface PayoffChartProps {
  legs: Leg[];
  instrument: string;
  qty: number;
}

function calcLegPayoff(leg: Leg, spotAtExpiry: number): number {
  const intrinsic =
    leg.type === "CE"
      ? Math.max(0, spotAtExpiry - leg.strike)
      : Math.max(0, leg.strike - spotAtExpiry);
  const pnl = intrinsic - leg.ltp;
  return leg.action === "BUY" ? pnl : -pnl;
}

const PayoffChart = ({ legs, instrument, qty }: PayoffChartProps) => {
  const spot = getDefaultSpotPrice(instrument);
  const inst = getInstrument(instrument);
  const step = inst?.strikeStep || 50;

  const { data, maxProfit, maxLoss, breakevens } = useMemo(() => {
    const strikes = legs.map((l) => l.strike);
    const minStrike = Math.min(...strikes);
    const maxStrike = Math.max(...strikes);
    const range = Math.max(maxStrike - minStrike, step * 10);
    const lower = minStrike - range * 0.6;
    const upper = maxStrike + range * 0.6;
    const points: { spot: number; pnl: number }[] = [];
    let maxP = -Infinity;
    let maxL = Infinity;
    const chartStep = Math.max(1, Math.round((upper - lower) / 200));

    for (let s = lower; s <= upper; s += chartStep) {
      const totalPnl = legs.reduce((sum, leg) => sum + calcLegPayoff(leg, s), 0) * qty;
      points.push({ spot: Math.round(s), pnl: Math.round(totalPnl) });
      if (totalPnl > maxP) maxP = totalPnl;
      if (totalPnl < maxL) maxL = totalPnl;
    }

    // Find breakevens (where pnl crosses zero)
    const bks: number[] = [];
    for (let i = 1; i < points.length; i++) {
      if (
        (points[i - 1].pnl <= 0 && points[i].pnl >= 0) ||
        (points[i - 1].pnl >= 0 && points[i].pnl <= 0)
      ) {
        // Linear interpolation
        const ratio = Math.abs(points[i - 1].pnl) / (Math.abs(points[i - 1].pnl) + Math.abs(points[i].pnl));
        bks.push(Math.round(points[i - 1].spot + ratio * chartStep));
      }
    }

    return {
      data: points,
      maxProfit: maxP === -Infinity ? 0 : Math.round(maxP),
      maxLoss: maxL === Infinity ? 0 : Math.round(maxL),
      breakevens: bks,
    };
  }, [legs, qty, step]);

  // Split data into profit/loss for gradient fill
  const gradientId = "payoff-gradient";

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50">
        <h3 className="text-sm font-semibold text-foreground">Payoff Chart</h3>
        <p className="text-xs text-muted-foreground mt-0.5">P&L at expiry</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-px bg-border/30">
        <div className="bg-card px-4 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Max Profit</p>
          <p className="text-sm font-mono font-bold text-profit mt-1">
            {maxProfit === Infinity
              ? "Unlimited"
              : `₹${maxProfit.toLocaleString("en-IN")}`}
          </p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Max Loss</p>
          <p className="text-sm font-mono font-bold text-loss mt-1">
            ₹{Math.abs(maxLoss).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Breakeven</p>
          <p className="text-sm font-mono font-bold text-foreground mt-1">
            {breakevens.length === 0
              ? "—"
              : breakevens.map((b) => b.toLocaleString("en-IN")).join(", ")}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 py-4 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4} />
                <stop offset="45%" stopColor="hsl(var(--chart-2))" stopOpacity={0.05} />
                <stop offset="55%" stopColor="hsl(var(--destructive))" stopOpacity={0.05} />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="spot"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) =>
                v >= 10000 ? `${(v / 1000).toFixed(0)}K` : v.toString()
              }
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => {
                if (Math.abs(v) >= 100000) return `${(v / 100000).toFixed(1)}L`;
                if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}K`;
                return v.toString();
              }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "11px",
                boxShadow: "0 8px 24px hsl(var(--background) / 0.5)",
              }}
              labelFormatter={(v) => `Spot: ${Number(v).toLocaleString("en-IN")}`}
              formatter={(value: number) => [
                `₹${value.toLocaleString("en-IN")}`,
                "P&L",
              ]}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeOpacity={0.5} />
            <ReferenceLine
              x={spot}
              stroke="hsl(var(--primary))"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={{
                value: `Spot ${spot.toLocaleString("en-IN")}`,
                position: "top",
                fill: "hsl(var(--primary))",
                fontSize: 10,
              }}
            />
            {breakevens.map((b, i) => (
              <ReferenceLine
                key={i}
                x={b}
                stroke="hsl(var(--warning, 45 93% 47%))"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            ))}
            <Area
              type="monotone"
              dataKey="pnl"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{
                r: 4,
                fill: "hsl(var(--primary))",
                stroke: "hsl(var(--background))",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Strategy Legs Summary Table */}
      <div className="border-t border-border/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary/20">
              <th className="text-left px-4 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">Action</th>
              <th className="text-left px-4 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">Type</th>
              <th className="text-right px-4 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">Strike</th>
              <th className="text-right px-4 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">Premium</th>
              <th className="text-right px-4 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">Value</th>
            </tr>
          </thead>
          <tbody>
            {legs.map((leg) => (
              <tr key={`${leg.strike}-${leg.type}`} className="border-t border-border/20">
                <td className="px-4 py-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${leg.action === "SELL" ? "bg-destructive/10 text-loss" : "bg-success/10 text-profit"}`}>
                    {leg.action}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${leg.type === "CE" ? "bg-success/10 text-profit" : "bg-destructive/10 text-loss"}`}>
                    {leg.type}
                  </span>
                </td>
                <td className="text-right px-4 py-2 font-mono font-semibold text-foreground">
                  {leg.strike.toLocaleString("en-IN")}
                </td>
                <td className="text-right px-4 py-2 font-mono text-muted-foreground">
                  ₹{leg.ltp.toFixed(2)}
                </td>
                <td className={`text-right px-4 py-2 font-mono font-semibold ${leg.action === "SELL" ? "text-profit" : "text-loss"}`}>
                  {leg.action === "SELL" ? "+" : "-"}₹{(leg.ltp * qty).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PayoffChart;
