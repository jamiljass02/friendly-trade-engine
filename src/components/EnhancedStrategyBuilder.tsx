import { useState, useMemo, useCallback, useEffect } from "react";
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
import { getUpcomingExpiries, formatExpiryForSymbol, type ExpiryDate } from "@/lib/expiry-utils";
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
  strikeMode: "spot_based" | "premium_based";
  strikeSelection: string;
  strike?: number;
  expiry: string;
  lots: number;
  entryType: "MKT" | "LMT";
  limitPrice?: number;
  validity: "DAY" | "IOC";
  ltp: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  premiumTarget?: number;
}

type InstrumentFilter = "all" | "index" | "stock";
type StrategyTypeFilter = "all" | "options" | "futures" | "mixed";
type SavedStrategy = { id: string; name: string; legs: StrategyLeg[]; savedAt: string };

const SECTORS = [...new Set(FNO_STOCKS.map((s) => s.industry).filter(Boolean))] as string[];

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
  const { isConnected, placeOrder, searchScrip, getOptionChain } = useBroker();
  const { toast } = useToast();
  const [legs, setLegs] = useState<StrategyLeg[]>([]);
  const [strategyName, setStrategyName] = useState("Custom Strategy");
  const [instrumentFilter, setInstrumentFilter] = useState<InstrumentFilter>("all");
  const [stockSearch, setStockSearch] = useState("");
  const [showStockSearch, setShowStockSearch] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [strategyTypeFilter, setStrategyTypeFilter] = useState<StrategyTypeFilter>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [expiryWeekFilter, setExpiryWeekFilter] = useState<string>("all");
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);

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
    let stocks = FNO_STOCKS;
    if (sectorFilter !== "all") {
      stocks = stocks.filter((s) => s.industry === sectorFilter);
    }
    if (!stockSearch) return stocks.slice(0, 12);
    const q = stockSearch.toLowerCase();
    return stocks
      .filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.industry?.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [stockSearch, sectorFilter]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("strategy-builder-saves");
      setSavedStrategies(stored ? JSON.parse(stored) : []);
    } catch {
      setSavedStrategies([]);
    }
  }, []);

  const availableExpiries = useMemo(() => {
    const expiries = getUpcomingExpiries(true, 8, "NIFTY");
    return expiries.map((e) => e.label);
  }, []);

  const addLeg = useCallback(
    (underlying?: string, type?: "index_option" | "stock_option" | "index_future" | "stock_future") => {
      // Default to first leg's underlying if not specified
      const resolvedUnderlying = underlying || (legs.length > 0 ? legs[0].underlying : "NIFTY");
      const firstLeg = legs.length > 0 ? legs[0] : null;
      const resolvedType = type || (firstLeg?.instrumentType || "index_option");
      
      const inst = getInstrument(resolvedUnderlying);
      const spot = getDefaultSpotPrice(resolvedUnderlying);
      const step = inst?.strikeStep || 50;
      const isWeekly = inst?.type === "index" ? (inst as any).weeklyExpiry : false;
      const expiries = getUpcomingExpiries(isWeekly, 4, resolvedUnderlying);
      const atmStrike = Math.round(spot / step) * step;
      const isFuture = resolvedType.includes("future");
      const mockLTP = isFuture ? spot : 50 + Math.random() * 100;

      const newLeg: StrategyLeg = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        underlying: resolvedUnderlying,
        instrumentType: resolvedType,
        action: "SELL",
        optionType: isFuture ? undefined : "CE",
        futureType: isFuture ? "near" : undefined,
        strikeMode: "spot_based",
        strikeSelection: "ATM",
        strike: isFuture ? undefined : atmStrike,
        expiry: firstLeg?.expiry || expiries[0]?.label || "",
        lots: 1,
        entryType: "MKT",
        validity: "DAY",
        ltp: Math.round(mockLTP * 100) / 100,
      };
      setLegs((prev) => [...prev, newLeg]);
    },
    [legs]
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

  const handleSaveStrategy = useCallback(() => {
    if (legs.length === 0) {
      toast({ title: "Nothing to save", description: "Add at least one leg first.", variant: "destructive" });
      return;
    }

    const payload: SavedStrategy = {
      id: crypto.randomUUID(),
      name: strategyName.trim() || "Custom Strategy",
      legs,
      savedAt: new Date().toISOString(),
    };

    const next = [payload, ...savedStrategies.filter((item) => item.name !== payload.name)].slice(0, 12);
    localStorage.setItem("strategy-builder-saves", JSON.stringify(next));
    setSavedStrategies(next);
    toast({ title: "Strategy saved", description: `${payload.name} is ready to load and execute anytime.` });
  }, [legs, strategyName, savedStrategies, toast]);

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
        const exchange = inst?.exchange || "NFO";
        let tsym = leg.underlying;

        if (leg.instrumentType.includes("option")) {
          if (!leg.strike || !leg.optionType) {
            throw new Error(`Select a valid strike for ${leg.underlying} before executing.`);
          }

          const strike = Number(leg.strike);
          const optionType = leg.optionType;

          try {
            const chainResult = await getOptionChain(leg.underlying, strike, 12, exchange);
            const values = Array.isArray((chainResult as any)?.values)
              ? (chainResult as any).values
              : Array.isArray(chainResult)
                ? chainResult
                : [];

            const exactFromChain = values.find((row: any) => {
              const rowStrike = Number(row.strprc ?? row.strike);
              const rowType = String(row.optt ?? "").toUpperCase();
              return rowStrike === strike && rowType === optionType && row.tsym;
            });

            if (exactFromChain?.tsym) {
              tsym = String(exactFromChain.tsym);
            }
          } catch {
            // fallback to search
          }

          if (tsym === leg.underlying) {
            const isWeekly = inst?.type === "index" ? (inst as any).weeklyExpiry : false;
            const expiries = getUpcomingExpiries(isWeekly, 8, leg.underlying);
            const expiryObj = expiries.find((e) => e.label === leg.expiry) || expiries[0];
            const expiryCode = formatExpiryForSymbol(expiryObj?.date || new Date());
            const constructed = `${leg.underlying}${expiryCode}${optionType === "CE" ? "C" : "P"}${strike}`;
            const searchCandidates = [constructed, `${leg.underlying} ${strike} ${optionType}`];

            for (const query of searchCandidates) {
              try {
                const searchResult = await searchScrip(query, exchange);
                const values = Array.isArray(searchResult?.values)
                  ? searchResult.values
                  : Array.isArray(searchResult)
                    ? searchResult
                    : [];

                const exact = values.find((row: any) => {
                  const rowStrike = Number(row.strprc ?? row.strike);
                  const rowType = String(row.optt ?? "").toUpperCase();
                  const rowTsym = String(row.tsym ?? "");
                  const strikeMatch = Number.isFinite(rowStrike)
                    ? rowStrike === strike
                    : rowTsym.includes(String(strike));
                  const typeMatch = rowType
                    ? rowType === optionType
                    : rowTsym.includes(optionType === "CE" ? "C" : "P");
                  return strikeMatch && typeMatch;
                });

                if (exact?.tsym) {
                  tsym = String(exact.tsym);
                  break;
                }
              } catch {
                // continue to next fallback
              }
            }
          }

          if (tsym === leg.underlying) {
            throw new Error(`Unable to resolve trading symbol for ${leg.underlying} ${optionType} ${strike}.`);
          }
        }

        await placeOrder({
          tradingsymbol: tsym,
          quantity: leg.lots * lotSize,
          price: leg.entryType === "LMT" ? leg.limitPrice || leg.ltp : 0,
          transaction_type: leg.action === "BUY" ? "B" : "S",
          order_type: leg.entryType,
          product: "M",
          exchange,
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
  }, [isConnected, legs, placeOrder, searchScrip, getOptionChain, toast, detectedStrategy]);

  return (
    <div className="space-y-6">
      {/* Payoff Chart on top */}
      {payoffLegs.length > 0 && (
        <PayoffChart
          legs={payoffLegs}
          instrument={primaryInstrument}
          qty={legs[0]?.lots * primaryLotSize || primaryLotSize}
        />
      )}

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
            {savedStrategies.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const selected = savedStrategies.find((item) => item.id === e.target.value);
                  if (!selected) return;
                  setStrategyName(selected.name);
                  setLegs(selected.legs);
                }}
                className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium border border-border/50 outline-none"
              >
                <option value="">Load Saved</option>
                {savedStrategies.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
            >
              <Zap className="w-3 h-3" />
              Templates
            </button>
            <button onClick={handleSaveStrategy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
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

            {/* Strategy Type Filter */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              {(["all", "options", "futures", "mixed"] as StrategyTypeFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStrategyTypeFilter(f)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors capitalize",
                    strategyTypeFilter === f
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Sector Filter (stocks) */}
            {instrumentFilter !== "index" && (
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="text-[10px] px-2 py-1.5 rounded-md border border-border/50 outline-none bg-muted text-foreground cursor-pointer"
              >
                <option value="all">All Sectors</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}

            {/* Expiry Week Filter */}
            <select
              value={expiryWeekFilter}
              onChange={(e) => setExpiryWeekFilter(e.target.value)}
              className="text-[10px] px-2 py-1.5 rounded-md border border-border/50 outline-none bg-muted text-foreground cursor-pointer"
            >
              <option value="all">All Expiries</option>
              {availableExpiries.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          {/* Quick Add Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
            {instrumentFilter !== "stock" && strategyTypeFilter !== "futures" && (
              <>
                {INDEX_INSTRUMENTS.slice(0, 4).map((idx) => (
                  <button
                    key={idx.symbol}
                    onClick={() => addLeg(idx.symbol, "index_option")}
                    className="px-2 py-1 rounded text-[10px] font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
                  >
                    + {idx.symbol} Opt
                  </button>
                ))}
              </>
            )}
            {instrumentFilter !== "stock" && strategyTypeFilter !== "options" && (
              <>
                {INDEX_INSTRUMENTS.slice(0, 3).map((idx) => (
                  <button
                    key={`fut-${idx.symbol}`}
                    onClick={() => addLeg(idx.symbol, "index_future")}
                    className="px-2 py-1 rounded text-[10px] font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                  >
                    + {idx.symbol} Fut
                  </button>
                ))}
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
          {/* Column Headers */}
          {legs.length > 0 && (
            <div className="flex items-center gap-2 text-[9px] text-muted-foreground uppercase tracking-wider px-2">
              <span className="w-8">Leg</span>
              <span className="w-[75px]">Segment</span>
              <span className="w-[90px]">Expiry</span>
              <span className="w-[85px]">Strike Mode</span>
              <span className="w-[90px]">Strike</span>
              <span className="w-[50px]">Type</span>
              <span className="w-[50px]">Lot</span>
              <span className="w-[55px]">Action</span>
              <span className="w-[65px]">Stop Loss</span>
              <span className="w-[70px]">Take Profit</span>
              <span className="w-6"></span>
            </div>
          )}

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
              const expiries = getUpcomingExpiries(isWeekly, 4, leg.underlying);

              // Keep ATM centered between nearby OTM/ITM levels (1-20)
              const primaryStrikeOpts = [
                ...Array.from({ length: 20 }, (_, i) => `OTM ${20 - i}`),
                "ATM",
                ...Array.from({ length: 20 }, (_, i) => `ITM ${i + 1}`),
              ];
              const strikeOpts = primaryStrikeOpts.includes(leg.strikeSelection)
                ? primaryStrikeOpts
                : [...primaryStrikeOpts, leg.strikeSelection];

              return (
                <div
                  key={leg.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border transition-colors animate-slide-up",
                    leg.action === "BUY" ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"
                  )}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {/* Leg Label */}
                  <span className="text-[10px] font-mono text-muted-foreground w-8 text-center shrink-0 bg-muted rounded px-1 py-0.5">
                    L{i + 1}
                  </span>

                  {/* Segment: underlying + type */}
                  <div className="flex items-center gap-1 w-[75px] shrink-0">
                    <span className="text-[10px] font-semibold text-foreground truncate">{leg.underlying}</span>
                    <span className={cn("text-[8px] font-medium px-1 py-0.5 rounded", isFuture ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary")}>
                      {isFuture ? "FUT" : "OPT"}
                    </span>
                  </div>

                  {/* Expiry */}
                  {isFuture ? (
                    <select
                      value={leg.futureType}
                      onChange={(e) => updateLeg(leg.id, { futureType: e.target.value as "near" | "mid" | "far" })}
                      className="bg-muted text-foreground text-[10px] px-1.5 py-1.5 rounded border border-border/50 outline-none w-[90px]"
                    >
                      <option value="near">Near Month</option>
                      <option value="mid">Mid Month</option>
                      <option value="far">Far Month</option>
                    </select>
                  ) : (
                    <select
                      value={leg.expiry}
                      onChange={(e) => updateLeg(leg.id, { expiry: e.target.value })}
                      className="bg-muted text-foreground text-[10px] px-1.5 py-1.5 rounded border border-border/50 outline-none w-[90px]"
                    >
                      {expiries.map((exp) => (
                        <option key={exp.label} value={exp.label}>
                          {exp.label} {exp.isWeekly ? "(W)" : "(M)"}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Strike Mode */}
                  {!isFuture ? (
                    <select
                      value={leg.strikeMode || "spot_based"}
                      onChange={(e) => updateLeg(leg.id, { strikeMode: e.target.value as any })}
                      className="bg-muted text-foreground text-[10px] px-1.5 py-1.5 rounded border border-border/50 outline-none w-[85px]"
                    >
                      <option value="spot_based">Spot Based</option>
                      <option value="premium_based">Premium</option>
                    </select>
                  ) : (
                    <span className="w-[85px] text-[10px] text-muted-foreground text-center">—</span>
                  )}

                  {/* Strike Selection */}
                  {!isFuture ? (
                    leg.strikeMode === "premium_based" ? (
                      <div className="flex items-center gap-0.5 w-[90px]">
                        <span className="text-[9px] text-muted-foreground">₹</span>
                        <input
                          type="number"
                          value={leg.premiumTarget ?? ""}
                          onChange={(e) => updateLeg(leg.id, { premiumTarget: Number(e.target.value) })}
                          placeholder="Premium"
                          className="w-full bg-muted text-foreground text-[10px] px-1.5 py-1.5 rounded border border-border/50 font-mono"
                        />
                      </div>
                    ) : (
                      <select
                        value={leg.strikeSelection || "ATM"}
                        onChange={(e) => {
                          const sel = e.target.value;
                          updateLeg(leg.id, { strikeSelection: sel });
                          // Also update numeric strike
                          const atmStrike = Math.round(spot / step) * step;
                          if (sel === "ATM") {
                            updateLeg(leg.id, { strike: atmStrike, strikeSelection: sel });
                          } else if (sel.startsWith("OTM")) {
                            const n = parseInt(sel.split(" ")[1]) || 1;
                            const dir = leg.optionType === "CE" ? 1 : -1;
                            updateLeg(leg.id, { strike: atmStrike + n * step * dir, strikeSelection: sel });
                          } else if (sel.startsWith("ITM")) {
                            const n = parseInt(sel.split(" ")[1]) || 1;
                            const dir = leg.optionType === "CE" ? -1 : 1;
                            updateLeg(leg.id, { strike: atmStrike + n * step * dir, strikeSelection: sel });
                          }
                        }}
                        className="bg-muted text-foreground text-[10px] px-1.5 py-1.5 rounded border border-border/50 outline-none w-[90px]"
                      >
                        {strikeOpts.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )
                  ) : (
                    <span className="w-[90px] text-[10px] text-muted-foreground text-center">—</span>
                  )}

                  {/* CE/PE */}
                  {!isFuture ? (
                    <button
                      onClick={() => updateLeg(leg.id, { optionType: leg.optionType === "CE" ? "PE" : "CE" })}
                      className={cn(
                        "text-[10px] font-bold py-1.5 rounded border text-center w-[50px] transition-colors",
                        leg.optionType === "CE"
                          ? "bg-success/20 text-profit border-success/30"
                          : "bg-destructive/20 text-loss border-destructive/30"
                      )}
                    >
                      {leg.optionType}
                    </button>
                  ) : (
                    <span className="w-[50px] text-[10px] text-muted-foreground text-center">FUT</span>
                  )}

                  {/* Lots */}
                  <input
                    type="number"
                    value={leg.lots}
                    onChange={(e) => updateLeg(leg.id, { lots: Math.max(1, Number(e.target.value)) })}
                    min={1}
                    className="bg-muted text-foreground text-[10px] px-1.5 py-1.5 rounded border border-border/50 font-mono w-[50px] text-center"
                  />

                  {/* Action */}
                  <button
                    onClick={() => updateLeg(leg.id, { action: leg.action === "BUY" ? "SELL" : "BUY" })}
                    className={cn(
                      "text-[10px] font-bold py-1.5 rounded border text-center w-[55px] transition-colors",
                      leg.action === "BUY"
                        ? "bg-success/20 text-profit border-success/30"
                        : "bg-destructive/20 text-loss border-destructive/30"
                    )}
                  >
                    {leg.action === "BUY" ? "Buy" : "Sell"}
                  </button>

                  {/* Stop Loss % */}
                  <div className="flex items-center w-[65px]">
                    <input
                      type="number"
                      value={leg.stopLossPct ?? ""}
                      onChange={(e) => updateLeg(leg.id, { stopLossPct: Number(e.target.value) || undefined })}
                      placeholder="SL"
                      className="bg-muted text-foreground text-[10px] px-1 py-1.5 rounded-l border border-border/50 font-mono w-full text-center"
                    />
                    <span className="text-[9px] text-muted-foreground bg-muted border border-l-0 border-border/50 rounded-r px-1 py-1.5">%</span>
                  </div>

                  {/* Take Profit % */}
                  <div className="flex items-center w-[70px]">
                    <input
                      type="number"
                      value={leg.takeProfitPct ?? ""}
                      onChange={(e) => updateLeg(leg.id, { takeProfitPct: Number(e.target.value) || undefined })}
                      placeholder="TP"
                      className="bg-muted text-foreground text-[10px] px-1 py-1.5 rounded-l border border-border/50 font-mono w-full text-center"
                    />
                    <span className="text-[9px] text-muted-foreground bg-muted border border-l-0 border-border/50 rounded-r px-1 py-1.5">%</span>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => removeLeg(leg.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
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


    </div>
  );
};

export default EnhancedStrategyBuilder;
