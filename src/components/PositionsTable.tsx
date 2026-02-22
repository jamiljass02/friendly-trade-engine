import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Position {
  id: string;
  symbol: string;
  type: "CE" | "PE";
  strike: number;
  expiry: string;
  qty: number;
  side: "BUY" | "SELL";
  avgPrice: number;
  ltp: number;
  pnl: number;
  pnlPercent: number;
}

const mockPositions: Position[] = [
  { id: "1", symbol: "NIFTY", type: "CE", strike: 24200, expiry: "27 Feb", qty: 50, side: "BUY", avgPrice: 185.50, ltp: 210.30, pnl: 1240, pnlPercent: 13.4 },
  { id: "2", symbol: "NIFTY", type: "PE", strike: 24000, expiry: "27 Feb", qty: 50, side: "SELL", avgPrice: 120.00, ltp: 95.20, pnl: 1240, pnlPercent: 20.7 },
  { id: "3", symbol: "BANKNIFTY", type: "CE", strike: 51500, expiry: "26 Feb", qty: 15, side: "BUY", avgPrice: 450.00, ltp: 385.60, pnl: -966, pnlPercent: -14.3 },
  { id: "4", symbol: "NIFTY", type: "CE", strike: 24300, expiry: "27 Feb", qty: 50, side: "SELL", avgPrice: 95.00, ltp: 88.40, pnl: 330, pnlPercent: 6.9 },
  { id: "5", symbol: "BANKNIFTY", type: "PE", strike: 51000, expiry: "26 Feb", qty: 15, side: "BUY", avgPrice: 280.00, ltp: 310.50, pnl: 457.5, pnlPercent: 10.9 },
];

const PositionsTable = () => {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50">
        <h3 className="text-sm font-semibold text-foreground">Open Positions</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{mockPositions.length} active positions</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              {["Instrument", "Side", "Qty", "Avg Price", "LTP", "P&L", ""].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-muted-foreground font-medium uppercase tracking-wider text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockPositions.map((pos) => (
              <tr key={pos.id} className="data-row">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded",
                      pos.type === "CE" ? "bg-success/10 text-profit" : "bg-destructive/10 text-loss"
                    )}>
                      {pos.type}
                    </span>
                    <div>
                      <span className="font-mono font-semibold text-foreground">{pos.symbol} {pos.strike}</span>
                      <span className="text-muted-foreground ml-2">{pos.expiry}</span>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-1 rounded",
                    pos.side === "BUY" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
                  )}>
                    {pos.side}
                  </span>
                </td>
                <td className="px-5 py-3 font-mono text-foreground">{pos.qty}</td>
                <td className="px-5 py-3 font-mono text-foreground">₹{pos.avgPrice.toFixed(2)}</td>
                <td className="px-5 py-3 font-mono text-foreground">₹{pos.ltp.toFixed(2)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    {pos.pnl >= 0 ? (
                      <ArrowUpRight className="w-3 h-3 text-profit" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 text-loss" />
                    )}
                    <span className={cn("font-mono font-semibold", pos.pnl >= 0 ? "text-profit" : "text-loss")}>
                      {pos.pnl >= 0 ? "+" : ""}₹{pos.pnl.toFixed(0)}
                    </span>
                    <span className={cn("text-[10px]", pos.pnl >= 0 ? "text-profit" : "text-loss")}>
                      ({pos.pnlPercent > 0 ? "+" : ""}{pos.pnlPercent}%)
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <button className="text-[10px] text-muted-foreground hover:text-destructive transition-colors uppercase tracking-wider font-medium">
                    Exit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PositionsTable;
