import { TrendingUp, TrendingDown } from "lucide-react";
import { useIndexPrices } from "@/hooks/useIndexPrices";
import { cn } from "@/lib/utils";

const topStocks = [
  { name: "RELIANCE", price: 2847, change: 1.2 },
  { name: "TCS", price: 4215, change: -0.8 },
  { name: "HDFCBANK", price: 1678, change: 0.5 },
  { name: "INFY", price: 1892, change: -1.1 },
  { name: "ICICIBANK", price: 1245, change: 0.9 },
  { name: "SBIN", price: 825, change: 1.5 },
  { name: "BHARTIARTL", price: 1156, change: -0.3 },
  { name: "ITC", price: 478, change: 0.7 },
];

const TickerTape = () => {
  const { prices } = useIndexPrices();

  const allTickers = [
    ...prices.map((p) => ({
      name: p.name,
      price: p.price,
      change: p.changePercent,
      isIndex: true,
    })),
    ...topStocks.map((s) => ({
      name: s.name,
      price: s.price,
      change: s.change,
      isIndex: false,
    })),
  ];

  // Duplicate for seamless loop
  const tickers = [...allTickers, ...allTickers];

  return (
    <div className="w-full overflow-hidden bg-card/50 border-b border-border">
      <div className="flex animate-ticker whitespace-nowrap py-1.5">
        {tickers.map((t, i) => (
          <div
            key={`${t.name}-${i}`}
            className="inline-flex items-center gap-2 px-4 border-r border-border/30 last:border-0"
          >
            <span
              className={cn(
                "text-[11px] font-medium",
                t.isIndex ? "text-primary" : "text-muted-foreground"
              )}
            >
              {t.name}
            </span>
            <span className="text-[11px] font-mono font-semibold text-foreground">
              {t.price > 0
                ? t.price.toLocaleString("en-IN", { maximumFractionDigits: 1 })
                : "—"}
            </span>
            {t.price > 0 && (
              <span
                className={cn(
                  "text-[10px] font-mono flex items-center gap-0.5",
                  t.change >= 0 ? "text-profit" : "text-loss"
                )}
              >
                {t.change >= 0 ? (
                  <TrendingUp className="w-2.5 h-2.5" />
                ) : (
                  <TrendingDown className="w-2.5 h-2.5" />
                )}
                {t.change >= 0 ? "+" : ""}
                {t.change.toFixed(1)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TickerTape;
