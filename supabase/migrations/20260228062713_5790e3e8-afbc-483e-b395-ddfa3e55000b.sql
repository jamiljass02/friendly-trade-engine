
-- Scheduled trades table
CREATE TABLE public.scheduled_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instrument TEXT NOT NULL DEFAULT 'NIFTY',
  strategy_type TEXT NOT NULL DEFAULT 'straddle', -- straddle, strangle
  selection_mode TEXT NOT NULL DEFAULT 'atm', -- atm, premium_target, otm_percent
  premium_target NUMERIC, -- target premium per lot
  otm_percent NUMERIC, -- % OTM for strangle
  quantity INTEGER NOT NULL DEFAULT 50,
  stop_loss_percent NUMERIC NOT NULL DEFAULT 50, -- SL as % of premium
  schedule_time TIME NOT NULL DEFAULT '09:15:00',
  is_active BOOLEAN NOT NULL DEFAULT true,
  telegram_alert BOOLEAN NOT NULL DEFAULT true,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_trades ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own scheduled trades"
  ON public.scheduled_trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scheduled trades"
  ON public.scheduled_trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled trades"
  ON public.scheduled_trades FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled trades"
  ON public.scheduled_trades FOR DELETE
  USING (auth.uid() = user_id);

-- Execution log
CREATE TABLE public.trade_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES public.scheduled_trades(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  instrument TEXT NOT NULL,
  strategy_type TEXT NOT NULL,
  legs JSONB NOT NULL DEFAULT '[]',
  total_premium NUMERIC,
  stop_loss_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, executed, failed, stopped_out
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own executions"
  ON public.trade_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own executions"
  ON public.trade_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger for scheduled_trades
CREATE TRIGGER update_scheduled_trades_updated_at
  BEFORE UPDATE ON public.scheduled_trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
