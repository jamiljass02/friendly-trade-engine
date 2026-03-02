import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import MetricCard from "@/components/MetricCard";
import PositionsTable from "@/components/PositionsTable";
import StrategyBuilder from "@/components/StrategyBuilder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Wallet, Target, BarChart3, Activity, Bot, Pause, Play, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared algo state - in a real app this would come from a global store or context
// For now we simulate with localStorage
interface RunningAlgo {
  id: string;
  name: string;
  instrument: string;
  status: "deployed" | "paused";
  legs: number;
  recurrence: string;
  pnl: number;
}

function getRunningAlgos(): RunningAlgo[] {
  try {
    const stored = localStorage.getItem("tradex_algo_strategies");
    if (!stored) return [];
    const strategies = JSON.parse(stored);
    return strategies
      .filter((s: any) => s.status === "deployed" || s.status === "paused")
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        instrument: s.instrument,
        status: s.status,
        legs: s.legs?.length || 0,
        recurrence: s.recurrence || "daily",
        pnl: s.backtestResult?.totalPnl || Math.round((Math.random() - 0.3) * 5000),
      }));
  } catch {
    // Return demo data if nothing in storage
    return [
      { id: "demo1", name: "Short Straddle", instrument: "NIFTY", status: "deployed", legs: 2, recurrence: "daily", pnl: 2340 },
      { id: "demo2", name: "Iron Condor", instrument: "BANKNIFTY", status: "deployed", legs: 4, recurrence: "daily", pnl: -820 },
      { id: "demo3", name: "Calendar Spread", instrument: "NIFTY", status: "paused", legs: 2, recurrence: "weekly", pnl: 1150 },
    ];
  }
}

const Dashboard = () => {
  const [algos, setAlgos] = useState<RunningAlgo[]>(getRunningAlgos);

  const squareOffAlgo = (id: string) => {
    setAlgos((prev) => prev.filter((a) => a.id !== id));
  };

  const toggleAlgo = (id: string) => {
    setAlgos((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: a.status === "deployed" ? "paused" as const : "deployed" as const } : a
      )
    );
  };

  const closeAllAlgos = () => {
    setAlgos([]);
  };

  const activeCount = algos.filter((a) => a.status === "deployed").length;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} • NSE F&O Segment
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20">
              <Activity className="w-3 h-3 text-profit" />
              <span className="text-xs font-medium text-profit">Live</span>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total P&L"
            value="₹2,301"
            change="+3.2% today"
            changeType="profit"
            icon={TrendingUp}
          />
          <MetricCard
            title="Margin Used"
            value="₹1,85,400"
            change="18.5% of available"
            changeType="neutral"
            icon={Wallet}
          />
          <MetricCard
            title="Win Rate"
            value="68%"
            change="Last 30 trades"
            changeType="profit"
            icon={Target}
          />
          <MetricCard
            title="Active Algos"
            value={String(activeCount)}
            change={`${algos.length} total strategies`}
            changeType="neutral"
            icon={BarChart3}
          />
        </div>

        {/* Running Algos */}
        <Card>
          <CardHeader className="pb-3 px-4 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                Running Algo Strategies
                {activeCount > 0 && (
                  <Badge variant="secondary" className="text-[9px] ml-1">{activeCount} active</Badge>
                )}
              </CardTitle>
              {algos.length > 0 && (
                <Button size="sm" variant="destructive" onClick={closeAllAlgos} className="h-7 text-xs gap-1">
                  <Square className="w-3 h-3" />
                  Close All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {algos.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground">No algo strategies running</p>
              </div>
            ) : (
              <div className="space-y-2">
                {algos.map((algo) => (
                  <div
                    key={algo.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      algo.status === "deployed"
                        ? "border-success/20 bg-success/5"
                        : "border-warning/20 bg-warning/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        algo.status === "deployed" ? "bg-profit animate-pulse" : "bg-warning"
                      )} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{algo.name}</span>
                          <Badge variant="outline" className="text-[9px]">{algo.instrument}</Badge>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[8px]",
                              algo.status === "deployed" ? "bg-success/10 text-profit" : "bg-warning/10 text-warning"
                            )}
                          >
                            {algo.status === "deployed" ? "RUNNING" : "PAUSED"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          <span>{algo.legs} legs</span>
                          <span>•</span>
                          <span className="capitalize">{algo.recurrence}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-sm font-mono font-bold",
                        algo.pnl >= 0 ? "text-profit" : "text-loss"
                      )}>
                        {algo.pnl >= 0 ? "+" : ""}₹{algo.pnl.toLocaleString("en-IN")}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7"
                          onClick={() => toggleAlgo(algo.id)}
                          title={algo.status === "deployed" ? "Pause" : "Resume"}
                        >
                          {algo.status === "deployed" ? (
                            <Pause className="w-3.5 h-3.5 text-warning" />
                          ) : (
                            <Play className="w-3.5 h-3.5 text-profit" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7"
                          onClick={() => squareOffAlgo(algo.id)}
                          title="Square Off"
                        >
                          <X className="w-3.5 h-3.5 text-loss" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Strategy Builder + Positions */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <StrategyBuilder />
          <div className="space-y-6">
            <PositionsTable />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
