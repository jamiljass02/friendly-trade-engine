import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDefaultSpotPrice, getInstrument } from "@/lib/instruments";
import { getUpcomingExpiries } from "@/lib/expiry-utils";
import type { StrategyLeg } from "./EnhancedStrategyBuilder";
import { useState } from "react";

interface StrategyTemplatesProps {
  onApply: (legs: Omit<StrategyLeg, "id">[]) => void;
  onClose: () => void;
}

type TemplateCategory = "index" | "stock" | "futures" | "cross";

interface Template {
  name: string;
  category: TemplateCategory;
  description: string;
  risk: "defined" | "unlimited";
  buildLegs: () => Omit<StrategyLeg, "id">[];
}

function makeExpiry(underlying: string): string {
  const inst = getInstrument(underlying);
  const isWeekly = inst?.type === "index" ? (inst as any).weeklyExpiry : false;
  const expiries = getUpcomingExpiries(isWeekly, 2);
  return expiries[0]?.label || "";
}

function mockLTP(spot: number, strike: number, isCall: boolean): number {
  const intrinsic = isCall ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  return Math.round((intrinsic + 20 + Math.random() * 60) * 100) / 100;
}

const SM = { strikeMode: "spot_based" as const, strikeSelection: "ATM" as const };

const templates: Template[] = [
  {
    name: "Short Straddle (Nifty)",
    category: "index",
    description: "Sell ATM CE + PE. Profit from low volatility.",
    risk: "unlimited",
    buildLegs: () => {
      const spot = getDefaultSpotPrice("NIFTY");
      const step = 50;
      const atm = Math.round(spot / step) * step;
      const expiry = makeExpiry("NIFTY");
      return [
        { ...SM, underlying: "NIFTY", instrumentType: "index_option", action: "SELL", optionType: "CE", strike: atm, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: mockLTP(spot, atm, true) },
        { ...SM, underlying: "NIFTY", instrumentType: "index_option", action: "SELL", optionType: "PE", strike: atm, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: mockLTP(spot, atm, false) },
      ];
    },
  },
  {
    name: "Iron Condor (Bank Nifty)",
    category: "index",
    description: "Defined-risk range-bound strategy on Bank Nifty.",
    risk: "defined",
    buildLegs: () => {
      const spot = getDefaultSpotPrice("BANKNIFTY");
      const step = 100;
      const atm = Math.round(spot / step) * step;
      const expiry = makeExpiry("BANKNIFTY");
      return [
        { ...SM, underlying: "BANKNIFTY", instrumentType: "index_option", action: "SELL", optionType: "CE", strike: atm + step * 3, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: mockLTP(spot, atm + step * 3, true) },
        { ...SM, underlying: "BANKNIFTY", instrumentType: "index_option", action: "BUY", optionType: "CE", strike: atm + step * 5, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: mockLTP(spot, atm + step * 5, true) },
        { ...SM, underlying: "BANKNIFTY", instrumentType: "index_option", action: "SELL", optionType: "PE", strike: atm - step * 3, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: mockLTP(spot, atm - step * 3, false) },
        { ...SM, underlying: "BANKNIFTY", instrumentType: "index_option", action: "BUY", optionType: "PE", strike: atm - step * 5, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: mockLTP(spot, atm - step * 5, false) },
      ];
    },
  },
  {
    name: "Long Strangle (Nifty)",
    category: "index",
    description: "Buy OTM CE + PE. Profit from big moves.",
    risk: "defined",
    buildLegs: () => {
      const spot = getDefaultSpotPrice("NIFTY");
      const step = 50;
      const atm = Math.round(spot / step) * step;
      const expiry = makeExpiry("NIFTY");
      return [
        { ...SM, underlying: "NIFTY", instrumentType: "index_option", action: "BUY", optionType: "CE", strike: atm + step * 4, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: mockLTP(spot, atm + step * 4, true) },
        { ...SM, underlying: "NIFTY", instrumentType: "index_option", action: "BUY", optionType: "PE", strike: atm - step * 4, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: mockLTP(spot, atm - step * 4, false) },
      ];
    },
  },
  {
    name: "Covered Call (Reliance)",
    category: "stock",
    description: "Buy stock future + sell OTM CE.",
    risk: "unlimited",
    buildLegs: () => {
      const spot = getDefaultSpotPrice("RELIANCE");
      const step = 20;
      const atm = Math.round(spot / step) * step;
      const expiry = makeExpiry("RELIANCE");
      return [
        { ...SM, underlying: "RELIANCE", instrumentType: "stock_future", action: "BUY", futureType: "near" as const, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: spot },
        { ...SM, underlying: "RELIANCE", instrumentType: "stock_option", action: "SELL", optionType: "CE", strike: atm + step * 3, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: mockLTP(spot, atm + step * 3, true) },
      ];
    },
  },
  {
    name: "Protective Put (HDFC Bank)",
    category: "stock",
    description: "Buy stock future + buy OTM PE for protection.",
    risk: "defined",
    buildLegs: () => {
      const spot = getDefaultSpotPrice("HDFCBANK");
      const step = 10;
      const atm = Math.round(spot / step) * step;
      const expiry = makeExpiry("HDFCBANK");
      return [
        { ...SM, underlying: "HDFCBANK", instrumentType: "stock_future", action: "BUY", futureType: "near" as const, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: spot },
        { ...SM, underlying: "HDFCBANK", instrumentType: "stock_option", action: "BUY", optionType: "PE", strike: atm - step * 5, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: mockLTP(spot, atm - step * 5, false) },
      ];
    },
  },
  {
    name: "Bull Call Spread (TCS)",
    category: "stock",
    description: "Buy ATM CE + Sell OTM CE. Bullish with defined risk.",
    risk: "defined",
    buildLegs: () => {
      const spot = getDefaultSpotPrice("TCS");
      const step = 20;
      const atm = Math.round(spot / step) * step;
      const expiry = makeExpiry("TCS");
      return [
        { ...SM, underlying: "TCS", instrumentType: "stock_option", action: "BUY", optionType: "CE", strike: atm, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: mockLTP(spot, atm, true) },
        { ...SM, underlying: "TCS", instrumentType: "stock_option", action: "SELL", optionType: "CE", strike: atm + step * 3, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: mockLTP(spot, atm + step * 3, true) },
      ];
    },
  },
  {
    name: "Calendar Spread (Nifty Futures)",
    category: "futures",
    description: "Sell near-month + buy far-month future.",
    risk: "defined",
    buildLegs: () => {
      const spot = getDefaultSpotPrice("NIFTY");
      const expiries = getUpcomingExpiries(true, 4);
      return [
        { ...SM, underlying: "NIFTY", instrumentType: "index_future", action: "SELL", futureType: "near" as const, expiry: expiries[0]?.label || "", lots: 1, entryType: "MKT", validity: "DAY", ltp: spot },
        { ...SM, underlying: "NIFTY", instrumentType: "index_future", action: "BUY", futureType: "far" as const, expiry: expiries[2]?.label || "", lots: 1, entryType: "MKT", validity: "DAY", ltp: spot + 50 },
      ];
    },
  },
  {
    name: "Index Hedge for Stock",
    category: "cross",
    description: "Long stock future + buy Nifty PE for index hedge.",
    risk: "defined",
    buildLegs: () => {
      const stockSpot = getDefaultSpotPrice("RELIANCE");
      const niftySpot = getDefaultSpotPrice("NIFTY");
      const niftyATM = Math.round(niftySpot / 50) * 50;
      const expiry = makeExpiry("NIFTY");
      return [
        { ...SM, underlying: "RELIANCE", instrumentType: "stock_future", action: "BUY", futureType: "near" as const, expiry: makeExpiry("RELIANCE"), lots: 1, entryType: "MKT", validity: "DAY", ltp: stockSpot },
        { ...SM, underlying: "NIFTY", instrumentType: "index_option", action: "BUY", optionType: "PE", strike: niftyATM - 200, expiry, lots: 1, entryType: "MKT", validity: "DAY", ltp: mockLTP(niftySpot, niftyATM - 200, false) },
      ];
    },
  },
];

const categoryLabels: Record<TemplateCategory, string> = {
  index: "Index Strategies",
  stock: "Stock Strategies",
  futures: "Futures",
  cross: "Cross-Asset",
};

const StrategyTemplates = ({ onApply, onClose }: StrategyTemplatesProps) => {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>("index");

  const filtered = templates.filter((t) => t.category === activeCategory);

  return (
    <div className="border-b border-border/50 bg-secondary/10">
      <div className="px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(Object.keys(categoryLabels) as TemplateCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-2.5 py-1 rounded text-[10px] font-medium transition-colors",
                activeCategory === cat
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="px-5 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {filtered.map((t) => (
          <button
            key={t.name}
            onClick={() => onApply(t.buildLegs())}
            className="text-left p-3 rounded-lg bg-card hover:bg-secondary/50 border border-border/30 hover:border-primary/30 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                {t.name}
              </span>
              <span
                className={cn(
                  "text-[9px] font-medium px-1.5 py-0.5 rounded",
                  t.risk === "defined"
                    ? "bg-success/10 text-profit"
                    : "bg-warning/10 text-warning"
                )}
              >
                {t.risk === "defined" ? "Defined" : "Unlimited"}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">{t.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StrategyTemplates;
