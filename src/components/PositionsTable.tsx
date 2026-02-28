import { ArrowUpRight, ArrowDownRight, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBroker } from "@/hooks/useBroker";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Position {
  symbol: string;
  type: string;
  qty: number;
  side: string;
  avgPrice: number;
  ltp: number;
  pnl: number;
  pnlPercent: number;
  rawData?: Record<string, unknown>;
}

function parsePositions(data: any): Position[] {
  if (!data || !Array.isArray(data)) return [];
  return data
    .filter((p: any) => p.stat === "Ok" || p.tsym)
    .map((p: any) => {
      const netQty = parseInt(p.netqty || p.daybuyqty || "0", 10);
      const avgPrice = parseFloat(p.netavgprc || p.daybuyavgprc || "0");
      const ltp = parseFloat(p.lp || "0");
      const pnl = parseFloat(p.rpnl || p.urmtom || "0") + parseFloat(p.urmtom || "0");
      const cost = avgPrice * Math.abs(netQty);
      const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
      const tsym = p.tsym || "";
      const type = tsym.includes("CE") ? "CE" : tsym.includes("PE") ? "PE" : "EQ";

      return {
        symbol: tsym,
        type,
        qty: Math.abs(netQty),
        side: netQty >= 0 ? "BUY" : "SELL",
        avgPrice,
        ltp,
        pnl,
        pnlPercent,
        rawData: p,
      };
    })
    .filter((p: Position) => p.qty > 0);
}

const PositionsTable = () => {
  const { isConnected, getPositions } = useBroker();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPositions = async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getPositions();
      const parsed = parsePositions(data);
      setPositions(parsed);
      if (parsed.length === 0) {
        setError("No open positions found");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch positions");
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [isConnected]);

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Open Positions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? "Loading..." : `${positions.length} active positions`}
          </p>
        </div>
        <button
          onClick={fetchPositions}
          disabled={loading || !isConnected}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      </div>

      {!isConnected ? (
        <div className="px-5 py-8 text-center text-xs text-muted-foreground">
          Connect your broker to view positions
        </div>
      ) : error && positions.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-muted-foreground">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                {["Instrument", "Side", "Qty", "Avg Price", "LTP", "P&L"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-muted-foreground font-medium uppercase tracking-wider text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((pos, i) => (
                <tr key={i} className="data-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded",
                        pos.type === "CE" ? "bg-success/10 text-profit" : pos.type === "PE" ? "bg-destructive/10 text-loss" : "bg-muted text-muted-foreground"
                      )}>
                        {pos.type}
                      </span>
                      <span className="font-mono font-semibold text-foreground truncate max-w-[200px]">{pos.symbol}</span>
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
                        ({pos.pnlPercent > 0 ? "+" : ""}{pos.pnlPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PositionsTable;
