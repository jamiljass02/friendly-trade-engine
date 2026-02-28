import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FlaskConical,
  Play,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  BarChart3,
  AlertTriangle,
  Shield,
  Zap,
  XCircle,
  CheckCircle2,
  History,
  Loader2,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePaperTrading } from "@/hooks/usePaperTrading";
import {
  useBacktesting,
  defaultScenarios,
  type StressResult,
  type BacktestSummary,
} from "@/hooks/useBacktesting";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";

const instruments = ["NIFTY", "BANKNIFTY", "SENSEX", "RELIANCE", "TCS", "HDFCBANK"];
const strategies = [
  { value: "straddle", label: "Short Straddle" },
  { value: "strangle", label: "Short Strangle" },
  { value: "iron_condor", label: "Iron Condor" },
  { value: "calendar_spread", label: "Calendar Spread" },
];

const Sandbox = () => {
  const paper = usePaperTrading();
  const { runBacktest, runStressTest } = useBacktesting();

  // Backtest state
  const [btConfig, setBtConfig] = useState({
    instrument: "NIFTY",
    strategy: "straddle",
    days: 90,
    quantity: 50,
    stopLossPct: 50,
  });
  const [btResult, setBtResult] = useState<BacktestSummary | null>(null);
  const [btRunning, setBtRunning] = useState(false);

  // Stress test state
  const [stressResults, setStressResults] = useState<StressResult[]>([]);
  const [stressRunning, setStressRunning] = useState(false);

  // Paper trading demo order
  const [demoOrder, setDemoOrder] = useState({
    symbol: "NIFTY",
    type: "CE" as "CE" | "PE" | "FUT" | "EQ",
    side: "SELL" as "BUY" | "SELL",
    quantity: 50,
    price: 250,
    strike: 24500,
  });

  const handleRunBacktest = () => {
    setBtRunning(true);
    setTimeout(() => {
      const result = runBacktest(btConfig);
      setBtResult(result);
      setBtRunning(false);
    }, 800);
  };

  const handleRunStressTest = () => {
    setStressRunning(true);
    setTimeout(() => {
      // Use paper positions or create sample positions
      const positions =
        paper.portfolio.positions.length > 0
          ? paper.portfolio.positions.map((p) => ({
              symbol: p.symbol,
              side: p.side,
              quantity: p.quantity,
              price: p.currentPrice,
              type: p.type,
            }))
          : [
              { symbol: "NIFTY 24500 CE", side: "SELL" as const, quantity: 50, price: 250, type: "CE" },
              { symbol: "NIFTY 24500 PE", side: "SELL" as const, quantity: 50, price: 230, type: "PE" },
              { symbol: "NIFTY FUT", side: "BUY" as const, quantity: 50, price: 24550, type: "FUT" },
            ];

      const results = defaultScenarios.map((s) => runStressTest(positions, s));
      setStressResults(results);
      setStressRunning(false);
    }, 600);
  };

  const handlePlaceDemoOrder = () => {
    paper.placeOrder({
      symbol: `${demoOrder.symbol} ${demoOrder.strike} ${demoOrder.type}`,
      instrument: demoOrder.symbol,
      type: demoOrder.type,
      side: demoOrder.side,
      quantity: demoOrder.quantity,
      price: demoOrder.price,
      strike: demoOrder.strike,
    });
  };

  const riskColorMap = {
    low: "text-profit",
    medium: "text-warning",
    high: "text-loss",
    critical: "text-destructive",
  };
  const riskBgMap = {
    low: "bg-success/10",
    medium: "bg-warning/10",
    high: "bg-destructive/10",
    critical: "bg-destructive/20",
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Sandbox & Testing</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Paper trading • Backtesting • Stress testing • Risk simulation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={paper.isActive ? "default" : "secondary"}
              className="gap-1 cursor-pointer"
              onClick={() => paper.togglePaperMode(!paper.isActive)}
            >
              <FlaskConical className="w-3 h-3" />
              {paper.isActive ? "Paper Mode ON" : "Paper Mode OFF"}
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="paper">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="paper" className="gap-1.5 text-xs">
              <Wallet className="w-3.5 h-3.5" /> Paper Trading
            </TabsTrigger>
            <TabsTrigger value="backtest" className="gap-1.5 text-xs">
              <History className="w-3.5 h-3.5" /> Backtest
            </TabsTrigger>
            <TabsTrigger value="stress" className="gap-1.5 text-xs">
              <AlertTriangle className="w-3.5 h-3.5" /> Stress Test
            </TabsTrigger>
          </TabsList>

          {/* ═══════════ PAPER TRADING ═══════════ */}
          <TabsContent value="paper" className="space-y-4 mt-4">
            {/* Portfolio Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                {
                  label: "Capital",
                  value: `₹${paper.portfolio.currentCapital.toLocaleString("en-IN")}`,
                  icon: Wallet,
                  color: "text-primary",
                },
                {
                  label: "Realized P&L",
                  value: `${paper.portfolio.realizedPnl >= 0 ? "+" : ""}₹${paper.portfolio.realizedPnl.toLocaleString("en-IN")}`,
                  icon: CheckCircle2,
                  color: paper.portfolio.realizedPnl >= 0 ? "text-profit" : "text-loss",
                },
                {
                  label: "Unrealized P&L",
                  value: `${paper.portfolio.unrealizedPnl >= 0 ? "+" : ""}₹${Math.round(paper.portfolio.unrealizedPnl).toLocaleString("en-IN")}`,
                  icon: Activity,
                  color: paper.portfolio.unrealizedPnl >= 0 ? "text-profit" : "text-loss",
                },
                {
                  label: "Margin Used",
                  value: `₹${Math.round(paper.portfolio.marginUsed).toLocaleString("en-IN")}`,
                  icon: Shield,
                  color: "text-muted-foreground",
                },
                {
                  label: "Positions",
                  value: String(paper.portfolio.positions.length),
                  icon: BarChart3,
                  color: "text-primary",
                },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-3 flex items-center gap-2.5">
                    <s.icon className={cn("w-4 h-4 shrink-0", s.color)} />
                    <div className="min-w-0">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider truncate">{s.label}</p>
                      <p className={cn("text-sm font-bold font-mono", s.color)}>{s.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quick Order */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Place Paper Order
                  </CardTitle>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        paper.isActive ? paper.stopPriceTicker() : paper.startPriceTicker();
                      }}
                      className="text-xs h-7 gap-1"
                    >
                      <Play className="w-3 h-3" />
                      {paper.isActive ? "Stop Ticker" : "Start Ticker"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={paper.resetPortfolio}
                      className="text-xs h-7 gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Symbol</label>
                    <select
                      value={demoOrder.symbol}
                      onChange={(e) => setDemoOrder({ ...demoOrder, symbol: e.target.value })}
                      className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50"
                    >
                      {instruments.map((i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Type</label>
                    <select
                      value={demoOrder.type}
                      onChange={(e) => setDemoOrder({ ...demoOrder, type: e.target.value as any })}
                      className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50"
                    >
                      {["CE", "PE", "FUT", "EQ"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Side</label>
                    <div className="mt-1 flex gap-1">
                      {(["BUY", "SELL"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setDemoOrder({ ...demoOrder, side: s })}
                          className={cn(
                            "flex-1 text-xs py-2 rounded-md font-medium transition-colors",
                            demoOrder.side === s
                              ? s === "BUY"
                                ? "bg-success/20 text-profit border border-success/30"
                                : "bg-destructive/20 text-loss border border-destructive/30"
                              : "bg-muted text-muted-foreground border border-border/50"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Strike</label>
                    <input
                      type="number"
                      value={demoOrder.strike}
                      onChange={(e) => setDemoOrder({ ...demoOrder, strike: Number(e.target.value) })}
                      className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Price</label>
                    <input
                      type="number"
                      value={demoOrder.price}
                      onChange={(e) => setDemoOrder({ ...demoOrder, price: Number(e.target.value) })}
                      className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 font-mono"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handlePlaceDemoOrder}
                      className="w-full gap-1.5"
                      size="sm"
                      variant={demoOrder.side === "BUY" ? "default" : "destructive"}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {demoOrder.side} {demoOrder.type}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Positions */}
            {paper.portfolio.positions.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      Paper Positions
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={paper.closeAllPositions}
                      className="text-xs h-7 gap-1"
                    >
                      <XCircle className="w-3 h-3" />
                      Close All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50">
                          {["Symbol", "Side", "Qty", "Entry", "LTP", "P&L"].map((h) => (
                            <th
                              key={h}
                              className="text-left px-3 py-2 text-muted-foreground font-medium uppercase tracking-wider text-[10px]"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paper.portfolio.positions.map((p) => (
                          <tr key={p.id} className="data-row">
                            <td className="px-3 py-2 font-mono text-foreground">{p.symbol}</td>
                            <td className="px-3 py-2">
                              <Badge variant={p.side === "BUY" ? "default" : "destructive"} className="text-[9px]">
                                {p.side}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 font-mono">{p.quantity}</td>
                            <td className="px-3 py-2 font-mono">₹{p.entryPrice.toFixed(2)}</td>
                            <td className="px-3 py-2 font-mono">₹{p.currentPrice.toFixed(2)}</td>
                            <td className={cn("px-3 py-2 font-mono font-semibold", p.pnl >= 0 ? "text-profit" : "text-loss")}>
                              {p.pnl >= 0 ? "+" : ""}₹{Math.round(p.pnl).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Trade History */}
            {paper.portfolio.tradeHistory.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    Trade History ({paper.portfolio.tradeHistory.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b border-border/50">
                          {["Time", "Symbol", "Side", "Qty", "Price", "Fill", "Status"].map((h) => (
                            <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...paper.portfolio.tradeHistory].reverse().slice(0, 20).map((o) => (
                          <tr key={o.id} className="data-row">
                            <td className="px-3 py-1.5 font-mono text-muted-foreground text-[10px]">
                              {o.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </td>
                            <td className="px-3 py-1.5 font-mono text-foreground">{o.symbol}</td>
                            <td className="px-3 py-1.5">
                              <Badge variant={o.side === "BUY" ? "default" : "destructive"} className="text-[8px] px-1 py-0">{o.side}</Badge>
                            </td>
                            <td className="px-3 py-1.5 font-mono">{o.quantity}</td>
                            <td className="px-3 py-1.5 font-mono">₹{o.price.toFixed(2)}</td>
                            <td className="px-3 py-1.5 font-mono">₹{(o.fillPrice || o.price).toFixed(2)}</td>
                            <td className="px-3 py-1.5">
                              <Badge variant="default" className="text-[8px] px-1 py-0">{o.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════ BACKTESTING ═══════════ */}
          <TabsContent value="backtest" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  Strategy Backtester
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Instrument</label>
                    <select
                      value={btConfig.instrument}
                      onChange={(e) => setBtConfig({ ...btConfig, instrument: e.target.value })}
                      className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50"
                    >
                      {instruments.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Strategy</label>
                    <select
                      value={btConfig.strategy}
                      onChange={(e) => setBtConfig({ ...btConfig, strategy: e.target.value })}
                      className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50"
                    >
                      {strategies.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Period (days)</label>
                    <select
                      value={btConfig.days}
                      onChange={(e) => setBtConfig({ ...btConfig, days: Number(e.target.value) })}
                      className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50"
                    >
                      {[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Quantity</label>
                    <input
                      type="number"
                      value={btConfig.quantity}
                      onChange={(e) => setBtConfig({ ...btConfig, quantity: Number(e.target.value) })}
                      className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 font-mono"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleRunBacktest} disabled={btRunning} size="sm" className="w-full gap-1.5">
                      {btRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {btRunning ? "Running..." : "Run Backtest"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Backtest Results */}
            {btResult && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Total P&L", value: `${btResult.totalPnl >= 0 ? "+" : ""}₹${btResult.totalPnl.toLocaleString("en-IN")}`, color: btResult.totalPnl >= 0 ? "text-profit" : "text-loss" },
                    { label: "Win Rate", value: `${btResult.winRate}%`, color: btResult.winRate >= 50 ? "text-profit" : "text-loss" },
                    { label: "Sharpe Ratio", value: btResult.sharpeRatio.toFixed(2), color: btResult.sharpeRatio >= 1 ? "text-profit" : "text-warning" },
                    { label: "Max Drawdown", value: `₹${btResult.maxDrawdown.toLocaleString("en-IN")}`, color: "text-loss" },
                    { label: "Profit Factor", value: btResult.profitFactor.toFixed(2), color: btResult.profitFactor >= 1.5 ? "text-profit" : "text-warning" },
                    { label: "Total Trades", value: String(btResult.totalTrades), color: "text-foreground" },
                    { label: "Avg Premium", value: `₹${btResult.avgPremium.toFixed(0)}`, color: "text-primary" },
                    { label: "Max Consec. Losses", value: String(btResult.maxConsecutiveLosses), color: btResult.maxConsecutiveLosses > 5 ? "text-loss" : "text-foreground" },
                  ].map((s) => (
                    <Card key={s.label}>
                      <CardContent className="p-3">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                        <p className={cn("text-lg font-bold font-mono", s.color)}>{s.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Equity Curve */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Equity Curve</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={btResult.results}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(v) => v.slice(5)}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "11px",
                            }}
                            formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Cumulative P&L"]}
                          />
                          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                          <Line
                            type="monotone"
                            dataKey="cumulativePnl"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Daily P&L */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Daily P&L Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={btResult.results.slice(-60)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(v) => v.slice(8)}
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "11px",
                            }}
                          />
                          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                          <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                            {btResult.results.slice(-60).map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.pnl >= 0 ? "hsl(var(--chart-profit))" : "hsl(var(--chart-loss))"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ═══════════ STRESS TESTING ═══════════ */}
          <TabsContent value="stress" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    Market Stress Scenarios
                  </CardTitle>
                  <Button onClick={handleRunStressTest} disabled={stressRunning} size="sm" className="gap-1.5">
                    {stressRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    Run All Scenarios
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-4">
                  Tests your current portfolio (or sample positions) against extreme market scenarios.
                </p>

                {/* Scenario Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {defaultScenarios.map((scenario, i) => {
                    const result = stressResults[i];
                    return (
                      <div
                        key={scenario.name}
                        className={cn(
                          "p-4 rounded-lg border transition-colors",
                          result ? `${riskBgMap[result.riskLevel]} border-border` : "border-border bg-secondary/20"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-foreground">{scenario.name}</h4>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{scenario.description}</p>
                          </div>
                          {result && (
                            <Badge
                              variant={result.riskLevel === "critical" || result.riskLevel === "high" ? "destructive" : "secondary"}
                              className="text-[9px] shrink-0"
                            >
                              {result.riskLevel.toUpperCase()}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mt-3 text-[10px]">
                          <div className="flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Spot: {scenario.spotChange > 0 ? "+" : ""}{scenario.spotChange}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Activity className="w-3 h-3 text-muted-foreground" />
                            <span className="text-muted-foreground">IV: ×{scenario.ivMultiplier}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Target className="w-3 h-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Liq: {Math.round(scenario.liquidityFactor * 100)}%</span>
                          </div>
                        </div>

                        {result && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">Portfolio Impact</span>
                              <span className={cn("text-sm font-bold font-mono", result.portfolioImpact >= 0 ? "text-profit" : "text-loss")}>
                                {result.portfolioImpact >= 0 ? "+" : ""}₹{result.portfolioImpact.toLocaleString("en-IN")}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-muted-foreground">Margin Increase</span>
                              <span className="text-xs font-mono text-warning">
                                +₹{result.marginImpact.toLocaleString("en-IN")}
                              </span>
                            </div>

                            {/* Position-level impacts */}
                            {result.positionImpacts.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {result.positionImpacts.map((pi) => (
                                  <div key={pi.symbol} className="flex items-center justify-between text-[10px]">
                                    <span className="text-muted-foreground font-mono truncate max-w-[120px]">{pi.symbol}</span>
                                    <span className={cn("font-mono", pi.impact >= 0 ? "text-profit" : "text-loss")}>
                                      {pi.impact >= 0 ? "+" : ""}₹{pi.impact.toLocaleString("en-IN")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Stress Summary */}
            {stressResults.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Risk Assessment Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={stressResults.map((r) => ({
                          name: r.scenario.replace(/[()]/g, "").slice(0, 15),
                          impact: r.portfolioImpact,
                        }))}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={100}
                          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "11px",
                          }}
                        />
                        <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
                        <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                          {stressResults.map((r, i) => (
                            <Cell
                              key={i}
                              fill={r.portfolioImpact >= 0 ? "hsl(var(--chart-profit))" : "hsl(var(--chart-loss))"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4 p-3 rounded-lg bg-secondary/30 border border-border">
                    <h4 className="text-xs font-semibold text-foreground mb-2">Key Insights</h4>
                    <ul className="space-y-1 text-[11px] text-muted-foreground">
                      <li className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 mt-0.5 text-warning shrink-0" />
                        Worst case loss: ₹{Math.abs(Math.min(...stressResults.map((r) => r.portfolioImpact))).toLocaleString("en-IN")}
                        {" "}({stressResults.find((r) => r.portfolioImpact === Math.min(...stressResults.map((r) => r.portfolioImpact)))?.scenario})
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Shield className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                        {stressResults.filter((r) => r.riskLevel === "critical").length} critical scenarios,{" "}
                        {stressResults.filter((r) => r.riskLevel === "high").length} high risk
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Target className="w-3 h-3 mt-0.5 text-profit shrink-0" />
                        Max margin surge: ₹{Math.max(...stressResults.map((r) => r.marginImpact)).toLocaleString("en-IN")}
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Sandbox;
