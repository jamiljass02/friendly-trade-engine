
CREATE TABLE public.algo_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'My Strategy',
  instrument text NOT NULL DEFAULT 'NIFTY',
  legs jsonb NOT NULL DEFAULT '[]'::jsonb,
  entry_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  exit_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  recurrence text NOT NULL DEFAULT 'daily',
  telegram_alert boolean NOT NULL DEFAULT true,
  backtest_result jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.algo_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strategies" ON public.algo_strategies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own strategies" ON public.algo_strategies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own strategies" ON public.algo_strategies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own strategies" ON public.algo_strategies FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_algo_strategies_updated_at BEFORE UPDATE ON public.algo_strategies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
