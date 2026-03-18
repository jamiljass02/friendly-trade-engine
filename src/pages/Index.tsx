import { useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import MetricCard from "@/components/MetricCard";
import PositionsTable from "@/components/PositionsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Wallet, Target, BarChart3, Activity, Bot, Pause, Play, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRunningStrategies } from "@/hooks/useRunningStrategies";
import { removeRunningStrategy, updateRunningStrategyStatus } from "@/lib/strategy-runtime";
import { usePaperTrading } from "@/hooks/usePaperTrading";

const Dashboard = () => {
  const runningStrategies = useRunningStrategies();
  const paper = usePaperTrading();

  const activeCount = useMemo(
    () => runningStrategies.filter((item) => item.status === "running").length,
    [runningStrategies]
  );

  const paperCount = useMemo(
    () => runningStrategies.filter((item) => item.mode === "paper").length,
    [runningStrategies]
  );

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
          <MetricCard title="Total P&L" value="₹2,301" change="Synced across paper/live" changeType="profit" icon={TrendingUp} />
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
                {runningStrategies.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      item.status === "running" ? "border-success/20 bg-success/5" : "border-warning/20 bg-warning/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-2 h-2 rounded-full", item.status === "running" ? "bg-profit animate-pulse" : "bg-warning")} />
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

                    <div className="flex items-center gap-1">
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
                ))}
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
