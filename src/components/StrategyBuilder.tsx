import { useState } from "react";
import { Plus, Trash2, Play, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategyLeg {
  id: number;
  instrument: string;
  type: "CE" | "PE";
  strike: number;
  side: "BUY" | "SELL";
  qty: number;
  expiry: string;
}

const defaultLeg: Omit<StrategyLeg, "id"> = {
  instrument: "NIFTY",
  type: "CE",
  strike: 24200,
  side: "BUY",
  qty: 50,
  expiry: "27 Feb 2025",
};

const StrategyBuilder = () => {
  const [legs, setLegs] = useState<StrategyLeg[]>([
    { ...defaultLeg, id: 1 },
    { ...defaultLeg, id: 2, type: "PE", side: "SELL", strike: 24000 },
  ]);
  const [strategyName, setStrategyName] = useState("Bull Call Spread");

  const addLeg = () => {
    setLegs([...legs, { ...defaultLeg, id: Date.now() }]);
  };

  const removeLeg = (id: number) => {
    setLegs(legs.filter((l) => l.id !== id));
  };

  const updateLeg = (id: number, field: keyof StrategyLeg, value: string | number) => {
    setLegs(legs.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
        <div>
          <input
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            className="text-sm font-semibold text-foreground bg-transparent border-none outline-none focus:ring-0 p-0"
          />
          <p className="text-xs text-muted-foreground mt-0.5">{legs.length} legs configured</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
            <Save className="w-3 h-3" />
            Save
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors glow-primary">
            <Play className="w-3 h-3" />
            Deploy
          </button>
        </div>
      </div>

      <div className="p-5 space-y-3">
        {legs.map((leg, index) => (
          <div
            key={leg.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30 animate-slide-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className="text-[10px] text-muted-foreground font-mono w-6">L{index + 1}</span>

            <select
              value={leg.instrument}
              onChange={(e) => updateLeg(leg.id, "instrument", e.target.value)}
              className="bg-muted text-foreground text-xs px-2.5 py-1.5 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary"
            >
              <option>NIFTY</option>
              <option>BANKNIFTY</option>
              <option>FINNIFTY</option>
            </select>

            <button
              onClick={() => updateLeg(leg.id, "type", leg.type === "CE" ? "PE" : "CE")}
              className={cn(
                "text-xs px-2.5 py-1.5 rounded-md border border-border/50 outline-none font-semibold cursor-pointer transition-colors",
                leg.type === "CE" ? "bg-success/10 text-profit border-success/30" : "bg-destructive/10 text-loss border-destructive/30"
              )}
            >
              {leg.type}
            </button>

            <input
              type="number"
              value={leg.strike}
              onChange={(e) => updateLeg(leg.id, "strike", Number(e.target.value))}
              className="bg-muted text-foreground text-xs px-2.5 py-1.5 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-mono w-24"
            />

            <select
              value={leg.side}
              onChange={(e) => updateLeg(leg.id, "side", e.target.value)}
              className={cn(
                "text-xs px-2.5 py-1.5 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-bold",
                leg.side === "BUY" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
              )}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>

            <input
              type="number"
              value={leg.qty}
              onChange={(e) => updateLeg(leg.id, "qty", Number(e.target.value))}
              className="bg-muted text-foreground text-xs px-2.5 py-1.5 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-mono w-20"
            />

            <button
              onClick={() => removeLeg(leg.id)}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        <button
          onClick={addLeg}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-border/50 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Leg
        </button>
      </div>

      {/* Strategy Summary */}
      <div className="px-5 py-4 border-t border-border/50 bg-secondary/20">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Max Profit</p>
            <p className="text-sm font-mono font-semibold text-profit mt-1">₹12,500</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Max Loss</p>
            <p className="text-sm font-mono font-semibold text-loss mt-1">₹7,500</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Breakeven</p>
            <p className="text-sm font-mono font-semibold text-foreground mt-1">24,185</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Risk/Reward</p>
            <p className="text-sm font-mono font-semibold text-primary mt-1">1:1.67</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyBuilder;
