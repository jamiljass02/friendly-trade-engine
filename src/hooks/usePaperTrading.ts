import { useState, useCallback, useRef } from "react";

export interface PaperPosition {
  id: string;
  symbol: string;
  instrument: string;
  type: "CE" | "PE" | "FUT" | "EQ";
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  timestamp: Date;
  strike?: number;
  expiry?: string;
}

export interface PaperOrder {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  orderType: "MARKET" | "LIMIT";
  status: "FILLED" | "PENDING" | "CANCELLED";
  timestamp: Date;
  fillPrice?: number;
}

export interface PaperPortfolio {
  initialCapital: number;
  currentCapital: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  marginUsed: number;
  positions: PaperPosition[];
  orders: PaperOrder[];
  tradeHistory: PaperOrder[];
}

const STORAGE_KEY = "tradex_paper_portfolio";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function simulateSlippage(price: number, side: "BUY" | "SELL"): number {
  const slippage = price * 0.001 * (Math.random() * 0.5 + 0.5); // 0.025-0.05%
  return side === "BUY" ? price + slippage : price - slippage;
}

function simulateMarketPrice(basePrice: number): number {
  const drift = (Math.random() - 0.48) * basePrice * 0.003; // slight upward bias
  return Math.max(0.05, basePrice + drift);
}

const defaultPortfolio: PaperPortfolio = {
  initialCapital: 1000000,
  currentCapital: 1000000,
  realizedPnl: 0,
  unrealizedPnl: 0,
  totalPnl: 0,
  marginUsed: 0,
  positions: [],
  orders: [],
  tradeHistory: [],
};

