import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Position } from "@/hooks/usePositions";

const INDICES = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"];

function extractUnderlying(symbol: string): string {
  const match = symbol.match(/^([A-Z&]+)\d/);
  return match ? match[1] : symbol;
}

function extractStrike(symbol: string): number {
  const match = symbol.match(/(\d+)(?:CE|PE)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function extractExpiry(symbol: string): string {
  const match = symbol.match(/(\d{2}[A-Z]{3}\d{2})/);
  return match ? match[1] : "";
}

type SortKey = "symbol" | "type" | "side" | "qty" | "avgPrice" | "ltp" | "pnl" | "pnlPercent";
type SortDir = "asc" | "desc";

interface DetailedPositionsTableProps {
  positions: Position[];
  loading: boolean;
}

const DetailedPositionsTable = ({ positions, loading }: DetailedPositionsTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [assetFilter, setAssetFilter] = useState<"all" | "index" | "stock">("all");
  const [expiryFilter, setExpiryFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<"all" | "BUY" | "SELL">("all");

  const expiries = useMemo(() => {
    const set = new Set(positions.map((p) => extractExpiry(p.symbol)).filter(Boolean));
    return Array.from(set).sort();
  }, [positions]);

  const filtered = useMemo(() => {
    return positions.filter((p) => {
      const underlying = extractUnderlying(p.symbol);
      const isIndex = INDICES.includes(underlying);
      if (assetFilter === "index" && !isIndex) return false;
      if (assetFilter === "stock" && isIndex) return false;
      if (expiryFilter !== "all" && extractExpiry(p.symbol) !== expiryFilter) return false;
      if (directionFilter !== "all" && p.side !== directionFilter) return false;
      return true;
    });
  }, [positions, assetFilter, expiryFilter, directionFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "symbol") cmp = a.symbol.localeCompare(b.symbol);
      else cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const exportCSV = () => {
    const headers = ["Symbol", "Instrument Type", "Option Type", "Strike", "Expiry", "Qty", "Side", "Buy Avg", "LTP", "P&L", "P&L %"];
    const rows = sorted.map((p) => [
      p.symbol,
      INDICES.includes(extractUnderlying(p.symbol)) ? "Index" : "Stock",
      p.type,
      extractStrike(p.symbol),
      extractExpiry(p.symbol),
      p.qty,
      p.side,
      p.avgPrice.toFixed(2),
      p.ltp.toFixed(2),
      p.pnl.toFixed(2),
      p.pnlPercent.toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `positions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const columns: { key: SortKey; label: string; mono?: boolean }[] = [
    { key: "symbol", label: "Symbol" },
    { key: "type", label: "Inst / Opt Type" },
    { key: "side", label: "Strike / Expiry" },
    { key: "qty", label: "Qty", mono: true },
    { key: "avgPrice", label: "Buy Avg", mono: true },
    { key: "ltp", label: "LTP", mono: true },
    { key: "pnl", label: "P&L", mono: true },
    { key: "pnlPercent", label: "P&L %", mono: true },
  ];

  const greeksForPos = (p: Position) => {
    const mult = p.side === "BUY" ? 1 : -1;
    const delta = p.type === "CE" ? 0.5 * mult : p.type === "PE" ? -0.5 * mult : mult;
    const theta = p.type !== "FUT" ? (p.side === "SELL" ? 1 : -1) * p.ltp * 0.05 : 0;
    return { delta: (delta * p.qty).toFixed(1), theta: theta.toFixed(0) };
  };

  return (
    <div className="space-y-3">
      {/* Filters + Export */}
      <div className="glass-card rounded-xl px-5 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              {(["all", "index", "stock"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setAssetFilter(f)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors capitalize",
                    assetFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f === "all" ? "All" : f === "index" ? "Index" : "Stock"}
                </button>
              ))}
            </div>

            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value)}
              className="text-[10px] bg-muted text-foreground rounded-lg px-2 py-1.5 border border-border/50 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Expiries</option>
              {expiries.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>

            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              {(["all", "BUY", "SELL"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setDirectionFilter(f)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors",
                    directionFilter === f ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f === "all" ? "All" : f}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/30">
                {["Symbol", "Instrument", "Option", "Strike", "Expiry", "Qty", "Buy Avg", "LTP", "P&L", "P&L %", "Δ", "Θ", "Actions"].map((h) => {
                  const sortable: Record<string, SortKey> = {
                    Symbol: "symbol", Qty: "qty", "Buy Avg": "avgPrice", LTP: "ltp", "P&L": "pnl", "P&L %": "pnlPercent",
                  };
                  const sk = sortable[h];
                  return (
                    <th
                      key={h}
                      onClick={sk ? () => handleSort(sk) : undefined}
                      className={cn(
                        "text-left px-3 py-2.5 text-muted-foreground font-medium text-[10px] uppercase tracking-wider",
                        sk && "cursor-pointer hover:text-foreground select-none"
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {h}
                        {sk && <SortIcon col={sk} />}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((pos, i) => {
                const underlying = extractUnderlying(pos.symbol);
                const isIndex = INDICES.includes(underlying);
                const greeks = greeksForPos(pos);
                return (
                  <tr key={i} className="data-row group">
                    <td className="px-3 py-2.5 font-mono text-foreground text-[11px] truncate max-w-[180px]">{pos.symbol}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded",
                        isIndex ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent-foreground"
                      )}>{isIndex ? "INDEX" : "STOCK"}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                        pos.type === "CE" ? "bg-success/10 text-profit" : pos.type === "PE" ? "bg-destructive/10 text-loss" : "bg-muted text-muted-foreground"
                      )}>{pos.type}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-foreground text-[11px]">{extractStrike(pos.symbol) || "—"}</td>
                    <td className="px-3 py-2.5 text-[10px] text-muted-foreground">{extractExpiry(pos.symbol) || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-foreground">
                      <span className={cn(pos.side === "BUY" ? "text-profit" : "text-loss")}>
                        {pos.side === "SELL" ? "-" : ""}{pos.qty}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-foreground">₹{pos.avgPrice.toFixed(2)}</td>
                    <td className="px-3 py-2.5 font-mono text-foreground">₹{pos.ltp.toFixed(2)}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("font-mono font-semibold", pos.pnl >= 0 ? "text-profit" : "text-loss")}>
                        {pos.pnl >= 0 ? "+" : ""}₹{Math.abs(pos.pnl).toFixed(0)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("font-mono text-[10px] font-semibold", pos.pnlPercent >= 0 ? "text-profit" : "text-loss")}>
                        {pos.pnlPercent >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">{greeks.delta}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">{greeks.theta}</td>
                    <td className="px-3 py-2.5">
                      <button className="text-[9px] font-medium px-2 py-1 rounded bg-destructive/10 text-loss hover:bg-destructive/20 transition-colors opacity-0 group-hover:opacity-100">
                        Exit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sorted.length === 0 && !loading && (
          <div className="px-5 py-8 text-center text-xs text-muted-foreground">
            No positions match the current filters.
          </div>
        )}

        {/* Footer summary */}
        {sorted.length > 0 && (
          <div className="border-t border-border/50 px-4 py-2.5 flex items-center justify-between bg-secondary/10">
            <span className="text-[10px] text-muted-foreground">{sorted.length} positions</span>
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-muted-foreground">
                Total P&L:{" "}
                <span className={cn("font-mono font-bold", sorted.reduce((s, p) => s + p.pnl, 0) >= 0 ? "text-profit" : "text-loss")}>
                  {sorted.reduce((s, p) => s + p.pnl, 0) >= 0 ? "+" : ""}₹{Math.abs(sorted.reduce((s, p) => s + p.pnl, 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailedPositionsTable;
