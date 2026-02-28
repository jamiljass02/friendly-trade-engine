import { useState } from "react";
import { X, AlertTriangle, ArrowRightLeft, RotateCcw, Shield, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBroker } from "@/hooks/useBroker";
import { useToast } from "@/hooks/use-toast";
import type { Position } from "@/hooks/usePositions";

type ActionType = "square-off" | "stop-loss" | "convert-spread" | "rollover" | "history";

interface PositionActionsDialogProps {
  position: Position | null;
  action: ActionType | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PositionActionsDialog = ({ position, action, onClose, onSuccess }: PositionActionsDialogProps) => {
  const { isConnected, placeOrder } = useBroker();
  const { toast } = useToast();
  const [executing, setExecuting] = useState(false);
  const [slPrice, setSlPrice] = useState("");
  const [slType, setSlType] = useState<"absolute" | "percent">("percent");
  const [hedgeStrike, setHedgeStrike] = useState("");

  if (!position || !action) return null;

  const handleSquareOff = async () => {
    setExecuting(true);
    try {
      if (!isConnected) {
        // Mock execution
        await new Promise((r) => setTimeout(r, 800));
        toast({ title: "Square Off Executed", description: `${position.symbol} × ${position.qty} closed at market.` });
      } else {
        await placeOrder({
          tradingsymbol: position.symbol,
          quantity: position.qty,
          transaction_type: position.side === "BUY" ? "S" : "B",
          order_type: "MKT",
        });
        toast({ title: "Square Off Placed", description: `Market order for ${position.symbol}` });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  };

  const handleStopLoss = async () => {
    if (!slPrice) return;
    setExecuting(true);
    try {
      const triggerPrice = slType === "percent"
        ? position.ltp * (1 - parseFloat(slPrice) / 100 * (position.side === "BUY" ? 1 : -1))
        : parseFloat(slPrice);

      if (!isConnected) {
        await new Promise((r) => setTimeout(r, 600));
        toast({ title: "Stop Loss Set", description: `SL at ₹${triggerPrice.toFixed(2)} for ${position.symbol}` });
      } else {
        await placeOrder({
          tradingsymbol: position.symbol,
          quantity: position.qty,
          transaction_type: position.side === "BUY" ? "S" : "B",
          order_type: "SL-MKT",
          trigger_price: triggerPrice,
        });
        toast({ title: "Stop Loss Placed", description: `SL-MKT at ₹${triggerPrice.toFixed(2)}` });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  };

  const handleConvertSpread = async () => {
    if (!hedgeStrike) return;
    setExecuting(true);
    try {
      const hedgeSymbol = position.symbol.replace(/\d+(CE|PE)$/, `${hedgeStrike}$1`);
      const hedgeSide = position.side === "SELL" ? "B" : "S";

      if (!isConnected) {
        await new Promise((r) => setTimeout(r, 600));
        toast({ title: "Hedge Added", description: `${hedgeSide === "B" ? "Bought" : "Sold"} ${hedgeSymbol} × ${position.qty}` });
      } else {
        await placeOrder({
          tradingsymbol: hedgeSymbol,
          quantity: position.qty,
          transaction_type: hedgeSide,
          order_type: "MKT",
        });
        toast({ title: "Spread Created", description: `Hedging leg added: ${hedgeSymbol}` });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  };

  const handleRollover = async () => {
    setExecuting(true);
    try {
      if (!isConnected) {
        await new Promise((r) => setTimeout(r, 1000));
        toast({ title: "Rollover Initiated", description: `${position.symbol} rolling to next expiry.` });
      } else {
        // Close current
        await placeOrder({
          tradingsymbol: position.symbol,
          quantity: position.qty,
          transaction_type: position.side === "BUY" ? "S" : "B",
          order_type: "MKT",
        });
        // Derive next expiry symbol (simplified)
        const nextSymbol = position.symbol.replace(/(\d{2})([A-Z]{3})(\d{2})/, (_, d, m, y) => {
          const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
          const mi = months.indexOf(m);
          const nm = mi < 11 ? months[mi + 1] : months[0];
          const ny = mi < 11 ? y : String(parseInt(y) + 1).padStart(2, "0");
          return `${d}${nm}${ny}`;
        });
        await placeOrder({
          tradingsymbol: nextSymbol,
          quantity: position.qty,
          transaction_type: position.side === "BUY" ? "B" : "S",
          order_type: "MKT",
        });
        toast({ title: "Rollover Complete", description: `Rolled to ${nextSymbol}` });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  };

  const titles: Record<ActionType, { icon: typeof X; label: string; color: string }> = {
    "square-off": { icon: X, label: "Square Off Position", color: "text-loss" },
    "stop-loss": { icon: Shield, label: "Add Stop Loss", color: "text-warning" },
    "convert-spread": { icon: ArrowRightLeft, label: "Convert to Spread", color: "text-primary" },
    rollover: { icon: RotateCcw, label: "Rollover to Next Expiry", color: "text-accent-foreground" },
    history: { icon: History, label: "Position History", color: "text-foreground" },
  };

  const { icon: Icon, label, color } = titles[action];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card rounded-2xl w-full max-w-md mx-4 overflow-hidden border border-border/50">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn("p-1.5 rounded-lg bg-secondary/50", color)}>
              <Icon className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Position Info */}
        <div className="px-5 py-3 bg-secondary/20 flex items-center justify-between">
          <div>
            <span className="font-mono text-xs font-semibold text-foreground">{position.symbol}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded",
                position.type === "CE" ? "bg-success/10 text-profit" : position.type === "PE" ? "bg-destructive/10 text-loss" : "bg-muted text-muted-foreground"
              )}>{position.type}</span>
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded",
                position.side === "BUY" ? "bg-success/10 text-profit" : "bg-destructive/10 text-loss"
              )}>{position.side} × {position.qty}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-muted-foreground">LTP</p>
            <p className="font-mono text-sm font-bold text-foreground">₹{position.ltp.toFixed(2)}</p>
            <p className={cn("text-[10px] font-mono", position.pnl >= 0 ? "text-profit" : "text-loss")}>
              {position.pnl >= 0 ? "+" : ""}₹{Math.abs(position.pnl).toFixed(0)}
            </p>
          </div>
        </div>

        {/* Action Body */}
        <div className="px-5 py-4 space-y-4">
          {action === "square-off" && (
            <>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertTriangle className="w-4 h-4 text-loss mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Confirm Square Off</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    This will place a market order to close your {position.side === "BUY" ? "long" : "short"} position of {position.qty} units.
                  </p>
                </div>
              </div>
              <button
                onClick={handleSquareOff}
                disabled={executing}
                className="w-full py-2.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {executing ? "Executing..." : `Square Off at Market`}
              </button>
            </>
          )}

          {action === "stop-loss" && (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                    {(["percent", "absolute"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setSlType(t)}
                        className={cn("px-3 py-1 rounded-md text-[10px] font-medium transition-colors capitalize",
                          slType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                        )}
                      >{t}</button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={slPrice}
                    onChange={(e) => setSlPrice(e.target.value)}
                    placeholder={slType === "percent" ? "e.g., 20" : "e.g., 150.00"}
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border/50 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                    {slType === "percent" ? "%" : "₹"}
                  </span>
                </div>
                {slPrice && (
                  <p className="text-[10px] text-muted-foreground">
                    Trigger at: ₹{(slType === "percent"
                      ? position.ltp * (1 - parseFloat(slPrice) / 100 * (position.side === "BUY" ? 1 : -1))
                      : parseFloat(slPrice)
                    ).toFixed(2)}
                  </p>
                )}
              </div>
              <button
                onClick={handleStopLoss}
                disabled={executing || !slPrice}
                className="w-full py-2.5 rounded-lg bg-warning text-warning-foreground text-xs font-semibold hover:bg-warning/90 transition-colors disabled:opacity-50"
              >
                {executing ? "Placing..." : "Place Stop Loss"}
              </button>
            </>
          )}

          {action === "convert-spread" && (
            <>
              <div className="space-y-3">
                <p className="text-[10px] text-muted-foreground">
                  Add a hedging leg to convert this naked {position.type} into a {position.side === "SELL" ? "credit" : "debit"} spread.
                </p>
                <div className="relative">
                  <input
                    type="number"
                    value={hedgeStrike}
                    onChange={(e) => setHedgeStrike(e.target.value)}
                    placeholder="Hedge strike price"
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border/50 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                {hedgeStrike && (
                  <div className="p-2.5 rounded-lg bg-secondary/30 text-[10px] text-muted-foreground space-y-1">
                    <p>Hedge: <span className="text-foreground font-mono">{position.side === "SELL" ? "BUY" : "SELL"} {position.type} {hedgeStrike}</span></p>
                    <p>Qty: <span className="text-foreground font-mono">{position.qty}</span></p>
                    <p>Result: <span className="text-foreground">{position.side === "SELL" ? "Credit" : "Debit"} {position.type === "CE" ? "Call" : "Put"} Spread</span></p>
                  </div>
                )}
              </div>
              <button
                onClick={handleConvertSpread}
                disabled={executing || !hedgeStrike}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {executing ? "Placing..." : "Add Hedging Leg"}
              </button>
            </>
          )}

          {action === "rollover" && (
            <>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <RotateCcw className="w-4 h-4 text-accent-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Rollover Confirmation</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    This will close your current position and open the same position in the next monthly expiry at market price.
                  </p>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-secondary/30 text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Close</span>
                  <span className="text-foreground font-mono">{position.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Open</span>
                  <span className="text-foreground font-mono">Next expiry (same strike)</span>
                </div>
              </div>
              <button
                onClick={handleRollover}
                disabled={executing}
                className="w-full py-2.5 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {executing ? "Rolling..." : "Confirm Rollover"}
              </button>
            </>
          )}

          {action === "history" && (
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground">Recent activity for this instrument</p>
              {[
                { time: "09:15", action: "Opened", price: position.avgPrice, qty: position.qty },
                { time: "10:32", action: "Modified SL", price: position.avgPrice * 0.8, qty: 0 },
                { time: "11:45", action: "Partial Exit", price: position.ltp * 1.02, qty: Math.floor(position.qty / 3) },
              ].map((entry, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-muted-foreground">{entry.time}</span>
                    <span className="text-[10px] font-medium text-foreground">{entry.action}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-foreground">₹{entry.price.toFixed(2)}</span>
                    {entry.qty > 0 && <span className="text-[9px] text-muted-foreground ml-2">×{entry.qty}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PositionActionsDialog;
