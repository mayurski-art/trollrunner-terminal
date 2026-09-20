import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

// Owner-only: everything filed through the "report a bug" button next to
// Clear (app/api/bug-report/route.ts writes these). No RLS read policy
// exists on terminal_bug_reports on purpose — this route, using the
// service-role client, is the only way to read the queue back, and it's
// gated the same way every other [ inspect ] endpoint is gated.
export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }
  const { supabase } = owner;

  const { data: reports, error } = await supabase
    .from("terminal_bug_reports")
    .select("id, message, reporter_id, user_agent, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "could not load bug reports" }, { status: 500 });
  }

  const reporterIds = Array.from(
    new Set((reports ?? []).map((r) => r.reporter_id as string | null).filter((id): id is string => Boolean(id)))
  );

  let usernameById = new Map<string, string>();
  if (reporterIds.length) {
    const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    usernameById = new Map(
      (authUsers?.users ?? []).map((u) => [u.id, (u.user_metadata?.username as string | undefined) ?? "unknown"])
    );
  }

  return NextResponse.json({
    reports: (reports ?? []).map((r) => ({
      id: r.id,
      message: r.message,
      reporterUsername: r.reporter_id ? usernameById.get(r.reporter_id as string) ?? "unknown" : null,
      userAgent: r.user_agent,
      status: r.status,
      createdAt: r.created_at,
    })),
  });
}
