import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { INDEX_INSTRUMENTS, FNO_STOCKS, getDefaultSpotPrice, getInstrument } from "@/lib/instruments";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, ArrowRightLeft, BarChart3, Activity, Calculator, Search, Star } from "lucide-react";
import { useBroker } from "@/hooks/useBroker";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

// --- Types ---
interface FuturesContract {
  symbol: string;
  underlying: string;
  expiry: string;
  expiryLabel: string;
  ltp: number;
  change: number;
  changePct: number;
  volume: number;
  oi: number;
  basis: number;
  basisPct: number;
  costOfCarry: number;
  spotPrice: number;
  daysToExpiry: number;
}

interface CalendarSpread {
  nearExpiry: string;
  farExpiry: string;
  nearPrice: number;
  farPrice: number;
  spread: number;
  spreadPct: number;
  rolloverPct: number;
}

interface FuturesStrategy {
  name: string;
  type: "directional" | "spread" | "hedge";
  description: string;
  legs: { action: "BUY" | "SELL"; contract: string; qty: number }[];
  maxProfit: string;
  maxLoss: string;
  margin: number;
  signal?: "bullish" | "bearish" | "neutral";
}

// --- Mock Data Generation ---
function generateFuturesContracts(underlying: string): FuturesContract[] {
  const spot = getDefaultSpotPrice(underlying);
  const now = new Date();
  const contracts: FuturesContract[] = [];

  const expiryLabels = ["Current", "Next", "Far"];
  for (let i = 0; i < 3; i++) {
    const dte = 7 + i * 30 + Math.floor(Math.random() * 5);
    const expiryDate = new Date(now.getTime() + dte * 86400000);
    const month = expiryDate.toLocaleString("en", { month: "short" }).toUpperCase();
    const year = String(expiryDate.getFullYear()).slice(2);
    const expiry = `${String(expiryDate.getDate()).padStart(2, "0")}${month}${year}`;

    const basis = spot * (0.001 + i * 0.0015) * (0.8 + Math.random() * 0.4);
    const ltp = spot + basis;
    const change = (Math.random() - 0.45) * spot * 0.015;
    const costOfCarry = (basis / spot) * (365 / dte) * 100;

    contracts.push({
      symbol: `${underlying}${expiry}FUT`,
      underlying,
      expiry,
      expiryLabel: expiryLabels[i],
      ltp: Math.round(ltp * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePct: Math.round((change / spot) * 10000) / 100,
      volume: Math.floor(Math.random() * 5000000) + 500000,
      oi: Math.floor(Math.random() * 20000000) + 2000000,
      basis: Math.round(basis * 100) / 100,
      basisPct: Math.round((basis / spot) * 10000) / 100,
      costOfCarry: Math.round(costOfCarry * 100) / 100,
      spotPrice: spot,
      daysToExpiry: dte,
    });
  }
  return contracts;
}

function generateCalendarSpreads(contracts: FuturesContract[]): CalendarSpread[] {
  const spreads: CalendarSpread[] = [];
  for (let i = 0; i < contracts.length - 1; i++) {
    for (let j = i + 1; j < contracts.length; j++) {
      const near = contracts[i];
      const far = contracts[j];
      const spread = far.ltp - near.ltp;
      spreads.push({
        nearExpiry: near.expiryLabel,
        farExpiry: far.expiryLabel,
        nearPrice: near.ltp,
        farPrice: far.ltp,
        spread: Math.round(spread * 100) / 100,
        spreadPct: Math.round((spread / near.ltp) * 10000) / 100,
        rolloverPct: Math.round((spread / near.ltp) * 10000) / 100,
      });
    }
  }
  return spreads;
}

function generateStrategies(underlying: string, contracts: FuturesContract[]): FuturesStrategy[] {
  const spot = getDefaultSpotPrice(underlying);
  const inst = getInstrument(underlying);
  const lot = inst?.lotSize || 25;

  const near = contracts[0];
  const far = contracts[contracts.length - 1];
  const basisSignal: "bullish" | "bearish" | "neutral" = near.basisPct > 0.3 ? "bearish" : near.basisPct < 0.05 ? "bullish" : "neutral";

  return [
    {
      name: "Long Futures",
      type: "directional",
      description: `Buy ${underlying} near month futures for bullish directional bet`,
      legs: [{ action: "BUY", contract: near.symbol, qty: lot }],
      maxProfit: "Unlimited",
      maxLoss: "Unlimited (use stop-loss)",
      margin: Math.round(near.ltp * lot * 0.12),
      signal: "bullish",
    },
    {
      name: "Short Futures",
      type: "directional",
      description: `Sell ${underlying} near month futures for bearish directional bet`,
      legs: [{ action: "SELL", contract: near.symbol, qty: lot }],
      maxProfit: "Unlimited",
      maxLoss: "Unlimited (use stop-loss)",
      margin: Math.round(near.ltp * lot * 0.12),
      signal: "bearish",
    },
    {
      name: "Calendar Spread",
      type: "spread",
      description: `Buy near-month, sell far-month to capture time spread convergence`,
      legs: [
        { action: "BUY", contract: near.symbol, qty: lot },
        { action: "SELL", contract: far.symbol, qty: lot },
      ],
      maxProfit: `₹${Math.abs(Math.round((far.ltp - near.ltp) * lot)).toLocaleString("en-IN")} (spread convergence)`,
      maxLoss: "Limited to spread widening",
      margin: Math.round(near.ltp * lot * 0.04),
    },
    {
      name: "Reverse Calendar",
      type: "spread",
      description: `Sell near-month, buy far-month. Profit from spread widening`,
      legs: [
        { action: "SELL", contract: near.symbol, qty: lot },
        { action: "BUY", contract: far.symbol, qty: lot },
      ],
      maxProfit: "Spread widening",
      maxLoss: `₹${Math.abs(Math.round((far.ltp - near.ltp) * lot)).toLocaleString("en-IN")} (spread collapse)`,
      margin: Math.round(near.ltp * lot * 0.04),
    },
    {
      name: "Portfolio Hedge",
      type: "hedge",
      description: `Short index futures to hedge stock portfolio against market decline`,
      legs: [{ action: "SELL", contract: near.symbol, qty: lot }],
      maxProfit: "Offsets portfolio losses in decline",
      maxLoss: "Limits upside gains",
      margin: Math.round(near.ltp * lot * 0.12),
      signal: "neutral",
    },
    {
      name: "Basis Trade",
      type: "hedge",
      description: basisSignal === "bearish"
        ? `High basis (${near.basisPct}%) — sell futures, buy spot for risk-free carry`
        : `Low basis — long futures for convergence profit`,
      legs: [
        { action: basisSignal === "bearish" ? "SELL" : "BUY", contract: near.symbol, qty: lot },
      ],
      maxProfit: `₹${Math.round(Math.abs(near.basis) * lot).toLocaleString("en-IN")} (basis convergence)`,
      maxLoss: "Basis risk",
      margin: Math.round(near.ltp * lot * 0.12),
      signal: basisSignal,
    },
  ];
}

// --- Format helpers ---
const formatVol = (n: number) => {
  if (n >= 10000000) return (n / 10000000).toFixed(1) + "Cr";
  if (n >= 100000) return (n / 100000).toFixed(1) + "L";
  if (n >= 1000) return (n / 1000).toFixed(0) + "K";
  return n.toString();
};

// --- Component ---
const Futures = () => {
  const [selectedSymbol, setSelectedSymbol] = useState("NIFTY");
  const [assetTab, setAssetTab] = useState<"index" | "stock">("index");
  const [stockSearch, setStockSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("fut-favorites") || "[]"); } catch { return []; }
  });
  const { isConnected, placeOrder } = useBroker();
  const { toast } = useToast();

  useEffect(() => { localStorage.setItem("fut-favorites", JSON.stringify(favorites)); }, [favorites]);
  const toggleFav = (s: string) => setFavorites((p) => p.includes(s) ? p.filter((f) => f !== s) : [...p, s]);

  const contracts = useMemo(() => generateFuturesContracts(selectedSymbol), [selectedSymbol]);
  const spreads = useMemo(() => generateCalendarSpreads(contracts), [contracts]);
  const strategies = useMemo(() => generateStrategies(selectedSymbol, contracts), [selectedSymbol, contracts]);
  const instrument = getInstrument(selectedSymbol);
  const spot = getDefaultSpotPrice(selectedSymbol);

  const filteredStocks = useMemo(() => {
    if (!stockSearch) return FNO_STOCKS.slice(0, 16);
    const q = stockSearch.toLowerCase();
    return FNO_STOCKS.filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)).slice(0, 16);
  }, [stockSearch]);

  const handleSelect = (sym: string) => { setSelectedSymbol(sym); setStockSearch(""); };

  const executeStrategy = async (strategy: FuturesStrategy) => {
    try {
      if (!isConnected) {
        await new Promise((r) => setTimeout(r, 600));
        toast({ title: "Strategy Executed (Paper)", description: `${strategy.name} for ${selectedSymbol}` });
        return;
      }
      for (const leg of strategy.legs) {
        await placeOrder({
          tradingsymbol: leg.contract,
          quantity: leg.qty,
          transaction_type: leg.action === "BUY" ? "B" : "S",
          order_type: "MKT",
          product: "M",
        });
      }
      toast({ title: "Orders Placed", description: `${strategy.name}: ${strategy.legs.length} leg(s)` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Futures Trading</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Chain view, calendar spreads & strategies</p>
        </div>

        {/* Asset Selector */}
        <div className="glass-card rounded-xl px-5 py-4 space-y-3">
          <Tabs value={assetTab} onValueChange={(v) => setAssetTab(v as "index" | "stock")}>
            <TabsList className="bg-muted/80 w-full justify-start gap-0.5 h-auto p-0.5 rounded-lg">
              <TabsTrigger value="index" className="text-[10px] px-3 py-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Index Futures</TabsTrigger>
              <TabsTrigger value="stock" className="text-[10px] px-3 py-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Stock Futures</TabsTrigger>
            </TabsList>
            <TabsContent value="index" className="mt-2">
              <div className="flex gap-1 flex-wrap">
                {INDEX_INSTRUMENTS.map((idx) => (
                  <button key={idx.symbol} onClick={() => handleSelect(idx.symbol)}
                    className={cn("px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1",
                      selectedSymbol === idx.symbol ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}>
                    {favorites.includes(idx.symbol) && <Star className="w-2.5 h-2.5 fill-warning text-warning" />}
                    {idx.symbol}
                  </button>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="stock" className="mt-2 space-y-2">
              {favorites.filter((f) => FNO_STOCKS.some((s) => s.symbol === f)).length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <Star className="w-3 h-3 text-warning fill-warning" />
                  {favorites.filter((f) => FNO_STOCKS.some((s) => s.symbol === f)).map((sym) => (
                    <button key={sym} onClick={() => handleSelect(sym)} className={cn("px-2 py-1 rounded text-[10px] font-medium transition-colors", selectedSymbol === sym ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary")}>{sym}</button>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input type="text" placeholder="Search F&O stocks..." value={stockSearch} onChange={(e) => setStockSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground" />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1 max-h-[120px] overflow-y-auto">
                {filteredStocks.map((s) => (
                  <button key={s.symbol} onClick={() => handleSelect(s.symbol)}
                    className={cn("text-left px-2 py-1.5 rounded text-[10px] transition-colors", selectedSymbol === s.symbol ? "bg-primary/10 text-primary" : "hover:bg-secondary text-foreground")}>
                    <div className="font-medium truncate">{s.symbol}</div>
                    <div className="text-[8px] text-muted-foreground">{s.industry}</div>
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">{instrument?.name || selectedSymbol}</span>
            <span>·</span>
            <span>Spot: <span className="font-mono text-primary">₹{spot.toLocaleString("en-IN")}</span></span>
            <span>·</span>
            <span>Lot: {instrument?.lotSize}</span>
            <button onClick={() => toggleFav(selectedSymbol)} className={cn("ml-auto p-1 rounded transition-colors", favorites.includes(selectedSymbol) ? "text-warning" : "text-muted-foreground hover:text-warning")}>
              <Star className={cn("w-3.5 h-3.5", favorites.includes(selectedSymbol) && "fill-current")} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
          <div className="space-y-6">
            {/* Futures Chain */}
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50">
                <h3 className="text-sm font-semibold text-foreground">Futures Chain — {selectedSymbol}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/30">
                      {["Contract", "Expiry", "LTP", "Change", "Volume", "OI", "Basis", "Basis %", "CoC %", "DTE"].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((c) => (
                      <tr key={c.symbol} className="data-row">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded",
                              c.expiryLabel === "Current" ? "bg-primary/10 text-primary" : c.expiryLabel === "Next" ? "bg-accent/10 text-accent-foreground" : "bg-muted text-muted-foreground"
                            )}>{c.expiryLabel}</span>
                            <span className="font-mono text-[11px] text-foreground truncate">{c.symbol}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[10px] text-muted-foreground">{c.expiry}</td>
                        <td className="px-3 py-3 font-mono font-semibold text-foreground">₹{c.ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            {c.change >= 0 ? <ArrowUpRight className="w-3 h-3 text-profit" /> : <ArrowDownRight className="w-3 h-3 text-loss" />}
                            <span className={cn("font-mono font-semibold", c.change >= 0 ? "text-profit" : "text-loss")}>
                              {c.change >= 0 ? "+" : ""}{c.change.toFixed(2)} ({c.changePct >= 0 ? "+" : ""}{c.changePct.toFixed(2)}%)
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-foreground">{formatVol(c.volume)}</td>
                        <td className="px-3 py-3 font-mono text-foreground">{formatVol(c.oi)}</td>
                        <td className="px-3 py-3">
                          <span className={cn("font-mono font-semibold", c.basis >= 0 ? "text-profit" : "text-loss")}>
                            {c.basis >= 0 ? "+" : ""}₹{c.basis.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn("font-mono text-[10px]", c.basisPct >= 0 ? "text-profit" : "text-loss")}>
                            {c.basisPct >= 0 ? "+" : ""}{c.basisPct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-[10px] text-primary">{c.costOfCarry.toFixed(2)}%</td>
                        <td className="px-3 py-3 font-mono text-muted-foreground">{c.daysToExpiry}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calendar Spread Calculator */}
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Calendar Spread Calculator</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/30">
                      {["Spread", "Near Price", "Far Price", "Spread Value", "Spread %", "Rollover Cost %"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {spreads.map((s, i) => (
                      <tr key={i} className="data-row">
                        <td className="px-4 py-3">
                          <span className="text-foreground font-medium">{s.nearExpiry}</span>
                          <span className="text-muted-foreground mx-1.5">→</span>
                          <span className="text-foreground font-medium">{s.farExpiry}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">₹{s.nearPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 font-mono text-foreground">₹{s.farPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3">
                          <span className={cn("font-mono font-semibold", s.spread >= 0 ? "text-profit" : "text-loss")}>
                            {s.spread >= 0 ? "+" : ""}₹{s.spread.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-primary">{s.spreadPct.toFixed(2)}%</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={cn("font-mono font-semibold", s.rolloverPct > 0.2 ? "text-warning" : "text-profit")}>{s.rolloverPct.toFixed(2)}%</span>
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={cn("h-full rounded-full", s.rolloverPct > 0.2 ? "bg-warning" : "bg-profit")}
                                style={{ width: `${Math.min(100, s.rolloverPct * 200)}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Basis Trading Signals */}
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Basis & Cost of Carry</h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-3 gap-4">
                  {contracts.map((c) => (
                    <div key={c.symbol} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{c.expiryLabel}</span>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded",
                          c.basisPct > 0.2 ? "bg-warning/10 text-warning" : c.basisPct > 0.05 ? "bg-success/10 text-profit" : "bg-primary/10 text-primary"
                        )}>
                          {c.basisPct > 0.2 ? "Premium" : c.basisPct > 0.05 ? "Fair" : "Discount"}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">Basis</span>
                          <span className={cn("font-mono font-semibold", c.basis >= 0 ? "text-profit" : "text-loss")}>₹{c.basis.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">CoC (Ann.)</span>
                          <span className="font-mono font-semibold text-primary">{c.costOfCarry.toFixed(2)}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all",
                            c.costOfCarry > 10 ? "bg-warning" : c.costOfCarry > 5 ? "bg-primary" : "bg-profit"
                          )} style={{ width: `${Math.min(100, c.costOfCarry * 5)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Strategies Panel */}
          <div className="space-y-4">
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Futures Strategies</h3>
              </div>
              <div className="divide-y divide-border/50">
                {strategies.map((strat, i) => (
                  <div key={i} className="px-5 py-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-foreground">{strat.name}</h4>
                          <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded uppercase",
                            strat.type === "directional" ? "bg-primary/10 text-primary" :
                            strat.type === "spread" ? "bg-accent/10 text-accent-foreground" :
                            "bg-warning/10 text-warning"
                          )}>{strat.type}</span>
                          {strat.signal && (
                            <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded",
                              strat.signal === "bullish" ? "bg-success/10 text-profit" :
                              strat.signal === "bearish" ? "bg-destructive/10 text-loss" :
                              "bg-muted text-muted-foreground"
                            )}>
                              {strat.signal === "bullish" ? "▲" : strat.signal === "bearish" ? "▼" : "—"} {strat.signal}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{strat.description}</p>
                      </div>
                    </div>

                    {/* Legs */}
                    <div className="space-y-1">
                      {strat.legs.map((leg, j) => (
                        <div key={j} className="flex items-center gap-2 text-[10px]">
                          <span className={cn("font-bold px-1.5 py-0.5 rounded",
                            leg.action === "BUY" ? "bg-success/10 text-profit" : "bg-destructive/10 text-loss"
                          )}>{leg.action}</span>
                          <span className="font-mono text-foreground truncate">{leg.contract}</span>
                          <span className="text-muted-foreground ml-auto">×{leg.qty}</span>
                        </div>
                      ))}
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-secondary/30 rounded px-2 py-1.5">
                        <p className="text-[8px] text-muted-foreground uppercase">Max Profit</p>
                        <p className="text-[10px] font-mono font-semibold text-profit truncate">{strat.maxProfit}</p>
                      </div>
                      <div className="bg-secondary/30 rounded px-2 py-1.5">
                        <p className="text-[8px] text-muted-foreground uppercase">Max Loss</p>
                        <p className="text-[10px] font-mono font-semibold text-loss truncate">{strat.maxLoss}</p>
                      </div>
                      <div className="bg-secondary/30 rounded px-2 py-1.5">
                        <p className="text-[8px] text-muted-foreground uppercase">Margin</p>
                        <p className="text-[10px] font-mono font-semibold text-foreground">₹{strat.margin.toLocaleString("en-IN")}</p>
                      </div>
                    </div>

                    <button onClick={() => executeStrategy(strat)}
                      className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90 transition-colors">
                      Execute {strat.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Futures;
