import { useState, useMemo, useCallback } from "react";
import {
  Plus,
  Trash2,
  Play,
  Save,
  ArrowUpDown,
  AlertTriangle,
  TrendingUp,
  Search,
  X,
  ChevronDown,
  Loader2,
  Shield,
  Target,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INDEX_INSTRUMENTS,
  FNO_STOCKS,
  getInstrument,
  getDefaultSpotPrice,
  type Instrument,
} from "@/lib/instruments";
import { getUpcomingExpiries, type ExpiryDate } from "@/lib/expiry-utils";
import PayoffChart from "./PayoffChart";
import StrategyTemplates from "./StrategyTemplates";
import { useBroker } from "@/hooks/useBroker";
import { useToast } from "@/hooks/use-toast";

export interface StrategyLeg {
  id: string;
  underlying: string;
  instrumentType: "index_option" | "stock_option" | "index_future" | "stock_future";
  action: "BUY" | "SELL";
  optionType?: "CE" | "PE";
  futureType?: "near" | "mid" | "far";
  strike?: number;
  expiry: string;
  lots: number;
  entryType: "MKT" | "LMT";
  limitPrice?: number;
  validity: "DAY" | "IOC";
  ltp: number;
}

type InstrumentFilter = "all" | "index" | "stock";

// Black-Scholes Greeks approximation
function calcGreeks(
  spot: number,
  strike: number,
  iv: number,
  daysToExpiry: number,
  isCall: boolean
) {
  if (iv <= 0 || daysToExpiry <= 0 || spot <= 0)
    return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  const T = daysToExpiry / 365;
  const sigma = iv / 100;
  const r = 0.07;
  const sqrtT = Math.sqrt(T);
  const d1 =
    (Math.log(spot / strike) + (r + (sigma * sigma) / 2) * T) /
    (sigma * sqrtT);
  const cdf = (x: number) => {
    const a1 = 0.254829592,
      a2 = -0.284496736,
      a3 = 1.421413741,
      a4 = -1.453152027,
      a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + p * ax);
    const y =
      1 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
        t *
        Math.exp(-ax * ax);
    return 0.5 * (1 + sign * y);
  };
  const pdf = (x: number) =>
    (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
  const Nd1 = cdf(d1);
  const d2 = d1 - sigma * sqrtT;
  const delta = isCall ? Nd1 : Nd1 - 1;
  const gamma = pdf(d1) / (spot * sigma * sqrtT);
  const theta =
    (-(spot * pdf(d1) * sigma) / (2 * sqrtT) -
      r *
        strike *
        Math.exp(-r * T) *
        cdf(isCall ? d2 : -d2) *
        (isCall ? 1 : -1)) /
    365;
  const vega = (spot * sqrtT * pdf(d1)) / 100;
  return { delta, gamma, theta, vega };
}

