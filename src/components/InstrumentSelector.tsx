import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Search, X, TrendingUp, Building2 } from "lucide-react";
import { INDEX_INSTRUMENTS, FNO_STOCKS, type Instrument } from "@/lib/instruments";

interface InstrumentSelectorProps {
  selected: string;
  onSelect: (symbol: string) => void;
}

const InstrumentSelector = ({ selected, onSelect }: InstrumentSelectorProps) => {
  const [search, setSearch] = useState("");
  const [showStocks, setShowStocks] = useState(false);

  const filteredStocks = useMemo(() => {
    if (!search) return FNO_STOCKS.slice(0, 20);
    const q = search.toLowerCase();
    return FNO_STOCKS.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.industry?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [search]);

  const selectedInstrument =
    INDEX_INSTRUMENTS.find((i) => i.symbol === selected) ||
    FNO_STOCKS.find((s) => s.symbol === selected);

  return (
    <div className="space-y-2">
      {/* Index tabs */}
      <div className="flex gap-1 flex-wrap">
        {INDEX_INSTRUMENTS.map((idx) => (
          <button
            key={idx.symbol}
            onClick={() => {
              onSelect(idx.symbol);
              setShowStocks(false);
            }}
            className={cn(
              "px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors",
              selected === idx.symbol
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {idx.symbol}
          </button>
        ))}
        <div className="w-px h-6 bg-border self-center mx-1" />
        <button
          onClick={() => setShowStocks(!showStocks)}
          className={cn(
            "px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1",
            showStocks || FNO_STOCKS.some((s) => s.symbol === selected)
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          <Building2 className="w-3 h-3" />
          Stocks
        </button>
      </div>

      {/* Stock search panel */}
      {showStocks && (
        <div className="border border-border/50 rounded-lg p-3 bg-card/50 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search F&O stocks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-background border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 max-h-[200px] overflow-y-auto">
            {filteredStocks.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => {
                  onSelect(stock.symbol);
                  setShowStocks(false);
                  setSearch("");
                }}
                className={cn(
                  "text-left px-2 py-1.5 rounded text-[11px] transition-colors",
                  selected === stock.symbol
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-secondary text-foreground"
                )}
              >
                <div className="font-medium truncate">{stock.symbol}</div>
                <div className="text-[9px] text-muted-foreground truncate">
                  {stock.industry} · Lot {stock.lotSize}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected instrument info bar */}
      {selectedInstrument && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">{selectedInstrument.name}</span>
          <span>·</span>
          <span>Lot: {selectedInstrument.lotSize}</span>
          <span>·</span>
          <span>Step: ₹{selectedInstrument.strikeStep}</span>
          <span>·</span>
          <span>{selectedInstrument.exchange}</span>
        </div>
      )}
    </div>
  );
};

export default InstrumentSelector;
