import { cn } from "@/lib/utils";
import { Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { useBroker } from "@/hooks/useBroker";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Order {
  id: string;
  time: string;
  instrument: string;
  type: string;
  side: string;
  qty: number;
  price: number;
  status: string;
}

const statusConfig: Record<string, { icon: any; className: string }> = {
  COMPLETE: { icon: CheckCircle, className: "text-profit bg-success/10" },
  OPEN: { icon: Clock, className: "text-warning bg-warning/10" },
  PENDING: { icon: Clock, className: "text-warning bg-warning/10" },
  REJECTED: { icon: XCircle, className: "text-loss bg-destructive/10" },
  CANCELLED: { icon: AlertCircle, className: "text-muted-foreground bg-muted" },
};

function parseOrders(data: any): Order[] {
  if (!data || !Array.isArray(data)) return [];
  return data
    .filter((o: any) => o.stat === "Ok" || o.norenordno)
    .map((o: any) => {
      const tsym = o.tsym || "";
      const type = tsym.includes("CE") ? "CE" : tsym.includes("PE") ? "PE" : "EQ";
      return {
        id: o.norenordno || "",
        time: o.norentm ? o.norentm.split(" ")[1]?.substring(0, 8) || o.norentm : "",
        instrument: tsym,
        type,
        side: o.trantype === "B" ? "BUY" : "SELL",
        qty: parseInt(o.qty || "0", 10),
        price: parseFloat(o.prc || o.avgprc || "0"),
        status: (o.status || "").toUpperCase(),
      };
    });
}

const OrdersTable = () => {
  const { isConnected, getOrders } = useBroker();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchOrders = async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getOrders();
      const parsed = parseOrders(data);
      setOrders(parsed);
      if (parsed.length === 0) setError("No orders found today");
    } catch (err: any) {
      setError(err.message || "Failed to fetch orders");
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [isConnected]);

  const getStatusConfig = (status: string) =>
    statusConfig[status] || { icon: AlertCircle, className: "text-muted-foreground bg-muted" };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Order Book</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? "Loading..." : "Today's orders"}
          </p>
        </div>
        <button
          onClick={fetchOrders}
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
          Connect your broker to view orders
        </div>
      ) : error && orders.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-muted-foreground">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                {["Time", "Order ID", "Instrument", "Side", "Qty", "Price", "Status"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-muted-foreground font-medium uppercase tracking-wider text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const config = getStatusConfig(order.status);
                const StatusIcon = config.icon;
                return (
                  <tr key={order.id} className="data-row">
                    <td className="px-5 py-3 font-mono text-muted-foreground">{order.time}</td>
                    <td className="px-5 py-3 font-mono text-foreground">{order.id}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded",
                          order.type === "CE" ? "bg-success/10 text-profit" : order.type === "PE" ? "bg-destructive/10 text-loss" : "bg-muted text-muted-foreground"
                        )}>
                          {order.type}
                        </span>
                        <span className="font-mono text-foreground truncate max-w-[200px]">{order.instrument}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-1 rounded",
                        order.side === "BUY" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
                      )}>
                        {order.side}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-foreground">{order.qty}</td>
                    <td className="px-5 py-3 font-mono text-foreground">₹{order.price.toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded", config.className)}>
                        <StatusIcon className="w-3 h-3" />
                        {order.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OrdersTable;
