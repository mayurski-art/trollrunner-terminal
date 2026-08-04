import { getServiceClient } from "@/lib/supabase";
import { OWNER_USERNAME } from "@/lib/ownerUsername";

export { OWNER_USERNAME };

type Owner = { userId: string; supabase: ReturnType<typeof getServiceClient> };

// Same bearer-token -> service-client -> auth.getUser(token) shape used by
// every other authenticated route in this app (see app/api/chat/route.ts),
// with an extra check that the signed-in account is actually the owner.
// Returns null on any failure so callers can respond 401/403 uniformly.
export async function requireOwner(request: Request): Promise<Owner | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const username = data.user.user_metadata?.username;
  if (username !== OWNER_USERNAME) return null;

  return { userId: data.user.id, supabase };
}