export function usePaperTrading() {
  const [portfolio, setPortfolio] = useState<PaperPortfolio>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          positions: (parsed.positions || []).map((p: any) => ({
            ...p,
            timestamp: new Date(p.timestamp),
          })),
          orders: (parsed.orders || []).map((o: any) => ({
            ...o,
            timestamp: new Date(o.timestamp),
          })),
          tradeHistory: (parsed.tradeHistory || []).map((o: any) => ({
            ...o,
            timestamp: new Date(o.timestamp),
          })),
        };
      }
    } catch {}
    return defaultPortfolio;
  });

  const [isActive, setIsActive] = useState(() => {
    return localStorage.getItem("tradex_paper_mode") === "true";
  });

  const priceTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const save = useCallback((p: PaperPortfolio) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }, []);

  const togglePaperMode = useCallback((active: boolean) => {
    setIsActive(active);
    localStorage.setItem("tradex_paper_mode", String(active));
  }, []);

  const placeOrder = useCallback(
    (order: {
      symbol: string;
      instrument: string;
      type: "CE" | "PE" | "FUT" | "EQ";
      side: "BUY" | "SELL";
      quantity: number;
      price: number;
      orderType?: "MARKET" | "LIMIT";
      strike?: number;
      expiry?: string;
    }) => {
      const fillPrice = order.orderType === "LIMIT" 
        ? order.price 
        : simulateSlippage(order.price, order.side);

      const newOrder: PaperOrder = {
        id: generateId(),
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price: order.price,
        orderType: order.orderType || "MARKET",
        status: "FILLED",
        timestamp: new Date(),
        fillPrice,
      };

      setPortfolio((prev) => {
        // Check for existing position to close/net
        const existingIdx = prev.positions.findIndex(
          (p) =>
            p.symbol === order.symbol &&
            p.type === order.type &&
            p.side !== order.side
        );

        let updated: PaperPortfolio;

        if (existingIdx >= 0) {
          // Close/reduce position
          const existing = prev.positions[existingIdx];
          const closedQty = Math.min(existing.quantity, order.quantity);
          const pnl =
            existing.side === "BUY"
              ? (fillPrice - existing.entryPrice) * closedQty
              : (existing.entryPrice - fillPrice) * closedQty;

          const remainingQty = existing.quantity - closedQty;
          const newPositions = [...prev.positions];

          if (remainingQty <= 0) {
            newPositions.splice(existingIdx, 1);
          } else {
            newPositions[existingIdx] = { ...existing, quantity: remainingQty };
          }

          // If order qty > existing, open new position with remainder
          const excessQty = order.quantity - closedQty;
          if (excessQty > 0) {
            newPositions.push({
              id: generateId(),
              symbol: order.symbol,
              instrument: order.instrument,
              type: order.type,
              side: order.side,
              quantity: excessQty,
              entryPrice: fillPrice,
              currentPrice: fillPrice,
              pnl: 0,
              timestamp: new Date(),
              strike: order.strike,
              expiry: order.expiry,
            });
          }

          const marginDelta =
            order.side === "SELL" ? fillPrice * excessQty * 0.15 : -fillPrice * closedQty * 0.15;

          updated = {
            ...prev,
            positions: newPositions,
            realizedPnl: prev.realizedPnl + pnl,
            currentCapital: prev.currentCapital + pnl,
            marginUsed: Math.max(0, prev.marginUsed + marginDelta),
            orders: [...prev.orders, newOrder],
            tradeHistory: [...prev.tradeHistory, newOrder],
          };
        } else {
          // New position
          const marginRequired =
            order.side === "SELL"
              ? fillPrice * order.quantity * 0.15
              : fillPrice * order.quantity;

          const newPosition: PaperPosition = {
            id: generateId(),
            symbol: order.symbol,
            instrument: order.instrument,
            type: order.type,
            side: order.side,
            quantity: order.quantity,
            entryPrice: fillPrice,
            currentPrice: fillPrice,
            pnl: 0,
            timestamp: new Date(),
            strike: order.strike,
            expiry: order.expiry,
          };

          updated = {
            ...prev,
            positions: [...prev.positions, newPosition],
            marginUsed: prev.marginUsed + marginRequired,
            orders: [...prev.orders, newOrder],
            tradeHistory: [...prev.tradeHistory, newOrder],
          };
        }

        // Recalculate totals
        updated.unrealizedPnl = updated.positions.reduce((s, p) => s + p.pnl, 0);
        updated.totalPnl = updated.realizedPnl + updated.unrealizedPnl;

        save(updated);
        return updated;
      });

      return newOrder;
    },
    [save]
  );

  const tickPrices = useCallback(() => {
    setPortfolio((prev) => {
      const updated = {
        ...prev,
        positions: prev.positions.map((p) => {
          const newPrice = simulateMarketPrice(p.currentPrice);
          const pnl =
            p.side === "BUY"
              ? (newPrice - p.entryPrice) * p.quantity
              : (p.entryPrice - newPrice) * p.quantity;
          return { ...p, currentPrice: newPrice, pnl };
        }),
      };
      updated.unrealizedPnl = updated.positions.reduce((s, p) => s + p.pnl, 0);
      updated.totalPnl = updated.realizedPnl + updated.unrealizedPnl;
      save(updated);
      return updated;
    });
  }, [save]);

  const startPriceTicker = useCallback(() => {
    if (priceTickerRef.current) return;
    priceTickerRef.current = setInterval(tickPrices, 3000);
  }, [tickPrices]);

  const stopPriceTicker = useCallback(() => {
    if (priceTickerRef.current) {
      clearInterval(priceTickerRef.current);
      priceTickerRef.current = null;
    }
  }, []);

  const resetPortfolio = useCallback(() => {
    setPortfolio(defaultPortfolio);
    save(defaultPortfolio);
  }, [save]);

  const closeAllPositions = useCallback(() => {
    setPortfolio((prev) => {
      let realizedPnl = prev.realizedPnl;
      for (const p of prev.positions) {
        realizedPnl += p.pnl;
      }
      const updated: PaperPortfolio = {
        ...prev,
        positions: [],
        realizedPnl,
        unrealizedPnl: 0,
        totalPnl: realizedPnl,
        marginUsed: 0,
      };
      save(updated);
      return updated;
    });
  }, [save]);

  const closePositionsBySymbols = useCallback((symbols: string[]) => {
    const symbolSet = new Set(symbols);
    setPortfolio((prev) => {
      const matchedPositions = prev.positions.filter((position) => symbolSet.has(position.symbol));
      if (matchedPositions.length === 0) return prev;

      let realizedPnl = prev.realizedPnl;
      for (const position of matchedPositions) {
        realizedPnl += position.pnl;
      }

      const updated: PaperPortfolio = {
        ...prev,
        positions: prev.positions.filter((position) => !symbolSet.has(position.symbol)),
        realizedPnl,
        unrealizedPnl: prev.positions
          .filter((position) => !symbolSet.has(position.symbol))
          .reduce((sum, position) => sum + position.pnl, 0),
        marginUsed: 0,
      };

      updated.totalPnl = updated.realizedPnl + updated.unrealizedPnl;
      updated.marginUsed = updated.positions.reduce((sum, position) => {
        const notional = position.entryPrice * position.quantity;
        return sum + (position.side === "SELL" ? notional * 0.15 : notional);
      }, 0);
      updated.tradeHistory = [
        ...updated.tradeHistory,
        ...matchedPositions.map((position) => ({
          id: generateId(),
          symbol: position.symbol,
          side: position.side === "BUY" ? "SELL" : "BUY",
          quantity: position.quantity,
          price: position.currentPrice,
          orderType: "MARKET" as const,
          status: "FILLED" as const,
          timestamp: new Date(),
          fillPrice: position.currentPrice,
        })),
      ];
      save(updated);
      return updated;
    });
  }, [save]);

  return {
    portfolio,
    isActive,
    togglePaperMode,
    placeOrder,
    tickPrices,
    startPriceTicker,
    stopPriceTicker,
    resetPortfolio,
    closeAllPositions,
    closePositionsBySymbols,
  };
}
