import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Just the PROBLEMS balance, nothing else. /api/chat's GET already returns a
// wallet, but it drags a page of chat history along with it — far too heavy
// for something the nav asks for on every route. Kept deliberately tiny so
// components/ProblemsCounter.tsx can sit in the nav site-wide.
export async function GET(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const supabase = getServiceClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const { data: wallet } = await supabase
    .from("terminal_wallets")
    .select("balance, lifetime_earned, lifetime_spent")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  return NextResponse.json({
    balance: wallet?.balance ?? 0,
    lifetimeEarned: wallet?.lifetime_earned ?? 0,
    lifetimeSpent: wallet?.lifetime_spent ?? 0,
  });
}
