import { useState, useCallback } from "react";
import { Play, AlertTriangle, X, Loader2, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBroker } from "@/hooks/useBroker";
import { useToast } from "@/hooks/use-toast";
import { getInstrument, getDefaultSpotPrice } from "@/lib/instruments";

interface SelectedLeg {
  strike: number;
  type: "CE" | "PE";
  ltp: number;
  action: "BUY" | "SELL";
}

type StrategyType = "straddle" | "strangle" | "iron_condor" | "custom";

interface StrategyExecutorProps {
  selectedLegs: SelectedLeg[];
  onRemoveLeg: (strike: number, type: "CE" | "PE") => void;
  onToggleAction: (strike: number, type: "CE" | "PE") => void;
  onClearAll: () => void;
  instrument: string;
}

const StrategyExecutor = ({
  selectedLegs,
  onRemoveLeg,
  onToggleAction,
  onClearAll,
  instrument,
}: StrategyExecutorProps) => {
  const { isConnected, placeOrder } = useBroker();
  const { toast } = useToast();
  const inst = getInstrument(instrument);
  const defaultLot = inst?.lotSize || 25;
  const [qty, setQty] = useState(defaultLot);
  const [executing, setExecuting] = useState(false);

  const strategyType: StrategyType = (() => {
    if (selectedLegs.length !== 2) {
      if (selectedLegs.length === 4) {
        const buyCE = selectedLegs.filter((l) => l.type === "CE" && l.action === "BUY");
        const sellCE = selectedLegs.filter((l) => l.type === "CE" && l.action === "SELL");
        const buyPE = selectedLegs.filter((l) => l.type === "PE" && l.action === "BUY");
        const sellPE = selectedLegs.filter((l) => l.type === "PE" && l.action === "SELL");
        if (buyCE.length === 1 && sellCE.length === 1 && buyPE.length === 1 && sellPE.length === 1) {
          return "iron_condor";
        }
      }
      return "custom";
    }
    const hasCE = selectedLegs.some((l) => l.type === "CE");
    const hasPE = selectedLegs.some((l) => l.type === "PE");
    if (!hasCE || !hasPE) return "custom";
    const ceStrike = selectedLegs.find((l) => l.type === "CE")!.strike;
    const peStrike = selectedLegs.find((l) => l.type === "PE")!.strike;
    return ceStrike === peStrike ? "straddle" : "strangle";
  })();

  const strategyLabel =
    strategyType === "straddle"
      ? "Straddle"
      : strategyType === "strangle"
      ? "Strangle"
      : strategyType === "iron_condor"
      ? "Iron Condor"
      : `Custom (${selectedLegs.length} legs)`;

  const netPremium = selectedLegs.reduce((sum, l) => {
    const val = l.ltp * qty;
    return l.action === "SELL" ? sum + val : sum - val;
  }, 0);

  const spotPrice = getDefaultSpotPrice(instrument);
  const marginRequired = Math.round(
    selectedLegs.filter((l) => l.action === "SELL").length * qty * spotPrice * 0.15
  );

  const executeStrategy = useCallback(async () => {
    if (!isConnected || selectedLegs.length === 0) return;

    setExecuting(true);
    try {
      for (const leg of selectedLegs) {
        const tsym = `${instrument}27FEB26${leg.type === "CE" ? "C" : "P"}${leg.strike}`;
        await placeOrder({
          tradingsymbol: tsym,
          quantity: qty,
          price: leg.ltp,
          transaction_type: leg.action === "BUY" ? "B" : "S",
          order_type: "MKT",
          product: "M",
          exchange: inst?.exchange || "NFO",
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
  }, [isConnected, selectedLegs, qty, instrument, inst, placeOrder, toast, onClearAll, strategyLabel]);

  if (selectedLegs.length === 0) {
    return (
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2">Strategy Builder</h3>
        <p className="text-xs text-muted-foreground">
          Click on Call/Put LTP values in the options chain to select strikes. Toggle BUY/SELL per leg.
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
            {selectedLegs.length} leg{selectedLegs.length > 1 ? "s" : ""} · {instrument}
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleAction(leg.strike, leg.type)}
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1",
                  leg.action === "SELL"
                    ? "bg-destructive/10 text-loss hover:bg-destructive/20"
                    : "bg-success/10 text-profit hover:bg-success/20"
                )}
                title="Click to toggle BUY/SELL"
              >
                <ArrowUpDown className="w-2.5 h-2.5" />
                {leg.action}
              </button>
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
                {leg.strike}
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
          Quantity (Lot: {defaultLot})
        </label>
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          step={defaultLot}
          min={defaultLot}
          className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-mono"
        />
      </div>

      {/* Summary */}
      <div className="px-5 py-4 border-t border-border/50 bg-secondary/20">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Net Premium
            </p>
            <p className={cn(
              "text-sm font-mono font-semibold mt-1",
              netPremium >= 0 ? "text-profit" : "text-loss"
            )}>
              {netPremium >= 0 ? "+" : ""}₹{Math.abs(netPremium).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">
                {netPremium >= 0 ? "credit" : "debit"}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Margin (est.)
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
