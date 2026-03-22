import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePaperTrading } from "@/hooks/usePaperTrading";
import { getDefaultSpotPrice, getInstrument } from "@/lib/instruments";
import { resolveStrikeFromSelection } from "@/lib/option-strikes";
import {
  buildPaperOptionSymbol,
  resolveAlgoExpiryDate,
  resolveOptionTradingSymbol,
} from "@/lib/strategy-order-utils";
import { getBrokerOrderId, getOrderFillPrice, roundToTick, waitForOrderFill } from "@/lib/broker-order-utils";
import { monitorMoveToCost, type StopOrderWatch } from "@/lib/broker-stop-loss";
import { upsertRunningStrategy } from "@/lib/strategy-runtime";
import { useAuth } from "@/hooks/useAuth";
import { useBroker } from "@/hooks/useBroker";
import { useIndexPrices } from "@/hooks/useIndexPrices";
import { toast } from "sonner";

const EXECUTION_LOG_KEY = "tradex_algo_execution_log";

function getExecutionLog(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(EXECUTION_LOG_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveExecutionLog(log: Record<string, string>) {
  localStorage.setItem(EXECUTION_LOG_KEY, JSON.stringify(log));
}

function getEntryTime(conditions: any[]): string | null {
  const timeCondition = conditions.find((c) => c.type === "time");
  return timeCondition?.value || null;
}

function getEntryDayOfWeek(conditions: any[]): string | null {
  const dayCondition = conditions.find((c) => c.type === "day_of_week");
  return dayCondition?.value || null;
}

function getEntryDaysToExpiry(conditions: any[]): string | null {
  const dteCondition = conditions.find((c) => c.type === "days_to_expiry");
  return dteCondition?.value || null;
}

function isDue(timeValue: string | null) {
  if (!timeValue) {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
  }
  const now = new Date();
  const [hours, minutes] = timeValue.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;
  const dueAt = new Date(now);
  dueAt.setHours(hours, minutes, 0, 0);
  return now >= dueAt;
}

function isDayMatch(dayValue: string | null): boolean {
  if (!dayValue) return true; // No day condition means any day
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const shortDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayIndex = new Date().getDay();
  const normalized = dayValue.trim().toLowerCase();
  return normalized === dayNames[todayIndex].toLowerCase() || normalized === shortDayNames[todayIndex].toLowerCase();
}

function isDaysToExpiryMatch(daysValue: string | null, strategy: any): boolean {
  if (!daysValue) return true;

  const target = Number(daysValue);
  if (!Number.isFinite(target)) return true;

  const expiries = (strategy.legs || [])
    .map((leg: any) => resolveAlgoExpiryDate(leg.expiry, strategy.instrument, leg.customExpiry))
    .filter((value: Date | undefined): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));

  if (expiries.length === 0) return false;

  return expiries.some((expiry) => Math.ceil((expiry.getTime() - Date.now()) / 86400000) === target);
}

const AlgoExecutionDaemon = () => {
  const { user } = useAuth();
  const paper = usePaperTrading();
  const broker = useBroker();
  const { prices } = useIndexPrices();

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      const todayKey = new Date().toDateString();
      const executionLog = getExecutionLog();

      // Fetch ALL deployed strategies (both paper and live)
      const { data, error } = await supabase
        .from("algo_strategies")
          .select("id, name, instrument, legs, entry_conditions, execution_mode, product_type, status, backtest_result, user_id")
          .eq("status", "deployed")
          .eq("user_id", user.id);

      if (error || !data) return;

      for (const strategy of data as any[]) {
        const conditions = strategy.entry_conditions || [];
        const entryTime = getEntryTime(conditions);
        const entryDay = getEntryDayOfWeek(conditions);
        const entryDte = getEntryDaysToExpiry(conditions);

        // Check day-of-week condition
        if (!isDayMatch(entryDay)) continue;
        if (!isDaysToExpiryMatch(entryDte, strategy)) continue;
        // Check time condition
        if (!isDue(entryTime)) continue;
        // Already executed today
        if (executionLog[strategy.id] === todayKey) continue;

        const isLive = strategy.execution_mode === "live";

        // For live, broker must be connected
        if (isLive && !broker.isConnected) {
          console.warn(`[AlgoDaemon] Strategy "${strategy.name}" is Live but broker not connected. Skipping.`);
          continue;
        }

        const inst = getInstrument(strategy.instrument);
        const lotSize = inst?.lotSize || 1;
        const step = inst?.strikeStep || 50;

        // Use live spot price if available, else fallback
        const livePrice = prices.find((p) => p.name === strategy.instrument)?.price;
        const spot = (livePrice && livePrice > 0) ? livePrice : getDefaultSpotPrice(strategy.instrument);

        const runtimeLegs = [] as Array<{
          symbol: string;
          instrument: string;
          type: "CE" | "PE" | "FUT" | "EQ";
          side: "BUY" | "SELL";
          quantity: number;
          price: number;
          strike?: number;
          expiry?: string;
        }>;

        let allLegsSuccess = true;
        const stopWatch: StopOrderWatch[] = [];

        for (const leg of strategy.legs || []) {
          if (leg.segment !== "OPT") continue;

          const strike = resolveStrikeFromSelection({
            selection: leg.strikeSelection,
            optionType: leg.optionType,
            spot,
            step,
            customStrike: leg.customStrike,
          });
          if (!strike) continue;

          const expiryDate = resolveAlgoExpiryDate(leg.expiry, strategy.instrument, leg.customExpiry);
          const quantity = Math.max(1, (leg.lots || 1) * lotSize);
          const tickSize = inst?.tickSize || 0.05;
          const stopLossPct = Number(leg.stopLossPct ?? leg.stopLoss ?? 0);

          if (isLive) {
            // === LIVE EXECUTION ===
            try {
              const exchange = inst?.exchange || "NFO";
              const tradingSymbol = await resolveOptionTradingSymbol({
                instrument: strategy.instrument,
                optionType: leg.optionType,
                strike,
                expiryDate,
                exchange,
                getOptionChain: broker.getOptionChain,
                searchScrip: broker.searchScrip,
              });

              console.log(`[AlgoDaemon] LIVE placing ${leg.side} ${tradingSymbol} qty=${quantity}`);

              const orderResult = await broker.placeOrder({
                exchange,
                tradingsymbol: tradingSymbol,
                quantity,
                transaction_type: leg.side === "BUY" ? "B" : "S",
                product: strategy.product_type === "NRML" ? "M" : "I",
                order_type: "MKT",
              });

              let fillPrice = Number(orderResult?.avgprc || orderResult?.prc || 0);
              const entryOrderId = getBrokerOrderId(orderResult);

              if (entryOrderId) {
                const fill = await waitForOrderFill({ orderId: entryOrderId, getOrders: broker.getOrders });
                if (fill.state === "rejected") {
                  throw new Error(`Order rejected for ${tradingSymbol}`);
                }
                if (fill.order) {
                  fillPrice = getOrderFillPrice(fill.order, fillPrice || 0);
                }
              }

              runtimeLegs.push({
                symbol: tradingSymbol,
                instrument: strategy.instrument,
                type: leg.optionType,
                side: leg.side,
                quantity,
                price: fillPrice || 0,
                strike,
                expiry: expiryDate?.toISOString(),
              });

              toast.success(`Algo: ${leg.side} ${tradingSymbol} placed`, {
                description: `Strategy: ${strategy.name}`,
              });

              // Place SL order if stop_loss is configured
              if (stopLossPct > 0 && fillPrice > 0) {
                const slPrice = leg.side === "SELL"
                  ? fillPrice * (1 + stopLossPct / 100)
                  : fillPrice * (1 - stopLossPct / 100);
                const slTrigger = Math.max(tickSize, roundToTick(slPrice, tickSize));

                try {
                  const stopResult = await broker.placeOrder({
                    exchange,
                    tradingsymbol: tradingSymbol,
                    quantity,
                    trigger_price: slTrigger,
                    transaction_type: leg.side === "BUY" ? "S" : "B",
                    product: strategy.product_type === "NRML" ? "M" : "I",
                    order_type: "SL-MKT",
                  });
                  const stopOrderId = getBrokerOrderId(stopResult);
                  if (stopOrderId) {
                    stopWatch.push({
                      stopOrderId,
                      symbol: tradingSymbol,
                      quantity,
                      exchange,
                      entryPrice: fillPrice,
                    });
                  }
                  console.log(`[AlgoDaemon] SL order placed for ${tradingSymbol} at trigger ${slTrigger}`);
                } catch (slErr) {
                  console.error(`[AlgoDaemon] SL order failed for ${tradingSymbol}:`, slErr);
                }
              }
            } catch (err: any) {
              console.error(`[AlgoDaemon] LIVE order failed for ${strategy.name}:`, err);
              toast.error(`Algo order failed: ${err.message}`, {
                description: `Strategy: ${strategy.name}, ${leg.optionType} ${leg.strikeSelection}`,
              });
              allLegsSuccess = false;
            }
          } else {
            // === PAPER EXECUTION ===
            const symbol = buildPaperOptionSymbol({
              instrument: strategy.instrument,
              expiryDate,
              strike,
              optionType: leg.optionType,
            });
            const price = Math.max(1, Math.round((20 + Math.abs(spot - strike) / 10) * 100) / 100);

            const order = paper.placeOrder({
              symbol,
              instrument: strategy.instrument,
              type: leg.optionType,
              side: leg.side,
              quantity,
              price,
              strike,
              expiry: expiryDate?.toISOString(),
            });

            const fillPrice = order.fillPrice || price;

            runtimeLegs.push({
              symbol,
              instrument: strategy.instrument,
              type: leg.optionType,
              side: leg.side,
              quantity,
              price: fillPrice,
              strike,
              expiry: expiryDate?.toISOString(),
            });
          }
        }

        if (isLive && strategy.backtest_result?.moveToCost && stopWatch.length > 1) {
          void monitorMoveToCost({
            watchList: stopWatch,
            getOrders: broker.getOrders,
            modifyOrder: broker.modifyOrder,
            tickSize: inst?.tickSize || 0.05,
            onMoved: () => {
              toast.success("Move to cost applied", {
                description: `Strategy: ${strategy.name}`,
              });
            },
          });
        }

        if (runtimeLegs.length > 0) {
          upsertRunningStrategy({
            id: `algo-${strategy.id}`,
            strategyId: strategy.id,
            name: strategy.name,
            instrument: strategy.instrument,
            source: "algo",
            mode: isLive ? "live" : "paper",
            status: "running",
            productType: strategy.product_type || "MIS",
            createdAt: new Date().toISOString(),
            legs: runtimeLegs,
          });

          // Mark as executed only if all legs succeeded (or paper mode)
          if (!isLive || allLegsSuccess) {
            executionLog[strategy.id] = todayKey;
          }

          console.log(`[AlgoDaemon] Strategy "${strategy.name}" executed (${isLive ? "LIVE" : "PAPER"}) with ${runtimeLegs.length} legs`);
        }
      }

      saveExecutionLog(executionLog);
    };

    void run();
    const intervalId = window.setInterval(() => void run(), 30000);
    return () => window.clearInterval(intervalId);
  }, [paper, user, broker.isConnected, broker.getOptionChain, broker.searchScrip, broker.placeOrder, broker.getOrders, broker.modifyOrder, prices]);

  return null;
};

export default AlgoExecutionDaemon;
