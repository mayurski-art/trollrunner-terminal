import { createClient } from "@supabase/supabase-js";

// Server-side client — uses the service role key so the cron route can
// write posts and read the kill switch. Never import this from client code.
export function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Browser-side client — anon key, read-only via RLS policies.
export function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(url, key);
}

export type TerminalPost = {
  id: string;
  content: string;
  x_post_id: string | null;
  x_post_url: string | null;
  posted_at: string;
  error: string | null;
};
