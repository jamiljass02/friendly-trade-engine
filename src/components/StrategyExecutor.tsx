import { useState, useCallback } from "react";
import { Play, AlertTriangle, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBroker } from "@/hooks/useBroker";
import { useToast } from "@/hooks/use-toast";

interface SelectedLeg {
  strike: number;
  type: "CE" | "PE";
  ltp: number;
}

type StrategyType = "straddle" | "strangle" | "custom";

interface StrategyExecutorProps {
  selectedLegs: SelectedLeg[];
  onRemoveLeg: (strike: number, type: "CE" | "PE") => void;
  onClearAll: () => void;
  instrument: string;
}

const StrategyExecutor = ({
  selectedLegs,
  onRemoveLeg,
  onClearAll,
  instrument,
}: StrategyExecutorProps) => {
  const { isConnected, placeOrder } = useBroker();
  const { toast } = useToast();
  const [qty, setQty] = useState(instrument === "NIFTY" ? 50 : 15);
  const [executing, setExecuting] = useState(false);

  const strategyType: StrategyType = (() => {
    if (selectedLegs.length !== 2) return "custom";
    const hasCE = selectedLegs.some((l) => l.type === "CE");
    const hasPE = selectedLegs.some((l) => l.type === "PE");
    if (!hasCE || !hasPE) return "custom";
    const ceStrike = selectedLegs.find((l) => l.type === "CE")!.strike;
    const peStrike = selectedLegs.find((l) => l.type === "PE")!.strike;
    return ceStrike === peStrike ? "straddle" : "strangle";
  })();

  const strategyLabel =
    strategyType === "straddle"
      ? "Short Straddle"
      : strategyType === "strangle"
      ? "Short Strangle"
      : `Custom (${selectedLegs.length} legs)`;

  const totalPremium = selectedLegs.reduce((sum, l) => sum + l.ltp * qty, 0);

  // Approximate margin (rough estimate: 15% of notional for short options)
  const notional =
    instrument === "NIFTY"
      ? selectedLegs.length * qty * 24150 * 0.15
      : selectedLegs.length * qty * 51500 * 0.15;
  const marginRequired = Math.round(notional);

  const executeStrategy = useCallback(async () => {
    if (!isConnected || selectedLegs.length === 0) return;

    setExecuting(true);
    try {
      for (const leg of selectedLegs) {
        // Build expiry string for tradingsymbol
        // For now, use simplified symbol - actual formatting depends on broker conventions
        const tsym = `${instrument}27FEB26${leg.type === "CE" ? "C" : "P"}${leg.strike}`;

        await placeOrder({
          tradingsymbol: tsym,
          quantity: qty,
          price: leg.ltp,
          transaction_type: "S", // Short (sell) for straddle/strangle
          order_type: "MKT",
          product: "M",
          exchange: "NFO",
        });
      }

      toast({
        title: "Strategy Executed",
        description: `${strategyLabel} placed successfully with ${selectedLegs.length} legs`,
      });
      onClearAll();
    } catch (err: any) {
      toast({
        title: "Execution Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  }, [isConnected, selectedLegs, qty, instrument, placeOrder, toast, onClearAll, strategyLabel]);

  if (selectedLegs.length === 0) {
    return (
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2">Strategy Builder</h3>
        <p className="text-xs text-muted-foreground">
          Click on Call/Put LTP values in the options chain to select strikes for your strategy.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{strategyLabel}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedLegs.length} leg{selectedLegs.length > 1 ? "s" : ""} selected
          </p>
        </div>
        <button
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Legs */}
      <div className="p-4 space-y-2">
        {selectedLegs.map((leg) => (
          <div
            key={`${leg.strike}-${leg.type}`}
            className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30"
          >
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-warning bg-warning/10 px-2 py-0.5 rounded">
                SELL
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded",
                  leg.type === "CE"
                    ? "bg-success/10 text-profit"
                    : "bg-destructive/10 text-loss"
                )}
              >
                {leg.type}
              </span>
              <span className="font-mono text-sm font-semibold text-foreground">
                {instrument} {leg.strike}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-foreground">
                ₹{leg.ltp.toFixed(2)}
              </span>
              <button
                onClick={() => onRemoveLeg(leg.strike, leg.type)}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quantity */}
      <div className="px-5 pb-3">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Lot Size
        </label>
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-mono"
        />
      </div>

      {/* Summary */}
      <div className="px-5 py-4 border-t border-border/50 bg-secondary/20">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Premium Collected
            </p>
            <p className="text-sm font-mono font-semibold text-profit mt-1">
              ₹{totalPremium.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Margin Required (est.)
            </p>
            <p className="text-sm font-mono font-semibold text-foreground mt-1">
              ₹{marginRequired.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      {/* Execute */}
      <div className="px-5 py-4 border-t border-border/50">
        {!isConnected ? (
          <div className="flex items-center gap-2 text-xs text-warning">
            <AlertTriangle className="w-4 h-4" />
            Connect broker to execute
          </div>
        ) : (
          <button
            onClick={executeStrategy}
            disabled={executing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors glow-primary disabled:opacity-50"
          >
            {executing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {executing ? "Executing..." : "Execute Strategy"}
          </button>
        )}
      </div>
    </div>
  );
};

export default StrategyExecutor;
