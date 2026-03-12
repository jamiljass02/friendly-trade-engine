import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useBroker } from "@/hooks/useBroker";
import { CheckSquare, Star, Search, X, TrendingUp, BarChart3, Activity, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ExpirySelector from "./ExpirySelector";
import { getInstrument, getDefaultSpotPrice, INDEX_INSTRUMENTS, FNO_STOCKS, type Instrument } from "@/lib/instruments";
import { getUpcomingExpiries, getDaysToExpiry, type ExpiryDate } from "@/lib/expiry-utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface OptionRow {
  strike: number;
  callLTP: number;
  callIV: number;
  callDelta: number;
  callGamma: number;
  callTheta: number;
  callVega: number;
  callOI: number;
  callVolume: number;
  putLTP: number;
  putIV: number;
  putDelta: number;
  putGamma: number;
  putTheta: number;
  putVega: number;
  putOI: number;
  putVolume: number;
  callTsym?: string;
  putTsym?: string;
}

function calcGreeks(spot: number, strike: number, iv: number, daysToExpiry: number, isCall: boolean) {
  if (iv <= 0 || daysToExpiry <= 0 || spot <= 0) return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  const T = daysToExpiry / 365;
  const sigma = iv / 100;
  const r = 0.07;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(spot / strike) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const cdf = (x: number) => {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + p * ax);
    const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
    return 0.5 * (1 + sign * y);
  };
  const pdf = (x: number) => (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
  const Nd1 = cdf(d1);
  const delta = isCall ? Nd1 : Nd1 - 1;
  const gamma = pdf(d1) / (spot * sigma * sqrtT);
  const theta = (-(spot * pdf(d1) * sigma) / (2 * sqrtT) - r * strike * Math.exp(-r * T) * cdf(isCall ? d2 : -d2) * (isCall ? 1 : -1)) / 365;
  const vega = (spot * sqrtT * pdf(d1)) / 100;
  return {
    delta: Math.round(delta * 1000) / 1000,
    gamma: Math.round(gamma * 10000) / 10000,
    theta: Math.round(theta * 100) / 100,
    vega: Math.round(vega * 100) / 100,
  };
}

const formatNum = (n: number) => {
  if (Math.abs(n) >= 10000000) return (n / 10000000).toFixed(1) + "Cr";
  if (Math.abs(n) >= 100000) return (n / 100000).toFixed(1) + "L";
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(0) + "K";
  return n.toString();
};

const VOLUME_LEADERS = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN", "TATAMOTORS", "BAJFINANCE", "ICICIBANK"];

interface OptionsChainProps {
  onStrikeSelect?: (strike: number, type: "CE" | "PE", ltp: number) => void;
  selectedStrikes?: { strike: number; type: "CE" | "PE" }[];
  onInstrumentChange?: (symbol: string) => void;
  onExpiryChange?: (expiryDate: Date) => void;
  onSpotPriceChange?: (spot: number) => void;
}

