
ALTER TABLE public.algo_strategies 
ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'MIS',
ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'paper';
