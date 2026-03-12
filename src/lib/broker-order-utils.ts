export type BrokerOrderRow = Record<string, unknown>;

export function roundToTick(price: number, tickSize = 0.05): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const ticks = Math.round(price / tickSize);
  return Number((ticks * tickSize).toFixed(2));
}

export function getBrokerOrderId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const row = payload as Record<string, unknown>;
  const candidate = row.norenordno ?? row.order_id ?? row.orderno ?? row.orderid;
  return candidate ? String(candidate) : null;
}

export function normalizeOrderBook(payload: unknown): BrokerOrderRow[] {
  if (Array.isArray(payload)) return payload as BrokerOrderRow[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.values)) return record.values as BrokerOrderRow[];
    if (Array.isArray(record.orders)) return record.orders as BrokerOrderRow[];
    if (Array.isArray(record.data)) return record.data as BrokerOrderRow[];
  }
  return [];
}

export function getOrderStatus(order: BrokerOrderRow | null | undefined): string {
  if (!order) return "";
  const status = order.status ?? order.stat ?? order.orderstatus;
  return String(status ?? "").trim().toUpperCase();
}

export function isOrderComplete(order: BrokerOrderRow | null | undefined): boolean {
  const status = getOrderStatus(order);
  return status.includes("COMPLETE") || status.includes("FILLED") || status.includes("EXECUTED") || status.includes("TRADED");
}

export function isOrderFinal(order: BrokerOrderRow | null | undefined): boolean {
  const status = getOrderStatus(order);
  return (
    isOrderComplete(order) ||
    status.includes("REJECT") ||
    status.includes("CANCEL") ||
    status.includes("EXPIRED")
  );
}

export function getOrderFillPrice(order: BrokerOrderRow | null | undefined, fallbackPrice: number): number {
  if (!order) return fallbackPrice;
  const candidates = [order.avgprc, order.avg_price, order.fill_price, order.prc, order.price, order.trdprc];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallbackPrice;
}

export async function waitForOrderFill({
  orderId,
  getOrders,
  retries = 12,
  intervalMs = 900,
}: {
  orderId: string;
  getOrders: () => Promise<unknown>;
  retries?: number;
  intervalMs?: number;
}): Promise<{ state: "filled" | "rejected" | "timeout"; order: BrokerOrderRow | null }> {
  const normalizedId = String(orderId);

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const payload = await getOrders();
      const orders = normalizeOrderBook(payload);
      const matched = orders.find((row) => {
        const candidate = row.norenordno ?? row.order_id ?? row.orderno ?? row.orderid;
        return candidate && String(candidate) === normalizedId;
      }) ?? null;

      if (matched) {
        if (isOrderComplete(matched)) return { state: "filled", order: matched };
        if (isOrderFinal(matched)) return { state: "rejected", order: matched };
      }
    } catch {
      // keep polling
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return { state: "timeout", order: null };
}
