import {
  isOrderComplete,
  isOrderFinal,
  normalizeOrderBook,
  roundToTick,
} from "@/lib/broker-order-utils";

export interface StopOrderWatch {
  stopOrderId: string;
  symbol: string;
  quantity: number;
  exchange: string;
  entryPrice: number;
}

export async function monitorMoveToCost({
  watchList,
  getOrders,
  modifyOrder,
  tickSize,
  onMoved,
}: {
  watchList: StopOrderWatch[];
  getOrders: () => Promise<unknown>;
  modifyOrder: (params: {
    order_id: string;
    exchange?: string;
    tradingsymbol: string;
    quantity: number;
    price?: number;
    trigger_price?: number;
    order_type?: string;
  }) => Promise<unknown>;
  tickSize: number;
  onMoved?: () => void;
}) {
  if (watchList.length < 2) return false;

  const active = new Map(watchList.map((item) => [item.stopOrderId, item]));

  for (let attempt = 0; attempt < 120 && active.size > 1; attempt++) {
    try {
      const ordersPayload = await getOrders();
      const orders = normalizeOrderBook(ordersPayload);

      let triggered: StopOrderWatch | null = null;

      for (const item of active.values()) {
        const order = orders.find((row) => {
          const candidate = row.norenordno ?? row.order_id ?? row.orderno ?? row.orderid;
          return candidate && String(candidate) === item.stopOrderId;
        });

        if (!order) continue;
        if (isOrderComplete(order)) {
          triggered = item;
          break;
        }
        if (isOrderFinal(order)) {
          active.delete(item.stopOrderId);
        }
      }

      if (triggered) {
        const siblings = Array.from(active.values()).filter((item) => item.stopOrderId !== triggered.stopOrderId);

        for (const sibling of siblings) {
          await modifyOrder({
            order_id: sibling.stopOrderId,
            tradingsymbol: sibling.symbol,
            quantity: sibling.quantity,
            trigger_price: roundToTick(sibling.entryPrice, tickSize),
            order_type: "SL-MKT",
            price: 0,
            exchange: sibling.exchange,
          });
        }

        onMoved?.();
        return true;
      }
    } catch {
      // keep polling
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}