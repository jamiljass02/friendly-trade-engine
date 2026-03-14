import { useState, useCallback } from "react";
import { Play, AlertTriangle, X, Loader2, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBroker } from "@/hooks/useBroker";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { getInstrument, getDefaultSpotPrice } from "@/lib/instruments";
import { formatExpiryForSymbol } from "@/lib/expiry-utils";
import {
  getBrokerOrderId,
  getOrderFillPrice,
  isOrderComplete,
  isOrderFinal,
  normalizeOrderBook,
  roundToTick,
  waitForOrderFill,
} from "@/lib/broker-order-utils";

interface SelectedLeg {
  strike: number;
  type: "CE" | "PE";
  ltp: number;
  action: "BUY" | "SELL";
  tradingSymbol?: string;
}

type StrategyType = "straddle" | "strangle" | "iron_condor" | "custom";

interface StrategyExecutorProps {
  selectedLegs: SelectedLeg[];
  onRemoveLeg: (strike: number, type: "CE" | "PE") => void;
  onToggleAction: (strike: number, type: "CE" | "PE") => void;
  onClearAll: () => void;
  instrument: string;
  qty?: number;
  onQtyChange?: (qty: number) => void;
  expiryDate?: Date;
}

interface StopOrderWatch {
  stopOrderId: string;
  symbol: string;
  quantity: number;
  exchange: string;
  entryPrice: number;
}

