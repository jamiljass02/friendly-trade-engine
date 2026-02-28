import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";


export interface ScheduledTrade {
  id: string;
  user_id: string;
  instrument: string;
  strategy_type: string;
  selection_mode: string;
  premium_target: number | null;
  otm_percent: number | null;
  quantity: number;
  stop_loss_percent: number;
  schedule_time: string;
  is_active: boolean;
  telegram_alert: boolean;
  last_executed_at: string | null;
  created_at: string;
}

export interface TradeExecution {
  id: string;
  schedule_id: string | null;
  instrument: string;
  strategy_type: string;
  legs: unknown;
  total_premium: number | null;
  stop_loss_price: number | null;
  status: string;
  error_message: string | null;
  executed_at: string;
}

export function useScheduledTrades() {
  const [schedules, setSchedules] = useState<ScheduledTrade[]>([]);
  const [executions, setExecutions] = useState<TradeExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("scheduled_trades")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSchedules(data || []);
    }
    setLoading(false);
  }, [toast]);

  const fetchExecutions = useCallback(async () => {
    const { data, error } = await supabase
      .from("trade_executions")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(20);

    if (!error) setExecutions(data || []);
  }, []);

  const createSchedule = useCallback(
    async (schedule: Omit<ScheduledTrade, "id" | "user_id" | "created_at" | "last_executed_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
        return null;
      }

      const { data, error } = await supabase
        .from("scheduled_trades")
        .insert({ ...schedule, user_id: user.id })
        .select()
        .single();

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return null;
      }

      toast({ title: "Schedule Created", description: `${schedule.strategy_type} on ${schedule.instrument} at ${schedule.schedule_time}` });
      await fetchSchedules();
      return data;
    },
    [toast, fetchSchedules]
  );

  const updateSchedule = useCallback(
    async (id: string, updates: Partial<ScheduledTrade>) => {
      const { error } = await supabase
        .from("scheduled_trades")
        .update(updates)
        .eq("id", id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        await fetchSchedules();
      }
    },
    [toast, fetchSchedules]
  );

  const deleteSchedule = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("scheduled_trades")
        .delete()
        .eq("id", id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Deleted", description: "Schedule removed" });
        await fetchSchedules();
      }
    },
    [toast, fetchSchedules]
  );

  const sendTelegramAlert = useCallback(async (message: string) => {
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ytzzmnharipqcucfachn.supabase.co";
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0enptbmhhcmlwcWN1Y2ZhY2huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMzc3ODUsImV4cCI6MjA4NzgxMzc4NX0.IjrxQYoFZRBuC_hpqDU8Wr2C3QQGHZsrb1XsaO9m9R4";

      await fetch(`${SUPABASE_URL}/functions/v1/telegram-alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ message }),
      });
    } catch (err) {
      console.error("Telegram alert failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
    fetchExecutions();
  }, [fetchSchedules, fetchExecutions]);

  return {
    schedules,
    executions,
    loading,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    sendTelegramAlert,
    refresh: () => { fetchSchedules(); fetchExecutions(); },
  };
}
