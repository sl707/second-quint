import type { SupabaseClient } from "@supabase/supabase-js";

export async function getAppName(db: SupabaseClient): Promise<string> {
  const { data, error } = await db.from("app_info").select("value").eq("key", "name").single();
  if (error) throw error;
  return data.value;
}
