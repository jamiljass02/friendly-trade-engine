
CREATE TABLE public.risk_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  
  -- Position limits
  max_index_exposure numeric NOT NULL DEFAULT 500000,
  max_stock_exposure numeric NOT NULL DEFAULT 300000,
  max_sector_concentration_pct numeric NOT NULL DEFAULT 40,
  max_positions_per_asset integer NOT NULL DEFAULT 10,
  
  -- Stop loss settings
  index_sl_pct numeric NOT NULL DEFAULT 30,
  stock_sl_pct numeric NOT NULL DEFAULT 25,
  futures_sl_pct numeric NOT NULL DEFAULT 5,
  
  -- Daily limits
  daily_loss_limit numeric NOT NULL DEFAULT 25000,
  daily_loss_auto_shutdown boolean NOT NULL DEFAULT true,
  
  -- Greeks limits
  max_delta numeric NOT NULL DEFAULT 500,
  max_gamma numeric NOT NULL DEFAULT 50,
  max_vega numeric NOT NULL DEFAULT 5000,
  max_theta numeric NOT NULL DEFAULT -2000,
  
  -- Cross-margin
  max_margin_utilization_pct numeric NOT NULL DEFAULT 80,
  margin_alert_threshold_pct numeric NOT NULL DEFAULT 60,
  
  -- Kill switch
  kill_switch_active boolean NOT NULL DEFAULT false,
  kill_switch_activated_at timestamp with time zone,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own risk settings" ON public.risk_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own risk settings" ON public.risk_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own risk settings" ON public.risk_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE UNIQUE INDEX risk_settings_user_id_unique ON public.risk_settings (user_id);
