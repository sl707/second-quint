import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/** Server-only Supabase client with full access. The game service uses it to enforce rules itself. */
export function createAdminClient(): SupabaseClient {
  return createClient(publicEnv.supabaseUrl, serverEnv().supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
