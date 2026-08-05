"use client";

import { useEffect, useState } from "react";
import { getPublicClient } from "@/lib/supabase";

type Report = {
  reportDate: string;
  chatCostUsd: number;
  undervoiceCostUsd: number;
  postsCostUsd: number;
  totalCostUsd: number;
};

async function authHeader(): Promise<Record<string, string>> {
  const sb = getPublicClient();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function usd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

export default function DailyReports() {
  const [today, setToday] = useState<Report | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const headers = await authHeader();
      if (!headers.Authorization) {
        setError("not signed in");
        setLoaded(true);
        return;
      }
      const res = await fetch("/api/admin/daily-reports", { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "could not load reports");
      } else {
        setToday(data.today ?? null);
        setReports(data.reports ?? []);
      }
      setLoaded(true);
    })();
  }, []);

  if (!loaded) {
    return <p className="text-dim text-sm animate-pulse">pulling the ledger...</p>;
  }
  if (error) {
    return <p className="text-alert text-sm">[ {error} ]</p>;
  }

  const rows = today ? [{ ...today, live: true }, ...reports.map((r) => ({ ...r, live: false }))] : reports.map((r) => ({ ...r, live: false }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm border-collapse">
        <thead>
          <tr className="text-ghost text-left border-b border-dim">
            <th className="py-2 pr-3 font-normal">date</th>
            <th className="py-2 pr-3 font-normal">total</th>
            <th className="py-2 pr-3 font-normal">chat</th>
            <th className="py-2 pr-3 font-normal">undervoice</th>
            <th className="py-2 font-normal">transmissions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-3 text-dim">
                no reports yet — the daily cron hasn&apos;t run
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.reportDate} className="border-b border-dim/40">
              <td className="py-2 pr-3 text-terminal">
                {r.reportDate}
                {r.live && <span className="text-problem ml-2">[ today, still counting ]</span>}
              </td>
              <td className="py-2 pr-3">{usd(r.totalCostUsd)}</td>
              <td className="py-2 pr-3 text-dim">{usd(r.chatCostUsd)}</td>
              <td className="py-2 pr-3 text-dim">{usd(r.undervoiceCostUsd)}</td>
              <td className="py-2 text-dim">{usd(r.postsCostUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
