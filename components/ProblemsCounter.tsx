"use client";

import { useCallback, useEffect, useState } from "react";
import { getPublicClient } from "@/lib/supabase";

// The PROBLEMS balance, in the nav on every page. It used to only appear
// once you were already inside the archive or the undervoice, so "why won't
// this unlock" and "am I out of PROBLEMS" were the same question with no
// visible answer. Refetches on the `problems-changed` window event, which
// anything that spends or mints PROBLEMS dispatches, so the nav doesn't sit
// on a stale number after an unlock.
export default function ProblemsCounter() {
  const [balance, setBalance] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const sb = getPublicClient();
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setBalance(null);
        return;
      }
      const res = await fetch("/api/wallet", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const body = await res.json();
      setBalance(body.balance ?? 0);
    } catch {
      // A nav badge is not worth surfacing an error for — it just stays as-is.
    }
  }, []);

  useEffect(() => {
    load();
    // `problems-changed` covers the immediate case (an archive unlock on the
    // page you're already looking at); focus covers everything else — chat
    // minting, an undervoice session — without every one of those call sites
    // having to remember to announce itself.
    window.addEventListener("problems-changed", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("problems-changed", load);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  if (balance === null) return null;

  return (
    <span
      className="text-problem whitespace-nowrap"
      title={`${balance} PROBLEMS — spend them in the archive and the vault`}
    >
      ▣ {balance}
    </span>
  );
}
