import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePaperTrading } from "@/hooks/usePaperTrading";
import { getDefaultSpotPrice, getInstrument } from "@/lib/instruments";
import { resolveStrikeFromSelection } from "@/lib/option-strikes";
import { buildPaperOptionSymbol, resolveAlgoExpiryDate } from "@/lib/strategy-order-utils";
import { upsertRunningStrategy } from "@/lib/strategy-runtime";
import { useAuth } from "@/hooks/useAuth";

const EXECUTION_LOG_KEY = "tradex_algo_paper_execution_log";

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
  const timeCondition = conditions.find((condition) => condition.type === "time");
  return timeCondition?.value || null;
}

function isDue(timeValue: string | null) {
  // If no time condition, execute during market hours (9:15 - 15:30)
  if (!timeValue) {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const mins = h * 60 + m;
    return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
  }
  const now = new Date();
  const [hours, minutes] = timeValue.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;
  const dueAt = new Date(now);
  dueAt.setHours(hours, minutes, 0, 0);
  return now >= dueAt;
}

const AlgoExecutionDaemon = () => {
  const { user } = useAuth();
  const paper = usePaperTrading();

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      const todayKey = new Date().toDateString();
      const executionLog = getExecutionLog();

      const { data, error } = await supabase
        .from("algo_strategies")
        .select("id, name, instrument, legs, entry_conditions, execution_mode, product_type, status")
        .eq("status", "deployed")
        .eq("execution_mode", "paper");

      if (error || !data) return;

      for (const strategy of data as any[]) {
        const entryTime = getEntryTime(strategy.entry_conditions || []);
        if (!entryTime || !isDue(entryTime)) continue;
        if (executionLog[strategy.id] === todayKey) continue;

        const inst = getInstrument(strategy.instrument);
        const lotSize = inst?.lotSize || 1;
        const spot = getDefaultSpotPrice(strategy.instrument);
        const step = inst?.strikeStep || 50;
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
          const symbol = buildPaperOptionSymbol({
            instrument: strategy.instrument,
            expiryDate,
            strike,
            optionType: leg.optionType,
          });
          const price = Math.max(1, Math.round((20 + Math.abs(spot - strike) / 10) * 100) / 100);
          const quantity = Math.max(1, (leg.lots || 1) * lotSize);

          paper.placeOrder({
            symbol,
            instrument: strategy.instrument,
            type: leg.optionType,
            side: leg.side,
            quantity,
            price,
            strike,
            expiry: expiryDate?.toISOString(),
          });

          runtimeLegs.push({
            symbol,
            instrument: strategy.instrument,
            type: leg.optionType,
            side: leg.side,
            quantity,
            price,
            strike,
            expiry: expiryDate?.toISOString(),
          });
        }

        if (runtimeLegs.length > 0) {
          upsertRunningStrategy({
            id: `algo-${strategy.id}`,
            strategyId: strategy.id,
            name: strategy.name,
            instrument: strategy.instrument,
            source: "algo",
            mode: "paper",
            status: "running",
            productType: strategy.product_type || "MIS",
            createdAt: new Date().toISOString(),
            legs: runtimeLegs,
          });
          executionLog[strategy.id] = todayKey;
        }
      }

      saveExecutionLog(executionLog);
    };

    void run();
    const intervalId = window.setInterval(() => void run(), 30000);
    return () => window.clearInterval(intervalId);
  }, [paper, user]);

  return null;
};

export default AlgoExecutionDaemon;
