import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

export type Monitor = {
  id: string;
  user_id: string;
  name: string;
  url: string;
  interval_minutes: number;
  is_active: boolean;
  last_status: "up" | "down" | "pending";
  last_checked_at: string | null;
  created_at: string;
};

export type MonitorCheck = {
  id: string;
  monitor_id: string;
  status_code: number | null;
  latency_ms: number | null;
  is_up: boolean;
  error: string | null;
  checked_at: string;
};
