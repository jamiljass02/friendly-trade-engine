import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Play, Pause, Plus, Clock, TrendingUp, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const algoStrategies = [
  {
    name: "Nifty Straddle Seller",
    status: "running",
    pnl: 4520,
    trades: 12,
    description: "Sells ATM straddle at 9:20, SL at 30%",
  },
  {
    name: "BankNifty Iron Condor",
    status: "paused",
    pnl: -1200,
    trades: 5,
    description: "Weekly IC with delta-neutral adjustments",
  },
  {
    name: "Momentum Scalper",
    status: "stopped",
    pnl: 0,
    trades: 0,
    description: "Breakout strategy on top 5 F&O stocks",
  },
];

const Algo = () => {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Algo Trading</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automated strategy execution & scheduling
            </p>
          </div>
          <Button size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Algo
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Active Algos", value: "1", icon: Bot, color: "text-primary" },
            { label: "Today's P&L", value: "₹3,320", icon: TrendingUp, color: "text-profit" },
            { label: "Total Trades", value: "17", icon: Clock, color: "text-muted-foreground" },
            { label: "Risk Score", value: "Low", icon: Shield, color: "text-profit" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className="text-lg font-bold font-mono text-foreground">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Algo list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              Your Algorithms
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {algoStrategies.map((algo) => (
              <div
                key={algo.name}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center border border-border">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{algo.name}</span>
                      <Badge
                        variant={algo.status === "running" ? "default" : "secondary"}
                        className="text-[9px] px-1.5 py-0"
                      >
                        {algo.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{algo.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-sm font-mono font-semibold ${algo.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                      {algo.pnl >= 0 ? "+" : ""}₹{Math.abs(algo.pnl).toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{algo.trades} trades</p>
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    className="w-8 h-8"
                  >
                    {algo.status === "running" ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Algo;
