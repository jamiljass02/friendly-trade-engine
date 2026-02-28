import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RiskSettings {
  id?: string;
  user_id?: string;
  max_index_exposure: number;
  max_stock_exposure: number;
  max_sector_concentration_pct: number;
  max_positions_per_asset: number;
  index_sl_pct: number;
  stock_sl_pct: number;
  futures_sl_pct: number;
  daily_loss_limit: number;
  daily_loss_auto_shutdown: boolean;
  max_delta: number;
  max_gamma: number;
  max_vega: number;
  max_theta: number;
  max_margin_utilization_pct: number;
  margin_alert_threshold_pct: number;
  kill_switch_active: boolean;
  kill_switch_activated_at?: string | null;
}

const DEFAULTS: RiskSettings = {
  max_index_exposure: 500000,
  max_stock_exposure: 300000,
  max_sector_concentration_pct: 40,
  max_positions_per_asset: 10,
  index_sl_pct: 30,
  stock_sl_pct: 25,
  futures_sl_pct: 5,
  daily_loss_limit: 25000,
  daily_loss_auto_shutdown: true,
  max_delta: 500,
  max_gamma: 50,
  max_vega: 5000,
  max_theta: -2000,
  max_margin_utilization_pct: 80,
  margin_alert_threshold_pct: 60,
  kill_switch_active: false,
  kill_switch_activated_at: null,
};

export function useRiskSettings() {
  const [settings, setSettings] = useState<RiskSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSettings(DEFAULTS); return; }

      const { data, error } = await supabase
        .from("risk_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings(data as unknown as RiskSettings);
      } else {
        // Create default settings
        const { data: created, error: insertErr } = await supabase
          .from("risk_settings")
          .insert({ user_id: user.id } as any)
          .select()
          .single();
        if (insertErr) throw insertErr;
        if (created) setSettings(created as unknown as RiskSettings);
      }
    } catch (err: any) {
      console.error("Failed to load risk settings:", err);
      setSettings(DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = useCallback(async (updated: Partial<RiskSettings>) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("risk_settings")
        .update(updated as any)
        .eq("user_id", user.id);

      if (error) throw error;
      setSettings((prev) => ({ ...prev, ...updated }));
      toast({ title: "Settings Saved", description: "Risk parameters updated successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [toast]);

  const toggleKillSwitch = useCallback(async (active: boolean) => {
    await saveSettings({
      kill_switch_active: active,
      kill_switch_activated_at: active ? new Date().toISOString() : null,
    });
  }, [saveSettings]);

  return { settings, loading, saving, saveSettings, toggleKillSwitch, refresh: fetchSettings };
}
