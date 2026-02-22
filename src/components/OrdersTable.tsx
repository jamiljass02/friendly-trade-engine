import { cn } from "@/lib/utils";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface Order {
  id: string;
  time: string;
  instrument: string;
  type: "CE" | "PE";
  strike: number;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  status: "EXECUTED" | "PENDING" | "REJECTED" | "CANCELLED";
  strategy?: string;
}

const mockOrders: Order[] = [
  { id: "ORD001", time: "09:15:32", instrument: "NIFTY", type: "CE", strike: 24200, side: "BUY", qty: 50, price: 185.50, status: "EXECUTED", strategy: "Bull Call Spread" },
  { id: "ORD002", time: "09:15:33", instrument: "NIFTY", type: "CE", strike: 24300, side: "SELL", qty: 50, price: 95.00, status: "EXECUTED", strategy: "Bull Call Spread" },
  { id: "ORD003", time: "09:45:12", instrument: "BANKNIFTY", type: "CE", strike: 51500, side: "BUY", qty: 15, price: 450.00, status: "EXECUTED" },
  { id: "ORD004", time: "10:30:05", instrument: "NIFTY", type: "PE", strike: 24000, side: "SELL", qty: 50, price: 120.00, status: "PENDING" },
  { id: "ORD005", time: "11:15:22", instrument: "BANKNIFTY", type: "PE", strike: 51000, side: "BUY", qty: 15, price: 280.00, status: "REJECTED" },
  { id: "ORD006", time: "12:00:10", instrument: "NIFTY", type: "CE", strike: 24250, side: "BUY", qty: 50, price: 140.00, status: "CANCELLED" },
];

const statusConfig = {
  EXECUTED: { icon: CheckCircle, className: "text-profit bg-success/10" },
  PENDING: { icon: Clock, className: "text-warning bg-warning/10" },
  REJECTED: { icon: XCircle, className: "text-loss bg-destructive/10" },
  CANCELLED: { icon: AlertCircle, className: "text-muted-foreground bg-muted" },
};

const OrdersTable = () => {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50">
        <h3 className="text-sm font-semibold text-foreground">Order Book</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Today's orders</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              {["Time", "Order ID", "Instrument", "Side", "Qty", "Price", "Strategy", "Status"].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-muted-foreground font-medium uppercase tracking-wider text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockOrders.map((order) => {
              const StatusIcon = statusConfig[order.status].icon;
              return (
                <tr key={order.id} className="data-row">
                  <td className="px-5 py-3 font-mono text-muted-foreground">{order.time}</td>
                  <td className="px-5 py-3 font-mono text-foreground">{order.id}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded",
                        order.type === "CE" ? "bg-success/10 text-profit" : "bg-destructive/10 text-loss"
                      )}>
                        {order.type}
                      </span>
                      <span className="font-mono text-foreground">{order.instrument} {order.strike}</span>
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
                  <td className="px-5 py-3 text-muted-foreground">{order.strategy || "—"}</td>
                  <td className="px-5 py-3">
                    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded", statusConfig[order.status].className)}>
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
    </div>
  );
};

export default OrdersTable;
