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
  { strike: 23400, callOI: 450000, callOIChange: 12000, callLTP: 780.20, callIV: 18.5, putOI: 120000, putOIChange: -5000, putLTP: 2.10, putIV: 22.1 },
  { strike: 23450, callOI: 520000, callOIChange: 18000, callLTP: 735.60, callIV: 17.9, putOI: 150000, putOIChange: 3000, putLTP: 3.40, putIV: 21.5 },
  { strike: 23500, callOI: 680000, callOIChange: -8000, callLTP: 690.30, callIV: 17.2, putOI: 210000, putOIChange: 8000, putLTP: 5.20, putIV: 20.8 },
  { strike: 23550, callOI: 730000, callOIChange: 25000, callLTP: 645.80, callIV: 16.8, putOI: 280000, putOIChange: -2000, putLTP: 7.80, putIV: 20.1 },
  { strike: 23600, callOI: 890000, callOIChange: 32000, callLTP: 598.40, callIV: 16.3, putOI: 340000, putOIChange: 11000, putLTP: 11.50, putIV: 19.4 },
  { strike: 23650, callOI: 950000, callOIChange: -15000, callLTP: 552.10, callIV: 15.9, putOI: 420000, putOIChange: 18000, putLTP: 16.20, putIV: 18.8 },
  { strike: 23700, callOI: 1100000, callOIChange: 42000, callLTP: 505.70, callIV: 15.5, putOI: 510000, putOIChange: -9000, putLTP: 22.40, putIV: 18.2 },
  { strike: 23750, callOI: 1050000, callOIChange: 28000, callLTP: 460.30, callIV: 15.1, putOI: 580000, putOIChange: 25000, putLTP: 28.90, putIV: 17.6 },
  { strike: 23800, callOI: 1180000, callOIChange: 55000, callLTP: 415.80, callIV: 14.8, putOI: 670000, putOIChange: 14000, putLTP: 35.60, putIV: 17.0 },
  { strike: 23850, callOI: 1320000, callOIChange: -22000, callLTP: 372.50, callIV: 14.5, putOI: 750000, putOIChange: -6000, putLTP: 38.20, putIV: 16.5 },
  { strike: 23900, callOI: 1250000, callOIChange: 45000, callLTP: 340.50, callIV: 14.2, putOI: 890000, putOIChange: -12000, putLTP: 42.30, putIV: 15.8 },
  { strike: 23950, callOI: 1400000, callOIChange: 62000, callLTP: 298.70, callIV: 13.8, putOI: 1020000, putOIChange: 32000, putLTP: 52.80, putIV: 15.3 },
  { strike: 24000, callOI: 2100000, callOIChange: 78000, callLTP: 260.20, callIV: 13.5, putOI: 1450000, putOIChange: 23000, putLTP: 62.40, putIV: 14.9 },
  { strike: 24050, callOI: 1750000, callOIChange: 35000, callLTP: 222.90, callIV: 13.1, putOI: 1120000, putOIChange: 45000, putLTP: 75.30, putIV: 14.5 },
  { strike: 24100, callOI: 1800000, callOIChange: -15000, callLTP: 185.60, callIV: 12.8, putOI: 980000, putOIChange: 56000, putLTP: 88.50, putIV: 14.1 },
  { strike: 24150, callOI: 2500000, callOIChange: 120000, callLTP: 150.30, callIV: 12.3, putOI: 1200000, putOIChange: 34000, putLTP: 105.20, putIV: 13.6 },
  { strike: 24200, callOI: 3200000, callOIChange: 250000, callLTP: 112.80, callIV: 11.9, putOI: 1650000, putOIChange: 89000, putLTP: 128.60, putIV: 13.2 },
  { strike: 24250, callOI: 1900000, callOIChange: 67000, callLTP: 82.40, callIV: 11.5, putOI: 2100000, putOIChange: 145000, putLTP: 155.30, putIV: 12.8 },
  { strike: 24300, callOI: 2800000, callOIChange: 190000, callLTP: 58.60, callIV: 11.1, putOI: 2400000, putOIChange: 210000, putLTP: 185.70, putIV: 12.5 },
  { strike: 24350, callOI: 2200000, callOIChange: 95000, callLTP: 40.20, callIV: 10.9, putOI: 1950000, putOIChange: 130000, putLTP: 210.40, putIV: 12.2 },
  { strike: 24400, callOI: 1500000, callOIChange: -45000, callLTP: 28.90, callIV: 10.8, putOI: 1800000, putOIChange: 78000, putLTP: 245.20, putIV: 12.1 },
  { strike: 24450, callOI: 1350000, callOIChange: 52000, callLTP: 20.10, callIV: 10.5, putOI: 1600000, putOIChange: 62000, putLTP: 278.50, putIV: 11.8 },
  { strike: 24500, callOI: 2900000, callOIChange: 180000, callLTP: 14.30, callIV: 10.3, putOI: 2800000, putOIChange: 195000, putLTP: 315.80, putIV: 11.5 },
  { strike: 24550, callOI: 1100000, callOIChange: 38000, callLTP: 9.80, callIV: 10.1, putOI: 1400000, putOIChange: 48000, putLTP: 352.40, putIV: 11.3 },
  { strike: 24600, callOI: 1650000, callOIChange: -28000, callLTP: 6.50, callIV: 9.9, putOI: 1250000, putOIChange: 35000, putLTP: 390.10, putIV: 11.1 },
  { strike: 24650, callOI: 980000, callOIChange: 22000, callLTP: 4.20, callIV: 9.7, putOI: 900000, putOIChange: -15000, putLTP: 428.70, putIV: 10.9 },
  { strike: 24700, callOI: 1450000, callOIChange: 65000, callLTP: 2.80, callIV: 9.5, putOI: 780000, putOIChange: 28000, putLTP: 468.30, putIV: 10.7 },
  { strike: 24750, callOI: 820000, callOIChange: -12000, callLTP: 1.70, callIV: 9.3, putOI: 620000, putOIChange: 18000, putLTP: 510.50, putIV: 10.5 },
  { strike: 24800, callOI: 1200000, callOIChange: 48000, callLTP: 0.95, callIV: 9.1, putOI: 540000, putOIChange: -8000, putLTP: 555.20, putIV: 10.3 },
  { strike: 24850, callOI: 680000, callOIChange: 15000, callLTP: 0.50, callIV: 8.9, putOI: 380000, putOIChange: 10000, putLTP: 598.80, putIV: 10.1 },
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
