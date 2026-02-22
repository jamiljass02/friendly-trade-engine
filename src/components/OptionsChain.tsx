import { cn } from "@/lib/utils";
import { useState } from "react";

interface OptionData {
  strike: number;
  callOI: number;
  callOIChange: number;
  callLTP: number;
  callIV: number;
  putOI: number;
  putOIChange: number;
  putLTP: number;
  putIV: number;
}

const mockData: OptionData[] = [
  { strike: 23900, callOI: 1250000, callOIChange: 45000, callLTP: 340.50, callIV: 14.2, putOI: 890000, putOIChange: -12000, putLTP: 42.30, putIV: 15.8 },
  { strike: 24000, callOI: 2100000, callOIChange: 78000, callLTP: 260.20, callIV: 13.5, putOI: 1450000, putOIChange: 23000, putLTP: 62.40, putIV: 14.9 },
  { strike: 24100, callOI: 1800000, callOIChange: -15000, callLTP: 185.60, callIV: 12.8, putOI: 980000, putOIChange: 56000, putLTP: 88.50, putIV: 14.1 },
  { strike: 24150, callOI: 2500000, callOIChange: 120000, callLTP: 150.30, callIV: 12.3, putOI: 1200000, putOIChange: 34000, putLTP: 105.20, putIV: 13.6 },
  { strike: 24200, callOI: 3200000, callOIChange: 250000, callLTP: 112.80, callIV: 11.9, putOI: 1650000, putOIChange: 89000, putLTP: 128.60, putIV: 13.2 },
  { strike: 24250, callOI: 1900000, callOIChange: 67000, callLTP: 82.40, callIV: 11.5, putOI: 2100000, putOIChange: 145000, putLTP: 155.30, putIV: 12.8 },
  { strike: 24300, callOI: 2800000, callOIChange: 190000, callLTP: 58.60, callIV: 11.1, putOI: 2400000, putOIChange: 210000, putLTP: 185.70, putIV: 12.5 },
  { strike: 24400, callOI: 1500000, callOIChange: -45000, callLTP: 28.90, callIV: 10.8, putOI: 1800000, putOIChange: 78000, putLTP: 245.20, putIV: 12.1 },
];

const spotPrice = 24150;

const formatNum = (n: number) => {
  if (n >= 1000000) return (n / 100000).toFixed(1) + "L";
  if (n >= 1000) return (n / 1000).toFixed(0) + "K";
  return n.toString();
};

const OptionsChain = () => {
  const [selectedExpiry, setSelectedExpiry] = useState("27 Feb");
  const expiries = ["27 Feb", "6 Mar", "13 Mar", "27 Mar"];

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">NIFTY Options Chain</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Spot: <span className="font-mono text-primary">{spotPrice.toLocaleString()}</span></p>
        </div>
        <div className="flex gap-1">
          {expiries.map((exp) => (
            <button
              key={exp}
              onClick={() => setSelectedExpiry(exp)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                selectedExpiry === exp
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {exp}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              <th colSpan={4} className="text-center text-[10px] text-profit uppercase tracking-wider py-2 bg-success/5">Calls</th>
              <th className="text-center text-[10px] text-muted-foreground uppercase tracking-wider py-2 bg-secondary/30">Strike</th>
              <th colSpan={4} className="text-center text-[10px] text-loss uppercase tracking-wider py-2 bg-destructive/5">Puts</th>
            </tr>
            <tr className="border-b border-border/50">
              {["OI", "Chg", "LTP", "IV"].map(h => (
                <th key={`c-${h}`} className="text-right px-3 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">{h}</th>
              ))}
              <th className="text-center px-3 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider bg-secondary/20">Price</th>
              {["IV", "LTP", "Chg", "OI"].map(h => (
                <th key={`p-${h}`} className="text-right px-3 py-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockData.map((row) => {
              const isITMCall = row.strike < spotPrice;
              const isITMPut = row.strike > spotPrice;
              const isATM = row.strike === spotPrice;
              return (
                <tr
                  key={row.strike}
                  className={cn("data-row", isATM && "bg-primary/5 border-l-2 border-r-2 border-primary/30")}
                >
                  <td className={cn("text-right px-3 py-2.5 font-mono", isITMCall && "bg-success/5")}>
                    {formatNum(row.callOI)}
                  </td>
                  <td className={cn("text-right px-3 py-2.5 font-mono", isITMCall && "bg-success/5", row.callOIChange >= 0 ? "text-profit" : "text-loss")}>
                    {row.callOIChange >= 0 ? "+" : ""}{formatNum(row.callOIChange)}
                  </td>
                  <td className={cn("text-right px-3 py-2.5 font-mono font-semibold text-foreground", isITMCall && "bg-success/5")}>
                    {row.callLTP.toFixed(2)}
                  </td>
                  <td className={cn("text-right px-3 py-2.5 font-mono text-muted-foreground", isITMCall && "bg-success/5")}>
                    {row.callIV.toFixed(1)}
                  </td>
                  <td className="text-center px-3 py-2.5 font-mono font-bold text-foreground bg-secondary/20">
                    {row.strike.toLocaleString()}
                  </td>
                  <td className={cn("text-right px-3 py-2.5 font-mono text-muted-foreground", isITMPut && "bg-destructive/5")}>
                    {row.putIV.toFixed(1)}
                  </td>
                  <td className={cn("text-right px-3 py-2.5 font-mono font-semibold text-foreground", isITMPut && "bg-destructive/5")}>
                    {row.putLTP.toFixed(2)}
                  </td>
                  <td className={cn("text-right px-3 py-2.5 font-mono", isITMPut && "bg-destructive/5", row.putOIChange >= 0 ? "text-profit" : "text-loss")}>
                    {row.putOIChange >= 0 ? "+" : ""}{formatNum(row.putOIChange)}
                  </td>
                  <td className={cn("text-right px-3 py-2.5 font-mono", isITMPut && "bg-destructive/5")}>
                    {formatNum(row.putOI)}
                  </td>
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