const StrategyExecutor = ({
  selectedLegs,
  onRemoveLeg,
  onToggleAction,
  onClearAll,
  instrument,
  qty: externalQty,
  onQtyChange,
  expiryDate,
}: StrategyExecutorProps) => {
  const { isConnected, placeOrder, searchScrip, getOptionChain, getOrders, modifyOrder } = useBroker();
  const { toast } = useToast();
  const inst = getInstrument(instrument);
  const defaultLot = inst?.lotSize || 25;
  const tickSize = inst?.tickSize || 0.05;
  const [internalQty, setInternalQty] = useState(defaultLot);
  const qty = externalQty ?? internalQty;
  const setQty = onQtyChange ?? setInternalQty;
  const [executing, setExecuting] = useState(false);
  const [autoPlaceSL, setAutoPlaceSL] = useState(true);
  const [stopLossPct, setStopLossPct] = useState(30);
  const [moveToCostOnSlHit, setMoveToCostOnSlHit] = useState(true);

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
    strategyType === "straddle" ? "Straddle"
    : strategyType === "strangle" ? "Strangle"
    : strategyType === "iron_condor" ? "Iron Condor"
    : `Custom (${selectedLegs.length} legs)`;

  const netPremium = selectedLegs.reduce((sum, l) => {
    const val = l.ltp * qty;
    return l.action === "SELL" ? sum + val : sum - val;
  }, 0);

  const spotPrice = getDefaultSpotPrice(instrument);
  const marginRequired = Math.round(
    selectedLegs.filter((l) => l.action === "SELL").length * qty * spotPrice * 0.15
  );

  const buildTradingSymbol = useCallback((leg: SelectedLeg): string => {
    if (!expiryDate) {
      const now = new Date();
      const day = now.getDate();
      const month = now.toLocaleString("en", { month: "short" }).toUpperCase();
      const year = now.getFullYear().toString().slice(-2);
      return `${instrument}${String(day).padStart(2, "0")}${month}${year}${leg.type === "CE" ? "C" : "P"}${leg.strike}`;
    }
    const expiryStr = formatExpiryForSymbol(expiryDate);
    return `${instrument}${expiryStr}${leg.type === "CE" ? "C" : "P"}${leg.strike}`;
  }, [instrument, expiryDate]);

  const resolveTradingSymbol = useCallback(async (leg: SelectedLeg) => {
    if (leg.tradingSymbol) return leg.tradingSymbol;

    let tsym = buildTradingSymbol(leg);

    try {
      const chainResult = await getOptionChain(instrument, leg.strike, 12, inst?.exchange);
      const values = Array.isArray((chainResult as any)?.values)
        ? (chainResult as any).values
        : Array.isArray(chainResult)
          ? chainResult
          : [];

      const exactFromChain = values.find((row: any) => {
        const strike = Number(row.strprc ?? row.strike);
        const type = String(row.optt ?? "").toUpperCase();
        return strike === leg.strike && type === leg.type && row.tsym;
      });

      if (exactFromChain?.tsym) {
        return String(exactFromChain.tsym);
      }
    } catch {
      // fallback to search
    }

    try {
      const searchResult = await searchScrip(tsym, inst?.exchange || "NFO");
      const values = Array.isArray(searchResult?.values)
        ? searchResult.values
        : Array.isArray(searchResult)
          ? searchResult
          : [];

      if (values.length > 0) {
        const match = values.find((v: any) => {
          const strike = Number(v.strprc ?? v.strike);
          const type = String(v.optt ?? "").toUpperCase();
          if (Number.isFinite(strike) && type) {
            return strike === leg.strike && type === leg.type && v.tsym;
          }
          return v.tsym?.includes(String(leg.strike)) && v.tsym?.includes(leg.type === "CE" ? "C" : "P");
        });
        if (match?.tsym) tsym = match.tsym;
      }
    } catch {
      console.log("Search scrip failed, using constructed symbol:", tsym);
    }

    return tsym;
  }, [buildTradingSymbol, getOptionChain, instrument, searchScrip, inst?.exchange]);

  const monitorMoveToCost = useCallback(async (watchList: StopOrderWatch[]) => {
    if (watchList.length < 2) return;

    const active = new Map(watchList.map((item) => [item.stopOrderId, item]));

    for (let attempt = 0; attempt < 120 && active.size > 1; attempt++) {
      try {
        const ordersPayload = await getOrders();
        const orders = normalizeOrderBook(ordersPayload);

        let triggered: StopOrderWatch | null = null;

        for (const item of active.values()) {
          const order = orders.find((row) => {
            const candidate = row.norenordno ?? row.order_id ?? row.orderno ?? row.orderid;
            return candidate && String(candidate) === item.stopOrderId;
          });

          if (!order) continue;
          if (isOrderComplete(order)) {
            triggered = item;
            break;
          }
          if (isOrderFinal(order)) {
            active.delete(item.stopOrderId);
          }
        }

        if (triggered) {
          const siblings = Array.from(active.values()).filter((item) => item.stopOrderId !== triggered.stopOrderId);

          for (const sibling of siblings) {
            await modifyOrder({
              order_id: sibling.stopOrderId,
              tradingsymbol: sibling.symbol,
              quantity: sibling.quantity,
              trigger_price: roundToTick(sibling.entryPrice, tickSize),
              order_type: "SL-MKT",
              price: 0,
              exchange: sibling.exchange,
            });
          }

          toast({
            title: "Move to Cost Applied",
            description: "Remaining stop-loss orders moved to cost.",
          });
          return;
        }
      } catch {
        // continue polling
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }, [getOrders, modifyOrder, tickSize, toast]);

  const executeStrategy = useCallback(async () => {
    if (!isConnected || selectedLegs.length === 0 || !inst) return;
    if (!Number.isFinite(qty) || qty <= 0) {
      toast({ title: "Invalid Quantity", description: "Enter a valid quantity.", variant: "destructive" });
      return;
    }
    if (autoPlaceSL && (!Number.isFinite(stopLossPct) || stopLossPct <= 0)) {
      toast({ title: "Invalid Stop Loss", description: "Stop loss % should be greater than 0.", variant: "destructive" });
      return;
    }

    setExecuting(true);
    try {
      const results: string[] = [];
      const stopWatch: StopOrderWatch[] = [];

      for (const leg of selectedLegs) {
        const tsym = await resolveTradingSymbol(leg);

        const entryResult = await placeOrder({
          tradingsymbol: tsym,
          quantity: qty,
          price: 0,
          transaction_type: leg.action === "BUY" ? "B" : "S",
          order_type: "MKT",
          product: "M",
          exchange: inst.exchange,
        });

        const entryOrderId = getBrokerOrderId(entryResult);
        let entryPrice = leg.ltp;

        if (entryOrderId) {
          const fill = await waitForOrderFill({ orderId: entryOrderId, getOrders });
          if (fill.state === "rejected") {
            throw new Error(`Order rejected for ${tsym}.`);
          }
          if (fill.order) {
            entryPrice = getOrderFillPrice(fill.order, leg.ltp);
          }
        }

        results.push(`${leg.action} ${tsym}`);

        if (autoPlaceSL) {
          const stopTriggerRaw = leg.action === "SELL"
            ? entryPrice * (1 + stopLossPct / 100)
            : entryPrice * (1 - stopLossPct / 100);

          const stopTrigger = Math.max(tickSize, roundToTick(stopTriggerRaw, tickSize));

          const stopResult = await placeOrder({
            tradingsymbol: tsym,
            quantity: qty,
            price: 0,
            trigger_price: stopTrigger,
            transaction_type: leg.action === "BUY" ? "S" : "B",
            order_type: "SL-MKT",
            product: "M",
            exchange: inst.exchange,
          });

          const stopOrderId = getBrokerOrderId(stopResult);
          if (stopOrderId) {
            stopWatch.push({
              stopOrderId,
              symbol: tsym,
              quantity: qty,
              exchange: inst.exchange,
              entryPrice,
            });
          }
        }
      }

      if (moveToCostOnSlHit && autoPlaceSL && stopWatch.length > 1) {
        void monitorMoveToCost(stopWatch);
      }

      toast({
        title: "Strategy Executed ✓",
        description: autoPlaceSL
          ? `${strategyLabel} placed with broker-side SL orders.`
          : `${strategyLabel} placed: ${results.join(", ")}`,
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
  }, [
    isConnected,
    selectedLegs,
    inst,
    qty,
    autoPlaceSL,
    stopLossPct,
    moveToCostOnSlHit,
    resolveTradingSymbol,
    placeOrder,
    getOrders,
    monitorMoveToCost,
    strategyLabel,
    toast,
    onClearAll,
    tickSize,
  ]);

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
            {expiryDate && <span className="ml-1">· {expiryDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
          </p>
        </div>
        <button onClick={onClearAll} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
          Clear All
        </button>
      </div>

      <div className="p-4 space-y-2">
        {selectedLegs.map((leg) => (
          <div key={`${leg.strike}-${leg.type}`}
            className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30">
            <div className="flex items-center gap-2">
              <button onClick={() => onToggleAction(leg.strike, leg.type)}
                className={cn("text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1",
                  leg.action === "SELL" ? "bg-destructive/10 text-loss hover:bg-destructive/20" : "bg-success/10 text-profit hover:bg-success/20"
                )} title="Click to toggle BUY/SELL">
                <ArrowUpDown className="w-2.5 h-2.5" />
                {leg.action}
              </button>
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                leg.type === "CE" ? "bg-success/10 text-profit" : "bg-destructive/10 text-loss"
              )}>{leg.type}</span>
              <span className="font-mono text-sm font-semibold text-foreground">{leg.strike}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-foreground">₹{leg.ltp.toFixed(2)}</span>
              <button onClick={() => onRemoveLeg(leg.strike, leg.type)}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 pb-3">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Quantity (Lot: {defaultLot})
        </label>
        <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))}
          step={defaultLot} min={defaultLot}
          className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-mono" />
      </div>

      <div className="px-5 pb-4 space-y-2">
        <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 bg-secondary/20">
          <label className="text-[11px] font-medium text-foreground">Place broker-side SL</label>
          <Checkbox
            checked={autoPlaceSL}
            onCheckedChange={(checked) => setAutoPlaceSL(checked === true)}
          />
        </div>

        {autoPlaceSL && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">SL %</label>
              <input
                type="number"
                min={1}
                max={500}
                value={stopLossPct}
                onChange={(e) => setStopLossPct(Number(e.target.value))}
                className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
            <div className="flex items-end">
              <div className="flex items-center justify-between w-full rounded-md border border-border/40 px-3 py-2 bg-secondary/20">
                <label className="text-[11px] text-foreground">Move SL to cost</label>
                <Checkbox
                  checked={moveToCostOnSlHit}
                  onCheckedChange={(checked) => setMoveToCostOnSlHit(checked === true)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-border/50 bg-secondary/20">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Net Premium</p>
            <p className={cn("text-sm font-mono font-semibold mt-1", netPremium >= 0 ? "text-profit" : "text-loss")}>
              {netPremium >= 0 ? "+" : ""}₹{Math.abs(netPremium).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">
                {netPremium >= 0 ? "credit" : "debit"}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Margin (est.)</p>
            <p className="text-sm font-mono font-semibold text-foreground mt-1">
              ₹{marginRequired.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-border/50">
        {!isConnected ? (
          <div className="flex items-center gap-2 text-xs text-warning">
            <AlertTriangle className="w-4 h-4" />
            Connect broker to execute
          </div>
        ) : (
          <button onClick={executeStrategy} disabled={executing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors glow-primary disabled:opacity-50">
            {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {executing ? "Executing..." : "Execute Strategy"}
          </button>
        )}
      </div>
    </div>
  );
};

export default StrategyExecutor;
