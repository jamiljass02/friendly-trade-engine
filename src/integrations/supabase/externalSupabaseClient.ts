// Secondary Supabase client pointing at an external project.
// Use this for trading data storage; keep auth on the primary Lovable Cloud client.
import { createClient } from "@supabase/supabase-js";

export const EXTERNAL_SUPABASE_URL = "https://kffecluugjrksrxqzx.supabase.co";
export const EXTERNAL_SUPABASE_PROJECT_ID = "kffecluugjrksrxqzx";
export const EXTERNAL_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_spvOqOBhq-0EhjAiQu3KeQ_vFqkYqxT";

// Separate storage key so this client's session never collides with the
// primary Lovable Cloud auth session in localStorage.
export const externalSupabase = createClient(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storageKey: `sb-${EXTERNAL_SUPABASE_PROJECT_ID}-auth-token`,
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
