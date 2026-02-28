import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useBroker } from "@/hooks/useBroker";
import { CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import InstrumentSelector from "./InstrumentSelector";
import ExpirySelector from "./ExpirySelector";
import { getInstrument, getDefaultSpotPrice, INDEX_INSTRUMENTS } from "@/lib/instruments";
import { getUpcomingExpiries, getDaysToExpiry, type ExpiryDate } from "@/lib/expiry-utils";

interface OptionRow {
  strike: number;
  callLTP: number;
  callIV: number;
  callDelta: number;
  callGamma: number;
  callTheta: number;
  callVega: number;
  callOI: number;
  putLTP: number;
  putIV: number;
  putDelta: number;
  putGamma: number;
  putTheta: number;
  putVega: number;
  putOI: number;
}

// Black-Scholes Greeks approximation
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
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + p * x);
    const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
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
  if (Math.abs(n) >= 1000000) return (n / 100000).toFixed(1) + "L";
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(0) + "K";
  return n.toString();
};

interface OptionsChainProps {
  onStrikeSelect?: (strike: number, type: "CE" | "PE", ltp: number) => void;
  selectedStrikes?: { strike: number; type: "CE" | "PE" }[];
  onInstrumentChange?: (symbol: string) => void;
}

const OptionsChain = ({ onStrikeSelect, selectedStrikes = [], onInstrumentChange }: OptionsChainProps) => {
  const { isConnected, searchScrip, getMarketData, getOptionChain } = useBroker();
  const [selectedIndex, setSelectedIndex] = useState("NIFTY");
  const [liveOptionData, setLiveOptionData] = useState<OptionRow[] | null>(null);
  const [liveSpotPrice, setLiveSpotPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Dynamic expiries based on selected instrument
  const instrument = getInstrument(selectedIndex);
  const isWeekly = instrument?.type === "index" ? (instrument as any).weeklyExpiry : false;
  const expiries = useMemo(() => getUpcomingExpiries(isWeekly, 8), [isWeekly]);
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");

  // Set default expiry when instrument changes
  useEffect(() => {
    if (expiries.length > 0) setSelectedExpiry(expiries[0].label);
  }, [selectedIndex, expiries]);

  const selectedExpiryObj = expiries.find((e) => e.label === selectedExpiry);
  const daysToExpiry = selectedExpiryObj ? getDaysToExpiry(selectedExpiryObj.date) : 5;
  const strikeStep = instrument?.strikeStep || 50;

  const isSelected = useCallback(
    (strike: number, type: "CE" | "PE") => selectedStrikes.some((s) => s.strike === strike && s.type === type),
    [selectedStrikes]
  );

  const handleInstrumentChange = useCallback((symbol: string) => {
    setSelectedIndex(symbol);
    onInstrumentChange?.(symbol);
  }, [onInstrumentChange]);

  // Generate mock data with Greeks
  const mockData = useMemo(() => {
    const spot = getDefaultSpotPrice(selectedIndex);
    const step = strikeStep;
    const start = Math.round((spot - 15 * step) / step) * step;
    const rows: OptionRow[] = [];
    for (let i = 0; i < 30; i++) {
      const strike = start + i * step;
      const callIV = 12 + Math.random() * 8;
      const putIV = 12 + Math.random() * 8;
      const callGreeks = calcGreeks(spot, strike, callIV, daysToExpiry, true);
      const putGreeks = calcGreeks(spot, strike, putIV, daysToExpiry, false);
      const intrinsicCall = Math.max(0, spot - strike);
      const intrinsicPut = Math.max(0, strike - spot);
      rows.push({
        strike,
        callLTP: intrinsicCall + 20 + Math.random() * 50,
        callIV,
        callDelta: callGreeks.delta,
        callGamma: callGreeks.gamma,
        callTheta: callGreeks.theta,
        callVega: callGreeks.vega,
        callOI: Math.floor(Math.random() * 3000000),
        putLTP: intrinsicPut + 20 + Math.random() * 50,
        putIV,
        putDelta: putGreeks.delta,
        putGamma: putGreeks.gamma,
        putTheta: putGreeks.theta,
        putVega: putGreeks.vega,
        putOI: Math.floor(Math.random() * 3000000),
      });
    }
    return { rows, spot };
  }, [selectedIndex, strikeStep, daysToExpiry]);

  // Reset live data when instrument changes
  useEffect(() => {
    setLiveOptionData(null);
    setLiveSpotPrice(null);
  }, [selectedIndex]);

  const displayData = liveOptionData ?? mockData.rows;
  const displaySpot = liveSpotPrice ?? mockData.spot;
  const headers = ["OI", "Vega", "Theta", "Gamma", "Delta", "IV", "LTP"];

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{selectedIndex} Options Chain</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Spot: <span className="font-mono text-primary">{displaySpot.toLocaleString("en-IN")}</span>
              {instrument && (
                <span className="ml-2">
                  · Lot: {instrument.lotSize} · DTE: {daysToExpiry}d
                </span>
              )}
            </p>
          </div>
        </div>
        <InstrumentSelector selected={selectedIndex} onSelect={handleInstrumentChange} />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Expiry</span>
          <ExpirySelector expiries={expiries} selected={selectedExpiry} onSelect={setSelectedExpiry} />
        </div>
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border/50">
              <th colSpan={7} className="text-center text-[10px] text-profit uppercase tracking-wider py-2 bg-success/5">Calls</th>
              <th className="text-center text-[10px] text-muted-foreground uppercase tracking-wider py-2 bg-secondary/30">Strike</th>
              <th colSpan={7} className="text-center text-[10px] text-loss uppercase tracking-wider py-2 bg-destructive/5">Puts</th>
            </tr>
            <tr className="border-b border-border/50">
              {headers.map((h) => (
                <th key={`c-${h}`} className="text-right px-2 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">{h}</th>
              ))}
              <th className="text-center px-2 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider bg-secondary/20">Price</th>
              {[...headers].reverse().map((h) => (
                <th key={`p-${h}`} className="text-right px-2 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row) => {
              const isITMCall = row.strike < displaySpot;
              const isITMPut = row.strike > displaySpot;
              const isATM = Math.abs(row.strike - displaySpot) <= strikeStep / 2;
              const callSelected = isSelected(row.strike, "CE");
              const putSelected = isSelected(row.strike, "PE");

              return (
                <tr key={row.strike} className={cn("data-row", isATM && "bg-primary/5 border-l-2 border-r-2 border-primary/30")}>
                  <td className={cn("text-right px-2 py-2 font-mono", isITMCall && "bg-success/5")}>{formatNum(row.callOI)}</td>
                  <td className={cn("text-right px-2 py-2 font-mono text-muted-foreground", isITMCall && "bg-success/5")}>{row.callVega.toFixed(2)}</td>
                  <td className={cn("text-right px-2 py-2 font-mono text-loss", isITMCall && "bg-success/5")}>{row.callTheta.toFixed(2)}</td>
                  <td className={cn("text-right px-2 py-2 font-mono text-muted-foreground", isITMCall && "bg-success/5")}>{row.callGamma.toFixed(4)}</td>
                  <td className={cn("text-right px-2 py-2 font-mono font-semibold", isITMCall && "bg-success/5", row.callDelta >= 0 ? "text-profit" : "text-loss")}>{row.callDelta.toFixed(3)}</td>
                  <td className={cn("text-right px-2 py-2 font-mono text-muted-foreground", isITMCall && "bg-success/5")}>{row.callIV.toFixed(1)}</td>
                  <td
                    className={cn("text-right px-2 py-2 font-mono font-semibold cursor-pointer transition-colors", isITMCall && "bg-success/5", callSelected ? "text-primary bg-primary/10" : "text-foreground hover:text-primary hover:bg-primary/5")}
                    onClick={() => onStrikeSelect?.(row.strike, "CE", row.callLTP)}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {callSelected && <CheckSquare className="w-3 h-3" />}
                      {row.callLTP.toFixed(2)}
                    </div>
                  </td>
                  <td className="text-center px-2 py-2 font-mono font-bold text-foreground bg-secondary/20">{row.strike.toLocaleString()}</td>
                  <td
                    className={cn("text-right px-2 py-2 font-mono font-semibold cursor-pointer transition-colors", isITMPut && "bg-destructive/5", putSelected ? "text-primary bg-primary/10" : "text-foreground hover:text-primary hover:bg-primary/5")}
                    onClick={() => onStrikeSelect?.(row.strike, "PE", row.putLTP)}
                  >
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
                  <td className={cn("text-right px-2 py-2 font-mono", isITMPut && "bg-destructive/5")}>{formatNum(row.putOI)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OptionsChain;