const EnhancedStrategyBuilder = () => {
  const { isConnected, placeOrder } = useBroker();
  const { toast } = useToast();
  const [legs, setLegs] = useState<StrategyLeg[]>([]);
  const [strategyName, setStrategyName] = useState("Custom Strategy");
  const [instrumentFilter, setInstrumentFilter] = useState<InstrumentFilter>("all");
  const [stockSearch, setStockSearch] = useState("");
  const [showStockSearch, setShowStockSearch] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [executing, setExecuting] = useState(false);

  // For payoff chart, derive simplified legs
  const payoffLegs = useMemo(
    () =>
      legs
        .filter((l) => l.instrumentType.includes("option") && l.strike)
        .map((l) => ({
          strike: l.strike!,
          type: l.optionType || ("CE" as "CE" | "PE"),
          ltp: l.ltp,
          action: l.action,
        })),
    [legs]
  );

  const primaryInstrument = legs[0]?.underlying || "NIFTY";
  const primaryInst = getInstrument(primaryInstrument);
  const primaryLotSize = primaryInst?.lotSize || 25;

  const filteredStocks = useMemo(() => {
    if (!stockSearch) return FNO_STOCKS.slice(0, 12);
    const q = stockSearch.toLowerCase();
    return FNO_STOCKS.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.industry?.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [stockSearch]);

  const addLeg = useCallback(
    (underlying = "NIFTY", type: "index_option" | "stock_option" | "index_future" | "stock_future" = "index_option") => {
      const inst = getInstrument(underlying);
      const spot = getDefaultSpotPrice(underlying);
      const step = inst?.strikeStep || 50;
      const isWeekly = inst?.type === "index" ? (inst as any).weeklyExpiry : false;
      const expiries = getUpcomingExpiries(isWeekly, 4);
      const atmStrike = Math.round(spot / step) * step;
      const isFuture = type.includes("future");
      const mockLTP = isFuture ? spot : 50 + Math.random() * 100;

      const newLeg: StrategyLeg = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        underlying,
        instrumentType: type,
        action: "SELL",
        optionType: isFuture ? undefined : "CE",
        futureType: isFuture ? "near" : undefined,
        strike: isFuture ? undefined : atmStrike,
        expiry: expiries[0]?.label || "",
        lots: 1,
        entryType: "MKT",
        validity: "DAY",
        ltp: Math.round(mockLTP * 100) / 100,
      };
      setLegs((prev) => [...prev, newLeg]);
    },
    []
  );

  const removeLeg = useCallback((id: string) => {
    setLegs((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const updateLeg = useCallback(
    (id: string, updates: Partial<StrategyLeg>) => {
      setLegs((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const updated = { ...l, ...updates };
          // Recalc LTP if strike/underlying changes
          if (updates.underlying || updates.strike) {
            const spot = getDefaultSpotPrice(updated.underlying);
            if (updated.instrumentType.includes("future")) {
              updated.ltp = spot;
            } else if (updated.strike) {
              const intrinsic =
                updated.optionType === "CE"
                  ? Math.max(0, spot - updated.strike)
                  : Math.max(0, updated.strike - spot);
              updated.ltp =
                Math.round((intrinsic + 20 + Math.random() * 40) * 100) / 100;
            }
          }
          return updated;
        })
      );
    },
    []
  );

  const applyTemplate = useCallback(
    (templateLegs: Omit<StrategyLeg, "id">[]) => {
      setLegs(
        templateLegs.map((l) => ({
          ...l,
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        }))
      );
      setShowTemplates(false);
    },
    []
  );

  // Combined Greeks
  const combinedGreeks = useMemo(() => {
    let delta = 0,
      gamma = 0,
      theta = 0,
      vega = 0;
    for (const leg of legs) {
      if (!leg.instrumentType.includes("option") || !leg.strike) continue;
      const spot = getDefaultSpotPrice(leg.underlying);
      const inst = getInstrument(leg.underlying);
      const lotSize = inst?.lotSize || 25;
      const iv = 15 + Math.random() * 5; // Mock IV
      const greeks = calcGreeks(
        spot,
        leg.strike,
        iv,
        5,
        leg.optionType === "CE"
      );
      const multiplier =
        leg.action === "BUY" ? leg.lots * lotSize : -leg.lots * lotSize;
      delta += greeks.delta * multiplier;
      gamma += greeks.gamma * multiplier;
      theta += greeks.theta * multiplier;
      vega += greeks.vega * multiplier;
    }
    return {
      delta: Math.round(delta * 100) / 100,
      gamma: Math.round(gamma * 100) / 100,
      theta: Math.round(theta * 100) / 100,
      vega: Math.round(vega * 100) / 100,
    };
  }, [legs]);

  // Net premium & margin
  const { netPremium, marginRequired, hasUnlimitedRisk } = useMemo(() => {
    let net = 0;
    let margin = 0;
    let nakedSells = 0;

    for (const leg of legs) {
      const inst = getInstrument(leg.underlying);
      const lotSize = inst?.lotSize || 25;
      const spot = getDefaultSpotPrice(leg.underlying);
      const totalQty = leg.lots * lotSize;

      if (leg.instrumentType.includes("option")) {
        const val = leg.ltp * totalQty;
        net += leg.action === "SELL" ? val : -val;
        if (leg.action === "SELL") {
          margin += totalQty * spot * 0.15;
          nakedSells++;
        }
      } else {
        // Futures
        margin += totalQty * spot * 0.12;
        if (leg.action === "SELL") nakedSells++;
      }
    }

    // Check if sells are covered
    const sellLegs = legs.filter((l) => l.action === "SELL");
    const buyLegs = legs.filter((l) => l.action === "BUY");
    const unlimited =
      sellLegs.length > 0 &&
      sellLegs.some(
        (s) =>
          !buyLegs.some(
            (b) =>
              b.underlying === s.underlying && b.optionType === s.optionType
          )
      );

    return {
      netPremium: Math.round(net),
      marginRequired: Math.round(margin),
      hasUnlimitedRisk: unlimited,
    };
  }, [legs]);

  // Strategy detection
  const detectedStrategy = useMemo(() => {
    if (legs.length === 0) return "";
    if (legs.length === 1) {
      const l = legs[0];
      if (l.instrumentType.includes("future"))
        return l.action === "BUY" ? "Long Future" : "Short Future";
      return `${l.action === "BUY" ? "Long" : "Short"} ${l.optionType}`;
    }
    if (legs.length === 2) {
      const [a, b] = legs;
      if (a.optionType === "CE" && b.optionType === "PE") {
        if (a.strike === b.strike) {
          return a.action === b.action
            ? `${a.action === "BUY" ? "Long" : "Short"} Straddle`
            : "Custom";
        }
        return a.action === b.action
          ? `${a.action === "BUY" ? "Long" : "Short"} Strangle`
          : "Custom";
      }
      if (a.optionType === b.optionType && a.action !== b.action) {
        return a.optionType === "CE"
          ? `${a.action === "BUY" && (a.strike || 0) < (b.strike || 0) ? "Bull" : "Bear"} Call Spread`
          : `${a.action === "BUY" && (a.strike || 0) > (b.strike || 0) ? "Bear" : "Bull"} Put Spread`;
      }
    }
    if (legs.length === 4) {
      const buyCE = legs.filter((l) => l.optionType === "CE" && l.action === "BUY");
      const sellCE = legs.filter((l) => l.optionType === "CE" && l.action === "SELL");
      const buyPE = legs.filter((l) => l.optionType === "PE" && l.action === "BUY");
      const sellPE = legs.filter((l) => l.optionType === "PE" && l.action === "SELL");
      if (buyCE.length === 1 && sellCE.length === 1 && buyPE.length === 1 && sellPE.length === 1) {
        return "Iron Condor";
      }
    }
    return `Custom (${legs.length} legs)`;
  }, [legs]);

  const handleExecute = useCallback(async () => {
    if (!isConnected || legs.length === 0) return;
    setExecuting(true);
    try {
      for (const leg of legs) {
        const inst = getInstrument(leg.underlying);
        const lotSize = inst?.lotSize || 25;
        let tsym = leg.underlying;
        if (leg.instrumentType.includes("option") && leg.strike) {
          tsym = `${leg.underlying}27FEB26${leg.optionType === "CE" ? "C" : "P"}${leg.strike}`;
        }
        await placeOrder({
          tradingsymbol: tsym,
          quantity: leg.lots * lotSize,
          price: leg.entryType === "LMT" ? leg.limitPrice || leg.ltp : leg.ltp,
          transaction_type: leg.action === "BUY" ? "B" : "S",
          order_type: leg.entryType,
          product: "M",
          exchange: inst?.exchange || "NFO",
        });
      }
      toast({
        title: "Strategy Executed",
        description: `${detectedStrategy} placed with ${legs.length} legs`,
      });
      setLegs([]);
    } catch (err: any) {
      toast({
        title: "Execution Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  }, [isConnected, legs, placeOrder, toast, detectedStrategy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              className="text-base font-bold text-foreground bg-transparent border-none outline-none focus:ring-0 p-0 w-auto"
            />
            {detectedStrategy && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {detectedStrategy}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
            >
              <Zap className="w-3 h-3" />
              Templates
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
              <Save className="w-3 h-3" />
              Save
            </button>
          </div>
        </div>

        {/* Templates Panel */}
        {showTemplates && (
          <StrategyTemplates onApply={applyTemplate} onClose={() => setShowTemplates(false)} />
        )}

        {/* Instrument Filter + Add Leg */}
        <div className="px-5 py-3 border-b border-border/50 bg-secondary/10">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              {(["all", "index", "stock"] as InstrumentFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setInstrumentFilter(f);
                    setShowStockSearch(f === "stock");
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors capitalize",
                    instrumentFilter === f
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Quick Add Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {instrumentFilter !== "stock" && (
                <>
                  {INDEX_INSTRUMENTS.slice(0, 4).map((idx) => (
                    <button
                      key={idx.symbol}
                      onClick={() => addLeg(idx.symbol, "index_option")}
                      className="px-2 py-1 rounded text-[10px] font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
                    >
                      + {idx.symbol}
                    </button>
                  ))}
                  <button
                    onClick={() => addLeg("NIFTY", "index_future")}
                    className="px-2 py-1 rounded text-[10px] font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                  >
                    + Index Future
                  </button>
                </>
              )}
              {instrumentFilter !== "index" && (
                <button
                  onClick={() => setShowStockSearch(!showStockSearch)}
                  className="px-2 py-1 rounded text-[10px] font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors flex items-center gap-1"
                >
                  <Search className="w-2.5 h-2.5" />
                  + Stock
                </button>
              )}
            </div>
          </div>

          {/* Stock Search */}
          {showStockSearch && (
            <div className="mt-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search F&O stocks..."
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 text-xs bg-background border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
                  autoFocus
                />
                {stockSearch && (
                  <button
                    onClick={() => setStockSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1 max-h-[120px] overflow-y-auto">
                {filteredStocks.map((stock) => (
                  <button
                    key={stock.symbol}
                    className="text-left px-2 py-1.5 rounded text-[10px] hover:bg-secondary text-foreground transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium truncate">{stock.symbol}</span>
                      <div className="flex gap-1">
                        <span
                          onClick={() => addLeg(stock.symbol, "stock_option")}
                          className="text-primary cursor-pointer hover:underline"
                        >
                          Opt
                        </span>
                        <span
                          onClick={() => addLeg(stock.symbol, "stock_future")}
                          className="text-accent cursor-pointer hover:underline"
                        >
                          Fut
                        </span>
                      </div>
                    </div>
                    <div className="text-[9px] text-muted-foreground truncate">
                      {stock.industry} · Lot {stock.lotSize}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Legs */}
        <div className="p-4 space-y-2">
          {legs.length === 0 ? (
            <div className="py-8 text-center">
              <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-xs text-muted-foreground">
                No legs added. Use buttons above or pick a template to start building.
              </p>
            </div>
          ) : (
            legs.map((leg, i) => {
              const inst = getInstrument(leg.underlying);
              const lotSize = inst?.lotSize || 25;
              const spot = getDefaultSpotPrice(leg.underlying);
              const step = inst?.strikeStep || 50;
              const isFuture = leg.instrumentType.includes("future");
              const isWeekly = inst?.type === "index" ? (inst as any).weeklyExpiry : false;
              const expiries = getUpcomingExpiries(isWeekly, 4);

              // Generate strike list
              const strikes: number[] = [];
              if (!isFuture) {
                const atmStrike = Math.round(spot / step) * step;
                for (let j = -10; j <= 10; j++) {
                  strikes.push(atmStrike + j * step);
                }
              }

              return (
                <div
                  key={leg.id}
                  className="rounded-lg bg-secondary/30 border border-border/30 animate-slide-up overflow-hidden"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {/* Leg Header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-secondary/20">
                    <span className="text-[10px] text-muted-foreground font-mono w-5">
                      L{i + 1}
                    </span>
                    <span className="text-[10px] font-semibold text-foreground">
                      {leg.underlying}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] font-medium px-1.5 py-0.5 rounded",
                        isFuture
                          ? "bg-accent/10 text-accent"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {isFuture ? "FUTURE" : "OPTION"}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        LTP: ₹{leg.ltp.toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeLeg(leg.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Leg Config */}
                  <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap">
                    {/* Action */}
                    <button
                      onClick={() =>
                        updateLeg(leg.id, {
                          action: leg.action === "BUY" ? "SELL" : "BUY",
                        })
                      }
                      className={cn(
                        "text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1",
                        leg.action === "SELL"
                          ? "bg-destructive/10 text-loss hover:bg-destructive/20"
                          : "bg-success/10 text-profit hover:bg-success/20"
                      )}
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                      {leg.action}
                    </button>

                    {/* Option Type or Future Type */}
                    {!isFuture ? (
                      <select
                        value={leg.optionType}
                        onChange={(e) =>
                          updateLeg(leg.id, {
                            optionType: e.target.value as "CE" | "PE",
                          })
                        }
                        className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded border border-border/50 outline-none bg-muted cursor-pointer",
                          leg.optionType === "CE"
                            ? "text-profit"
                            : "text-loss"
                        )}
                      >
                        <option value="CE">CE</option>
                        <option value="PE">PE</option>
                      </select>
                    ) : (
                      <select
                        value={leg.futureType}
                        onChange={(e) =>
                          updateLeg(leg.id, {
                            futureType: e.target.value as "near" | "mid" | "far",
                          })
                        }
                        className="text-[10px] font-medium px-2 py-1 rounded border border-border/50 outline-none bg-muted text-foreground cursor-pointer"
                      >
                        <option value="near">Near</option>
                        <option value="mid">Mid</option>
                        <option value="far">Far</option>
                      </select>
                    )}

                    {/* Strike (options only) */}
                    {!isFuture && (
                      <select
                        value={leg.strike}
                        onChange={(e) =>
                          updateLeg(leg.id, { strike: Number(e.target.value) })
                        }
                        className="text-[10px] font-mono font-semibold px-2 py-1 rounded border border-border/50 outline-none bg-muted text-foreground cursor-pointer w-24"
                      >
                        {strikes.map((s) => (
                          <option key={s} value={s}>
                            {s.toLocaleString()} {Math.abs(s - spot) <= step / 2 ? " ATM" : ""}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Expiry */}
                    <select
                      value={leg.expiry}
                      onChange={(e) =>
                        updateLeg(leg.id, { expiry: e.target.value })
                      }
                      className="text-[10px] px-2 py-1 rounded border border-border/50 outline-none bg-muted text-foreground cursor-pointer"
                    >
                      {expiries.map((exp) => (
                        <option key={exp.label} value={exp.label}>
                          {exp.label} {exp.isWeekly ? "(W)" : "(M)"}
                        </option>
                      ))}
                    </select>

                    {/* Lots */}
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-muted-foreground">Lots:</span>
                      <input
                        type="number"
                        value={leg.lots}
                        onChange={(e) =>
                          updateLeg(leg.id, {
                            lots: Math.max(1, Number(e.target.value)),
                          })
                        }
                        min={1}
                        className="w-12 text-[10px] font-mono px-1.5 py-1 rounded border border-border/50 outline-none bg-muted text-foreground text-center"
                      />
                      <span className="text-[9px] text-muted-foreground">
                        ({leg.lots * lotSize})
                      </span>
                    </div>

                    {/* Entry Type */}
                    <select
                      value={leg.entryType}
                      onChange={(e) =>
                        updateLeg(leg.id, {
                          entryType: e.target.value as "MKT" | "LMT",
                        })
                      }
                      className="text-[10px] px-2 py-1 rounded border border-border/50 outline-none bg-muted text-foreground cursor-pointer"
                    >
                      <option value="MKT">Market</option>
                      <option value="LMT">Limit</option>
                    </select>

                    {/* Limit Price */}
                    {leg.entryType === "LMT" && (
                      <input
                        type="number"
                        value={leg.limitPrice || ""}
                        onChange={(e) =>
                          updateLeg(leg.id, {
                            limitPrice: Number(e.target.value),
                          })
                        }
                        placeholder="Price"
                        className="w-20 text-[10px] font-mono px-2 py-1 rounded border border-border/50 outline-none bg-muted text-foreground"
                      />
                    )}

                    {/* Validity */}
                    <select
                      value={leg.validity}
                      onChange={(e) =>
                        updateLeg(leg.id, {
                          validity: e.target.value as "DAY" | "IOC",
                        })
                      }
                      className="text-[10px] px-2 py-1 rounded border border-border/50 outline-none bg-muted text-foreground cursor-pointer"
                    >
                      <option value="DAY">Day</option>
                      <option value="IOC">IOC</option>
                    </select>
                  </div>
                </div>
              );
            })
          )}

          {/* Add Leg Button */}
          <button
            onClick={() => addLeg()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-border/50 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Leg
          </button>
        </div>

        {/* Warnings */}
        {hasUnlimitedRisk && legs.length > 0 && (
          <div className="mx-5 mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
            <p className="text-[10px] text-warning">
              This strategy has potentially <strong>unlimited risk</strong>. Consider adding protective legs.
            </p>
          </div>
        )}

        {/* Combined Greeks + Summary */}
        {legs.length > 0 && (
          <div className="border-t border-border/50">
            {/* Greeks Row */}
            <div className="grid grid-cols-4 gap-px bg-border/30">
              {[
                { label: "Delta", value: combinedGreeks.delta, color: combinedGreeks.delta >= 0 ? "text-profit" : "text-loss" },
                { label: "Gamma", value: combinedGreeks.gamma, color: "text-foreground" },
                { label: "Theta", value: combinedGreeks.theta, color: combinedGreeks.theta >= 0 ? "text-profit" : "text-loss" },
                { label: "Vega", value: combinedGreeks.vega, color: "text-foreground" },
              ].map((g) => (
                <div key={g.label} className="bg-card px-4 py-2.5">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                    {g.label}
                  </p>
                  <p className={cn("text-sm font-mono font-bold mt-0.5", g.color)}>
                    {g.value.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-3 gap-px bg-border/30">
              <div className="bg-card px-4 py-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  Net Premium
                </p>
                <p
                  className={cn(
                    "text-sm font-mono font-bold mt-0.5",
                    netPremium >= 0 ? "text-profit" : "text-loss"
                  )}
                >
                  {netPremium >= 0 ? "+" : ""}₹
                  {Math.abs(netPremium).toLocaleString("en-IN")}
                  <span className="text-[9px] font-normal text-muted-foreground ml-1">
                    {netPremium >= 0 ? "credit" : "debit"}
                  </span>
                </p>
              </div>
              <div className="bg-card px-4 py-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  Margin Required
                </p>
                <p className="text-sm font-mono font-bold text-foreground mt-0.5">
                  ₹{marginRequired.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-card px-4 py-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  Risk Profile
                </p>
                <p className="text-sm font-bold mt-0.5 flex items-center gap-1">
                  {hasUnlimitedRisk ? (
                    <span className="text-warning flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Unlimited
                    </span>
                  ) : (
                    <span className="text-profit flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Defined
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Execute */}
        {legs.length > 0 && (
          <div className="px-5 py-4 border-t border-border/50">
            {!isConnected ? (
              <div className="flex items-center gap-2 text-xs text-warning">
                <AlertTriangle className="w-4 h-4" />
                Connect broker to execute
              </div>
            ) : (
              <button
                onClick={handleExecute}
                disabled={executing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors glow-primary disabled:opacity-50"
              >
                {executing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {executing ? "Executing..." : `Execute ${detectedStrategy}`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Payoff Chart */}
      {payoffLegs.length > 0 && (
        <PayoffChart
          legs={payoffLegs}
          instrument={primaryInstrument}
          qty={legs[0]?.lots * primaryLotSize || primaryLotSize}
        />
      )}
    </div>
  );
};

export default EnhancedStrategyBuilder;
