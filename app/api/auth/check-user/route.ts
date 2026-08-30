import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

// Public, unauthenticated: tells the single sign-in/create-account form
// (components/AuthPanel.tsx) whether a typed username already has an
// account, so the form can auto-pick login vs. register instead of asking
// the visitor to know which one they need. Usernames aren't secret (they're
// visible in chat, /inspect, everywhere) so this isn't an enumeration risk
// beyond what the site already exposes.
export async function POST(request: Request) {
  let body: { username?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  const username = (body.username ?? "").trim();
  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ exists: false });
  }

  const supabase = getServiceClient();
  // No server-side filter-by-email on admin.listUsers() in supabase-js v2,
  // and auth.users isn't exposed over PostgREST — paginate in-memory. Fine
  // at this site's scale (see app/api/admin/users/route.ts, same approach).
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      return NextResponse.json({ error: "could not check that username" }, { status: 500 });
    }
    const match = data.users.some(
      (u) => (u.user_metadata?.username as string | undefined)?.toLowerCase() === username.toLowerCase()
    );
    if (match) return NextResponse.json({ exists: true });
    if (data.users.length < perPage) break;
    page += 1;
  }

  return NextResponse.json({ exists: false });
}
