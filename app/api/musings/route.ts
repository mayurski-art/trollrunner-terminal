import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Public, read-only — powers the homepage "still turning this over" panel.
export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("terminal_musings")
      .select("id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ musings: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
