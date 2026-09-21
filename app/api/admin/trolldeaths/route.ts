import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";
import type { TrollDeathItem, TrollDeathKind } from "@/app/trolldeaths/page";

export const runtime = "nodejs";

// Owner-only CRUD over the same shared `site_updates` row (id:
// "finance_timeline") that GET /api/trolldeaths reads read-only. This used
// to be written from trollrunner-finance's admin.html via a separate
// cross-site RPC (troll_admin_replace_site_row); that admin panel was
// removed 2026-09-16 and this route replaces it, scoped to terminal's own
// owner auth instead of the old admin@login cross-site session.
const ROW_ID = "finance_timeline";

function normalize(item: Partial<TrollDeathItem>): TrollDeathItem | null {
  const kind: TrollDeathKind = item.kind === "guardian" ? "guardian" : "fud";
  const title = String(item.title ?? "").trim();
  const copy = String(item.copy ?? "").trim();
  if (!title || !copy) return null;

  const rawEventDate = item.eventDate || new Date().toISOString();
  const parsed = new Date(rawEventDate);
  const eventDate = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();

  const date =
    String(item.date ?? "").trim() ||
    new Date(eventDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const tags = Array.isArray(item.tags)
    ? item.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 8)
    : [];

  const sourceHref = String(item.sourceHref ?? "").trim();
  const sourceLabel =
    String(item.sourceLabel ?? "").trim() ||
    (sourceHref.includes("x.com") || sourceHref.includes("twitter.com") ? "Open on X" : "Open source");

  return {
    id: String(item.id ?? "").trim() || `${kind}-${eventDate}-${title}`.slice(0, 200),
    kind,
    date,
    eventDate,
    title,
    copy,
    tags,
    sourceHref: sourceHref || undefined,
    sourceLabel: sourceHref ? sourceLabel : undefined,
  };
}

async function loadItems(owner: NonNullable<Awaited<ReturnType<typeof requireOwner>>>) {
  const res = await owner.supabase
    .from("site_updates")
    .select("updates")
    .eq("id", ROW_ID)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data?.updates as TrollDeathItem[] | null) ?? [];
}

async function saveItems(owner: NonNullable<Awaited<ReturnType<typeof requireOwner>>>, items: TrollDeathItem[]) {
  const res = await owner.supabase
    .from("site_updates")
    .upsert({ id: ROW_ID, updates: items, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select("updates")
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data?.updates as TrollDeathItem[] | null) ?? items;
}

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  try {
    const items = await loadItems(owner);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// body: { action: "save", item: Partial<TrollDeathItem> } — upserts by id
//       { action: "delete", id: string }
export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  let body: { action?: string; item?: Partial<TrollDeathItem>; id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "malformed request" }, { status: 400 });
  }

  try {
    const items = await loadItems(owner);

    if (body.action === "save") {
      const normalized = normalize(body.item ?? {});
      if (!normalized) {
        return NextResponse.json({ error: "title and copy are required" }, { status: 400 });
      }
      const idx = items.findIndex((it) => it.id === normalized.id);
      const next = idx >= 0 ? items.map((it, i) => (i === idx ? normalized : it)) : [normalized, ...items];
      next.sort((a, b) => new Date(b.eventDate ?? 0).getTime() - new Date(a.eventDate ?? 0).getTime());
      const saved = await saveItems(owner, next);
      return NextResponse.json({ items: saved, saved: normalized });
    }

    if (body.action === "delete") {
      const id = String(body.id ?? "").trim();
      if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
      const next = items.filter((it) => it.id !== id);
      const saved = await saveItems(owner, next);
      return NextResponse.json({ items: saved });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
