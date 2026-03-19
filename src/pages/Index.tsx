import { useMemo, useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import MetricCard from "@/components/MetricCard";
import PositionsTable from "@/components/PositionsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Wallet, Target, BarChart3, Activity, Bot, Pause, Play, Square, X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRunningStrategies } from "@/hooks/useRunningStrategies";
import { removeRunningStrategy, updateRunningStrategyStatus, type RunningStrategyRuntime } from "@/lib/strategy-runtime";
import { usePaperTrading, type PaperPosition } from "@/hooks/usePaperTrading";

const Dashboard = () => {
  const runningStrategies = useRunningStrategies();
  const paper = usePaperTrading();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Start price ticker for paper positions so P&L updates every 5 seconds
  useEffect(() => {
    if (paper.portfolio.positions.length === 0) return;
    const interval = setInterval(() => paper.tickPrices(), 5000);
    return () => clearInterval(interval);
  }, [paper.portfolio.positions.length, paper.tickPrices]);

  const activeCount = useMemo(
    () => runningStrategies.filter((item) => item.status === "running").length,
    [runningStrategies]
  );

  const paperCount = useMemo(
    () => runningStrategies.filter((item) => item.mode === "paper").length,
    [runningStrategies]
  );

  // Calculate P&L for a strategy by matching its leg symbols to paper positions
  const getStrategyPnl = useCallback((strategy: RunningStrategyRuntime) => {
    const legSymbols = new Set(strategy.legs.map((l) => l.symbol));
    let totalPnl = 0;
    const matchedPositions: PaperPosition[] = [];
    for (const pos of paper.portfolio.positions) {
      if (legSymbols.has(pos.symbol)) {
        totalPnl += pos.pnl;
        matchedPositions.push(pos);
      }
    }
    return { totalPnl, matchedPositions };
  }, [paper.portfolio.positions]);

  const totalStrategyPnl = useMemo(() => {
    return runningStrategies.reduce((sum, s) => sum + getStrategyPnl(s).totalPnl, 0);
  }, [runningStrategies, getStrategyPnl]);

  const squareOffStrategy = (id: string, symbols: string[]) => {
    paper.closePositionsBySymbols(symbols);
    removeRunningStrategy(id);
  };

  const closeAll = () => {
    paper.closePositionsBySymbols(runningStrategies.flatMap((item) => item.legs.map((leg) => leg.symbol)));
    runningStrategies.forEach((item) => removeRunningStrategy(item.id));
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} • Strategy runtime overview
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20">
              <Activity className="w-3 h-3 text-profit" />
              <span className="text-xs font-medium text-profit">Market Open</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total P&L"
            value={`₹${totalStrategyPnl.toFixed(0)}`}
            change="Across all running strategies"
            changeType={totalStrategyPnl >= 0 ? "profit" : "loss"}
            icon={TrendingUp}
          />
          <MetricCard title="Paper Positions" value={String(paper.portfolio.positions.length)} change={`${paperCount} running strategies`} changeType="neutral" icon={Wallet} />
          <MetricCard title="Win Rate" value="68%" change="Last 30 trades" changeType="profit" icon={Target} />
          <MetricCard title="Active Strategies" value={String(activeCount)} change={`${runningStrategies.length} total tracked`} changeType="neutral" icon={BarChart3} />
        </div>

        <Card>
          <CardHeader className="pb-3 px-4 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                Running Strategies
                {activeCount > 0 && <Badge variant="secondary" className="text-[9px] ml-1">{activeCount} active</Badge>}
              </CardTitle>
              {runningStrategies.length > 0 && (
                <Button size="sm" variant="destructive" onClick={closeAll} className="h-7 text-xs gap-1">
                  <Square className="w-3 h-3" />
                  Close All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {runningStrategies.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground">No strategy is running right now</p>
              </div>
            ) : (
              <div className="space-y-2">
                {runningStrategies.map((item) => {
                  const { totalPnl, matchedPositions } = getStrategyPnl(item);
                  const isExpanded = expandedId === item.id;

                  return (
                    <div key={item.id} className="rounded-lg border transition-colors overflow-hidden"
                      style={{ borderColor: item.status === "running" ? "hsl(var(--success) / 0.2)" : "hsl(var(--warning) / 0.2)" }}
                    >
                      {/* Strategy header row */}
                      <div
                        className={cn(
                          "flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/30 transition-colors",
                          item.status === "running" ? "bg-success/5" : "bg-warning/5"
                        )}
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", item.status === "running" ? "bg-profit animate-pulse" : "bg-warning")} />
                          {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">{item.name}</span>
                              <Badge variant="outline" className="text-[9px]">{item.instrument}</Badge>
                              <Badge variant="outline" className="text-[9px]">{item.mode === "paper" ? "PAPER" : "LIVE"}</Badge>
                              <Badge variant="outline" className="text-[9px]">{item.source === "algo" ? "ALGO" : "BUILDER"}</Badge>
                              <Badge variant="secondary" className={cn("text-[8px]", item.status === "running" ? "bg-success/10 text-profit" : "bg-warning/10 text-warning")}>
                                {item.status === "running" ? "RUNNING" : "PAUSED"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                              <span>{item.legs.length} legs</span>
                              <span>•</span>
                              <span>{item.productType || "MIS"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* P&L display */}
                          <span className={cn("text-sm font-bold tabular-nums", totalPnl >= 0 ? "text-profit" : "text-loss")}>
                            {totalPnl >= 0 ? "+" : ""}₹{totalPnl.toFixed(0)}
                          </span>

                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-7 h-7"
                              onClick={() => updateRunningStrategyStatus(item.id, item.status === "running" ? "paused" : "running")}
                              title={item.status === "running" ? "Pause" : "Resume"}
                            >
                              {item.status === "running" ? <Pause className="w-3.5 h-3.5 text-warning" /> : <Play className="w-3.5 h-3.5 text-profit" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-7 h-7"
                              onClick={() => squareOffStrategy(item.id, item.legs.map((leg) => leg.symbol))}
                              title="Square Off"
                            >
                              <X className="w-3.5 h-3.5 text-loss" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded legs table */}
                      {isExpanded && (
                        <div className="border-t border-border/50 bg-secondary/10">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="border-b border-border/30">
                                <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Symbol</th>
                                <th className="text-center px-2 py-1.5 text-muted-foreground font-medium">Type</th>
                                <th className="text-center px-2 py-1.5 text-muted-foreground font-medium">Side</th>
                                <th className="text-right px-2 py-1.5 text-muted-foreground font-medium">Qty</th>
                                <th className="text-right px-2 py-1.5 text-muted-foreground font-medium">Entry</th>
                                <th className="text-right px-2 py-1.5 text-muted-foreground font-medium">LTP</th>
                                <th className="text-right px-3 py-1.5 text-muted-foreground font-medium">P&L</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.legs.map((leg, idx) => {
                                const matched = matchedPositions.find((p) => p.symbol === leg.symbol);
                                const legPnl = matched?.pnl ?? 0;
                                const currentPrice = matched?.currentPrice ?? leg.price;
                                return (
                                  <tr key={idx} className="border-b border-border/20 last:border-0">
                                    <td className="px-3 py-1.5 font-mono text-foreground">{leg.symbol}</td>
                                    <td className="text-center px-2 py-1.5">
                                      <Badge variant="outline" className={cn("text-[8px]", leg.type === "CE" ? "text-profit border-success/30" : "text-loss border-destructive/30")}>
                                        {leg.type}
                                      </Badge>
                                    </td>
                                    <td className="text-center px-2 py-1.5">
                                      <span className={cn("font-medium", leg.side === "BUY" ? "text-profit" : "text-loss")}>{leg.side}</span>
                                    </td>
                                    <td className="text-right px-2 py-1.5 text-foreground">{leg.quantity}</td>
                                    <td className="text-right px-2 py-1.5 text-muted-foreground">₹{leg.price.toFixed(2)}</td>
                                    <td className="text-right px-2 py-1.5 text-foreground">₹{currentPrice.toFixed(2)}</td>
                                    <td className={cn("text-right px-3 py-1.5 font-semibold tabular-nums", legPnl >= 0 ? "text-profit" : "text-loss")}>
                                      {legPnl >= 0 ? "+" : ""}₹{legPnl.toFixed(0)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-6">
            <PositionsTable />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;