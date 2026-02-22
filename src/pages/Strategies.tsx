import AppLayout from "@/components/AppLayout";
import StrategyBuilder from "@/components/StrategyBuilder";
import { Plus } from "lucide-react";

const strategies = [
  { name: "Bull Call Spread", instrument: "NIFTY", status: "Active", pnl: 2450, legs: 2 },
  { name: "Iron Condor", instrument: "BANKNIFTY", status: "Active", pnl: -680, legs: 4 },
  { name: "Straddle Sell", instrument: "NIFTY", status: "Paused", pnl: 1820, legs: 2 },
];

const Strategies = () => {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Strategies</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Create and manage your trading strategies</p>
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors glow-primary">
            <Plus className="w-3.5 h-3.5" />
            New Strategy
          </button>
        </div>

        {/* Saved Strategies */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {strategies.map((s) => (
            <div key={s.name} className="glass-card rounded-xl p-5 hover:border-primary/30 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">{s.name}</h3>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  s.status === "Active" ? "bg-success/10 text-profit" : "bg-muted text-muted-foreground"
                }`}>
                  {s.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{s.instrument} • {s.legs} legs</p>
              <p className={`text-lg font-mono font-bold mt-2 ${s.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                {s.pnl >= 0 ? "+" : ""}₹{s.pnl.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Strategy Builder */}
        <StrategyBuilder />
      </div>
    </AppLayout>
  );
};

export default Strategies;
