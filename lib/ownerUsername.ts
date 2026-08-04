// The one account allowed to see other users' conversations (admin
// dashboard) and receive gossip. Split into its own file, with no
// server-only imports, so client components (e.g. Nav.tsx) can safely check
// it without bundling lib/supabase.ts's service-role client.
export const OWNER_USERNAME = "troll_runner";