const OptionsChain = ({ onStrikeSelect, selectedStrikes = [], onInstrumentChange, onExpiryChange, onSpotPriceChange }: OptionsChainProps) => {
  const { isConnected, getOptionChain, getMarketData } = useBroker();
  const [selectedSymbol, setSelectedSymbol] = useState("NIFTY");
  const [chainTab, setChainTab] = useState<"index" | "stock">("index");
  const [stockSearch, setStockSearch] = useState("");
  const [showStockPanel, setShowStockPanel] = useState(false);
  const [liveData, setLiveData] = useState<OptionRow[] | null>(null);
  const [liveSpot, setLiveSpot] = useState<number | null>(null);
  const [isLive, setIsLive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const centeredAtmRef = useRef<number | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("oc-favorites") || "[]"); } catch { return []; }
  });
  const { toast } = useToast();

  useEffect(() => { localStorage.setItem("oc-favorites", JSON.stringify(favorites)); }, [favorites]);

  const toggleFavorite = (sym: string) => {
    setFavorites((prev) => prev.includes(sym) ? prev.filter((f) => f !== sym) : [...prev, sym]);
  };

  const instrument = getInstrument(selectedSymbol);
  const isWeekly = instrument?.type === "index" ? (instrument as any).weeklyExpiry : false;
  const expiries = useMemo(() => getUpcomingExpiries(isWeekly, 8), [isWeekly]);
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");

  useEffect(() => {
    if (expiries.length > 0) {
      setSelectedExpiry(expiries[0].label);
      onExpiryChange?.(expiries[0].date);
    }
  }, [selectedSymbol, expiries]);

  const handleExpirySelect = useCallback((label: string) => {
    setSelectedExpiry(label);
    const exp = expiries.find(e => e.label === label);
    if (exp) onExpiryChange?.(exp.date);
  }, [expiries, onExpiryChange]);

  const selectedExpiryObj = expiries.find((e) => e.label === selectedExpiry);
  const daysToExpiry = selectedExpiryObj ? getDaysToExpiry(selectedExpiryObj.date) : 5;
  const strikeStep = instrument?.strikeStep || 50;

  const isSelected = useCallback(
    (strike: number, type: "CE" | "PE") => selectedStrikes.some((s) => s.strike === strike && s.type === type),
    [selectedStrikes]
  );

  const handleSelect = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    setShowStockPanel(false);
    setStockSearch("");
    setLiveData(null);
    setLiveSpot(null);
    centeredAtmRef.current = null;
    onInstrumentChange?.(symbol);
  }, [onInstrumentChange]);

  const fetchLiveChain = useCallback(async () => {
    if (!isConnected || !instrument || !selectedExpiryObj) return;

    try {
      let spot = liveSpot || getDefaultSpotPrice(selectedSymbol);

      if (instrument.type === "index" && (instrument as any).spotToken) {
        try {
          const spotExchange = (instrument as any).exchange === "BFO" ? "BSE" : "NSE";
          const spotData = await getMarketData((instrument as any).spotToken, spotExchange);
          if (spotData?.lp) {
            spot = parseFloat(spotData.lp);
            setLiveSpot(spot);
            onSpotPriceChange?.(spot);
          }
        } catch {
          // keep cached/default spot
        }
      }

      const atmStrike = Math.round(spot / strikeStep) * strikeStep;
      const chainResult = await getOptionChain(selectedSymbol, atmStrike, 20);

      if (chainResult && Array.isArray(chainResult.values || chainResult)) {
        const values = chainResult.values || chainResult;
        const rowMap = new Map<number, Partial<OptionRow>>();

        for (const item of values) {
          const strike = parseFloat(item.strprc);
          if (isNaN(strike)) continue;

          if (!rowMap.has(strike)) rowMap.set(strike, { strike });

          const row = rowMap.get(strike)!;
          const lp = parseFloat(item.lp || "0");
          const oi = parseInt(item.oi || "0", 10);
          const vol = parseInt(item.v || "0", 10);

          if (item.optt === "CE") {
            row.callLTP = lp;
            row.callOI = oi;
            row.callVolume = vol;
            row.callTsym = item.tsym;
          } else if (item.optt === "PE") {
            row.putLTP = lp;
            row.putOI = oi;
            row.putVolume = vol;
            row.putTsym = item.tsym;
          }
        }

        const currentSpot = liveSpot || spot;
        const rows: OptionRow[] = Array.from(rowMap.values())
          .filter(r => r.strike !== undefined)
          .map(r => {
            const s = r.strike!;
            const callIV = r.callLTP ? Math.max(5, 15 + Math.abs(currentSpot - s) / currentSpot * 50) : 15;
            const putIV = r.putLTP ? Math.max(5, 15 + Math.abs(currentSpot - s) / currentSpot * 50) : 15;
            const callGreeks = calcGreeks(currentSpot, s, callIV, daysToExpiry, true);
            const putGreeks = calcGreeks(currentSpot, s, putIV, daysToExpiry, false);
            return {
              strike: s,
              callLTP: r.callLTP || 0,
              callIV, callDelta: callGreeks.delta, callGamma: callGreeks.gamma,
              callTheta: callGreeks.theta, callVega: callGreeks.vega,
              callOI: r.callOI || 0, callVolume: r.callVolume || 0,
              putLTP: r.putLTP || 0,
              putIV, putDelta: putGreeks.delta, putGamma: putGreeks.gamma,
              putTheta: putGreeks.theta, putVega: putGreeks.vega,
              putOI: r.putOI || 0, putVolume: r.putVolume || 0,
              callTsym: r.callTsym, putTsym: r.putTsym,
            };
          })
          .sort((a, b) => a.strike - b.strike);

        if (rows.length > 0) {
          setLiveData(rows);
          setIsLive(true);
        }
      }
    } catch (err: any) {
      console.error("Live chain fetch error:", err.message);
      setIsLive(false);
    }
  }, [isConnected, instrument, selectedSymbol, selectedExpiryObj, strikeStep, daysToExpiry, liveSpot, getOptionChain, getMarketData, onSpotPriceChange]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    if (isConnected && selectedExpiryObj) {
      fetchLiveChain();
      pollRef.current = setInterval(fetchLiveChain, 1000);
    } else {
      setIsLive(false);
      setLiveData(null);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isConnected, selectedSymbol, selectedExpiry, fetchLiveChain]);

  const mockChainData = useMemo(() => {
    const spot = getDefaultSpotPrice(selectedSymbol);
    const step = strikeStep;
    const start = Math.round((spot - 15 * step) / step) * step;
    const rows: OptionRow[] = [];
    const seed = (n: number) => {
      const x = Math.sin(n * 9301 + 49297) * 49297;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 30; i++) {
      const strike = start + i * step;
      const s1 = seed(strike + daysToExpiry * 100);
      const s2 = seed(strike * 2 + daysToExpiry * 200);
      const callIV = 12 + s1 * 8 + Math.abs(spot - strike) / spot * 20;
      const putIV = 12 + s2 * 8 + Math.abs(spot - strike) / spot * 20;
      const callGreeks = calcGreeks(spot, strike, callIV, daysToExpiry, true);
      const putGreeks = calcGreeks(spot, strike, putIV, daysToExpiry, false);
      const intrinsicCall = Math.max(0, spot - strike);
      const intrinsicPut = Math.max(0, strike - spot);
      const callOI = Math.floor(seed(strike * 3) * 3000000);
      const putOI = Math.floor(seed(strike * 4 + 1) * 3000000);
      rows.push({
        strike,
        callLTP: Math.max(0.05, intrinsicCall + 20 + seed(strike * 5) * 50),
        callIV, callDelta: callGreeks.delta, callGamma: callGreeks.gamma,
        callTheta: callGreeks.theta, callVega: callGreeks.vega, callOI,
        callVolume: Math.floor(callOI * (0.05 + seed(strike * 6) * 0.15)),
        putLTP: Math.max(0.05, intrinsicPut + 20 + seed(strike * 7) * 50),
        putIV, putDelta: putGreeks.delta, putGamma: putGreeks.gamma,
        putTheta: putGreeks.theta, putVega: putGreeks.vega, putOI,
        putVolume: Math.floor(putOI * (0.05 + seed(strike * 8) * 0.15)),
      });
    }
    return { rows, spot };
  }, [selectedSymbol, strikeStep, daysToExpiry]);

  const chainData = useMemo(() => {
    const sourceRows = liveData && liveData.length > 0 ? liveData : mockChainData.rows;
    const spot = liveData && liveData.length > 0
      ? (liveSpot || getDefaultSpotPrice(selectedSymbol))
      : mockChainData.spot;

    if (!sourceRows.length) return { rows: sourceRows, spot };

    const nearestAtmIndex = sourceRows.reduce((bestIdx, row, idx, rows) => {
      const currentDiff = Math.abs(row.strike - spot);
      const bestDiff = Math.abs(rows[bestIdx].strike - spot);
      return currentDiff < bestDiff ? idx : bestIdx;
    }, 0);

    const wing = Math.max(10, Math.floor(sourceRows.length / 2));
    const desiredSize = wing * 2 + 1;

    let start = Math.max(0, nearestAtmIndex - wing);
    let end = Math.min(sourceRows.length, start + desiredSize);
    if (end - start < desiredSize) {
      start = Math.max(0, end - desiredSize);
    }

    return { rows: sourceRows.slice(start, end), spot };
  }, [liveData, liveSpot, selectedSymbol, mockChainData]);

  const atmStrike = useMemo(() => {
    if (chainData.rows.length === 0) return null;
    return chainData.rows.reduce((best, row) => {
      const currentDiff = Math.abs(row.strike - chainData.spot);
      const bestDiff = Math.abs(best - chainData.spot);
      return currentDiff < bestDiff ? row.strike : best;
    }, chainData.rows[0].strike);
  }, [chainData.rows, chainData.spot]);

  useEffect(() => {
    centeredAtmRef.current = null;
  }, [selectedSymbol, selectedExpiry]);

  useEffect(() => {
    if (!tableRef.current || !chainData.rows.length || atmStrike === null) return;
    if (centeredAtmRef.current === atmStrike) return;

    const atmIdx = chainData.rows.findIndex((r) => r.strike === atmStrike);
    if (atmIdx < 0) return;

    const rows = tableRef.current.querySelectorAll("tbody tr");
    const target = rows[atmIdx] as HTMLElement | undefined;
    if (!target) return;

    target.scrollIntoView({ block: "center", behavior: "smooth" });
    centeredAtmRef.current = atmStrike;
  }, [chainData.rows, atmStrike]);

  const analytics = useMemo(() => {
    const rows = chainData.rows;
    const totalCallOI = rows.reduce((s, r) => s + r.callOI, 0);
    const totalPutOI = rows.reduce((s, r) => s + r.putOI, 0);
    const pcr = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
    let maxPainStrike = rows[0]?.strike || 0;
    let minPain = Infinity;
    for (const row of rows) {
      let pain = 0;
      for (const r of rows) {
        pain += Math.max(0, row.strike - r.strike) * r.callOI;
        pain += Math.max(0, r.strike - row.strike) * r.putOI;
      }
      if (pain < minPain) {
        minPain = pain;
        maxPainStrike = row.strike;
      }
    }

    const maxCallOIStrike = rows.reduce(
      (m, r) => (r.callOI > m.oi ? { strike: r.strike, oi: r.callOI } : m),
      { strike: 0, oi: 0 }
    );
    const maxPutOIStrike = rows.reduce(
      (m, r) => (r.putOI > m.oi ? { strike: r.strike, oi: r.putOI } : m),
      { strike: 0, oi: 0 }
    );

    return { pcr, maxPainStrike, maxCallOIStrike, maxPutOIStrike, totalCallOI, totalPutOI };
  }, [chainData]);

  const maxOI = useMemo(
    () => Math.max(...chainData.rows.map((r) => Math.max(r.callOI, r.putOI)), 1),
    [chainData]
  );

  const filteredStocks = useMemo(() => {
    if (!stockSearch) return FNO_STOCKS.slice(0, 20);
    const q = stockSearch.toLowerCase();
    return FNO_STOCKS.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.industry?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [stockSearch]);

  return (
    <div className="space-y-4">
      {/* Asset Selector Bar */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                {selectedSymbol} Options Chain
                {isLive ? (
                  <span className="flex items-center gap-1 text-[10px] text-profit font-normal">
                    <Wifi className="w-3 h-3" /> LIVE
                  </span>
                ) : isConnected ? (
                  <span className="flex items-center gap-1 text-[10px] text-warning font-normal">
                    <WifiOff className="w-3 h-3" /> Connecting...
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
                    Mock Data
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Spot: <span className="font-mono text-primary">₹{chainData.spot.toLocaleString("en-IN")}</span>
                {instrument && <span className="ml-2">· Lot: {instrument.lotSize} · DTE: {daysToExpiry}d</span>}
              </p>
            </div>
            <button onClick={() => toggleFavorite(selectedSymbol)}
              className={cn("p-1.5 rounded-lg transition-colors", favorites.includes(selectedSymbol) ? "text-warning" : "text-muted-foreground hover:text-warning")}>
              <Star className={cn("w-4 h-4", favorites.includes(selectedSymbol) && "fill-current")} />
            </button>
          </div>

          {/* Index / Stock Tabs */}
          <Tabs value={chainTab} onValueChange={(v) => setChainTab(v as "index" | "stock")} className="w-full">
            <TabsList className="bg-muted/80 w-full justify-start gap-0.5 h-auto p-0.5 rounded-lg">
              <TabsTrigger value="index" className="text-[10px] px-3 py-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Index Options
              </TabsTrigger>
              <TabsTrigger value="stock" className="text-[10px] px-3 py-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Stock Options
              </TabsTrigger>
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
                    <button key={sym} onClick={() => handleSelect(sym)}
                      className={cn("px-2 py-1 rounded text-[10px] font-medium transition-colors",
                        selectedSymbol === sym ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                      )}>{sym}</button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 flex-wrap">
                <TrendingUp className="w-3 h-3 text-profit" />
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider mr-1">Vol Leaders</span>
                {VOLUME_LEADERS.map((sym) => (
                  <button key={sym} onClick={() => handleSelect(sym)}
                    className={cn("px-2 py-1 rounded text-[10px] font-medium transition-colors",
                      selectedSymbol === sym ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                    )}>{sym}</button>
                ))}
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input type="text" placeholder="Search F&O stocks..." value={stockSearch} onChange={(e) => { setStockSearch(e.target.value); setShowStockPanel(true); }}
                  onFocus={() => setShowStockPanel(true)}
                  className="w-full pl-8 pr-8 py-1.5 text-xs bg-background border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground" />
                {stockSearch && <button onClick={() => setStockSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
              </div>

              {showStockPanel && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 max-h-[180px] overflow-y-auto">
                  {filteredStocks.map((stock) => (
                    <button key={stock.symbol} onClick={() => handleSelect(stock.symbol)}
                      className={cn("text-left px-2 py-1.5 rounded text-[11px] transition-colors flex items-center gap-1",
                        selectedSymbol === stock.symbol ? "bg-primary/10 text-primary" : "hover:bg-secondary text-foreground"
                      )}>
                      {favorites.includes(stock.symbol) && <Star className="w-2.5 h-2.5 fill-warning text-warning shrink-0" />}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{stock.symbol}</div>
                        <div className="text-[9px] text-muted-foreground truncate">{stock.industry} · Lot {stock.lotSize}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Expiry */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Expiry</span>
            <ExpirySelector expiries={expiries} selected={selectedExpiry} onSelect={handleExpirySelect} />
          </div>
        </div>
      </div>

      {/* Analytics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="glass-card rounded-xl px-4 py-3">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">PCR (OI)</p>
          <p className={cn("text-lg font-mono font-bold mt-0.5", analytics.pcr > 1 ? "text-profit" : analytics.pcr < 0.7 ? "text-loss" : "text-foreground")}>
            {analytics.pcr.toFixed(2)}
          </p>
          <p className="text-[9px] text-muted-foreground">{analytics.pcr > 1 ? "Bullish" : analytics.pcr < 0.7 ? "Bearish" : "Neutral"}</p>
        </div>
        <div className="glass-card rounded-xl px-4 py-3">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Max Pain</p>
          <p className="text-lg font-mono font-bold text-primary mt-0.5">₹{analytics.maxPainStrike.toLocaleString()}</p>
          <p className="text-[9px] text-muted-foreground">Target convergence</p>
        </div>
        <div className="glass-card rounded-xl px-4 py-3">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Max Call OI</p>
          <p className="text-sm font-mono font-bold text-profit mt-0.5">₹{analytics.maxCallOIStrike.strike.toLocaleString()}</p>
          <p className="text-[9px] text-muted-foreground">{formatNum(analytics.maxCallOIStrike.oi)} OI</p>
        </div>
        <div className="glass-card rounded-xl px-4 py-3">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Max Put OI</p>
          <p className="text-sm font-mono font-bold text-loss mt-0.5">₹{analytics.maxPutOIStrike.strike.toLocaleString()}</p>
          <p className="text-[9px] text-muted-foreground">{formatNum(analytics.maxPutOIStrike.oi)} OI</p>
        </div>
        <div className="glass-card rounded-xl px-4 py-3">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total OI</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xs font-mono text-profit">{formatNum(analytics.totalCallOI)} CE</span>
            <span className="text-xs font-mono text-loss">{formatNum(analytics.totalPutOI)} PE</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden mt-1.5 bg-muted">
            <div className="bg-profit h-full" style={{ width: `${(analytics.totalCallOI / (analytics.totalCallOI + analytics.totalPutOI)) * 100}%` }} />
            <div className="bg-loss h-full" style={{ width: `${(analytics.totalPutOI / (analytics.totalCallOI + analytics.totalPutOI)) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Chain Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div ref={tableRef} className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border/50">
                <th colSpan={8} className="text-center text-[10px] text-profit uppercase tracking-wider py-2 bg-success/5">Calls</th>
                <th className="text-center text-[10px] text-muted-foreground uppercase tracking-wider py-2 bg-secondary/30">Strike</th>
                <th colSpan={8} className="text-center text-[10px] text-loss uppercase tracking-wider py-2 bg-destructive/5">Puts</th>
              </tr>
              <tr className="border-b border-border/50">
                {["Vol", "OI", "Vega", "Theta", "Gamma", "Delta", "IV", "LTP"].map((h) => (
                  <th key={`c-${h}`} className="text-right px-2 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">{h}</th>
                ))}
                <th className="text-center px-2 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider bg-secondary/20 sticky left-0 z-20">Price</th>
                {["LTP", "IV", "Delta", "Gamma", "Theta", "Vega", "OI", "Vol"].map((h) => (
                  <th key={`p-${h}`} className="text-right px-2 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chainData.rows.map((row) => {
                const isITMCall = row.strike < chainData.spot;
                const isITMPut = row.strike > chainData.spot;
                const isATM = Math.abs(row.strike - chainData.spot) <= strikeStep / 2;
                const callSelected = isSelected(row.strike, "CE");
                const putSelected = isSelected(row.strike, "PE");
                const isMaxPain = row.strike === analytics.maxPainStrike;
                const callOIIntensity = row.callOI / maxOI;
                const putOIIntensity = row.putOI / maxOI;

                return (
                  <tr key={row.strike} className={cn("data-row", isATM && "bg-primary/5 border-l-2 border-r-2 border-primary/30")}>
                    <td className={cn("text-right px-2 py-2 font-mono text-[10px] text-muted-foreground", isITMCall && "bg-success/5")}>{formatNum(row.callVolume)}</td>
                    <td className={cn("text-right px-2 py-2 font-mono", isITMCall && "bg-success/5")}
                      style={{ backgroundColor: `hsl(var(--chart-profit) / ${Math.min(0.2, callOIIntensity * 0.2)})` }}>
                      {formatNum(row.callOI)}
                    </td>
                    <td className={cn("text-right px-2 py-2 font-mono text-muted-foreground", isITMCall && "bg-success/5")}>{row.callVega.toFixed(2)}</td>
                    <td className={cn("text-right px-2 py-2 font-mono text-loss", isITMCall && "bg-success/5")}>{row.callTheta.toFixed(2)}</td>
                    <td className={cn("text-right px-2 py-2 font-mono text-muted-foreground", isITMCall && "bg-success/5")}>{row.callGamma.toFixed(4)}</td>
                    <td className={cn("text-right px-2 py-2 font-mono font-semibold", isITMCall && "bg-success/5", row.callDelta >= 0 ? "text-profit" : "text-loss")}>{row.callDelta.toFixed(3)}</td>
                    <td className={cn("text-right px-2 py-2 font-mono text-muted-foreground", isITMCall && "bg-success/5")}>{row.callIV.toFixed(1)}</td>
                    <td className={cn("text-right px-2 py-2 font-mono font-semibold cursor-pointer transition-colors", isITMCall && "bg-success/5",
                        callSelected ? "text-primary bg-primary/10" : "text-foreground hover:text-primary hover:bg-primary/5")}
                      onClick={() => onStrikeSelect?.(row.strike, "CE", row.callLTP)}>
                      <div className="flex items-center justify-end gap-1">
                        {callSelected && <CheckSquare className="w-3 h-3" />}
                        {row.callLTP.toFixed(2)}
                      </div>
                    </td>
                    <td className={cn("text-center px-2 py-2 font-mono font-bold text-foreground bg-secondary/20 sticky left-0 z-10",
                      isMaxPain && "ring-1 ring-primary/50")}>
                      <div className="flex items-center justify-center gap-1">
                        {row.strike.toLocaleString()}
                        {isMaxPain && <Activity className="w-2.5 h-2.5 text-primary" />}
                      </div>
                    </td>
                    <td className={cn("text-right px-2 py-2 font-mono font-semibold cursor-pointer transition-colors", isITMPut && "bg-destructive/5",
                        putSelected ? "text-primary bg-primary/10" : "text-foreground hover:text-primary hover:bg-primary/5")}
                      onClick={() => onStrikeSelect?.(row.strike, "PE", row.putLTP)}>
                      <div className="flex items-center justify-end gap-1">
                        {putSelected && <CheckSquare className="w-3 h-3" />}
                        {row.putLTP.toFixed(2)}
                      </div>
                    </td>
                    <td className={cn("text-right px-2 py-2 font-mono text-muted-foreground", isITMPut && "bg-destructive/5")}>{row.putIV.toFixed(1)}</td>
                    <td className={cn("text-right px-2 py-2 font-mono font-semibold", isITMPut && "bg-destructive/5", row.putDelta <= 0 ? "text-loss" : "text-profit")}>{row.putDelta.toFixed(3)}</td>
                    <td className={cn("text-right px-2 py-2 font-mono text-muted-foreground", isITMPut && "bg-destructive/5")}>{row.putGamma.toFixed(4)}</td>
                    <td className={cn("text-right px-2 py-2 font-mono text-loss", isITMPut && "bg-destructive/5")}>{row.putTheta.toFixed(2)}</td>
                    <td className={cn("text-right px-2 py-2 font-mono text-muted-foreground", isITMPut && "bg-destructive/5")}>{row.putVega.toFixed(2)}</td>
                    <td className={cn("text-right px-2 py-2 font-mono", isITMPut && "bg-destructive/5")}
                      style={{ backgroundColor: `hsl(var(--chart-loss) / ${Math.min(0.2, putOIIntensity * 0.2)})` }}>
                      {formatNum(row.putOI)}
                    </td>
                    <td className={cn("text-right px-2 py-2 font-mono text-[10px] text-muted-foreground", isITMPut && "bg-destructive/5")}>{formatNum(row.putVolume)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OptionsChain;
