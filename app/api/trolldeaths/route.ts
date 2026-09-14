import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Public + unauthenticated. Reads the same shared `site_updates` row that
// trollrunner-finance's admin.html writes via troll_admin_replace_site_row
// (p_row_id: "finance_timeline") — this is the FUD/Guardian "Trolldeaths"
// ledger, authored only from finance's admin tool. Terminal is read-only.
export async function GET() {
  try {
    const supabase = getServiceClient();

    const res = await supabase
      .from("site_updates")
      .select("updates")
      .eq("id", "finance_timeline")
      .limit(1)
      .maybeSingle();

    if (res.error) {
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }

    return NextResponse.json({
      items: res.data?.updates ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
