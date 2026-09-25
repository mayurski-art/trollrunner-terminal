"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import Banner from "@/components/Banner";
import Frame from "@/components/Frame";
import TrollDeathsChart from "@/components/TrollDeathsChart";
import Faq from "@/components/Faq";
import { BANNER_TROLLDEATHS } from "@/lib/ascii";

export type TrollDeathKind = "fud" | "guardian";

export type TrollDeathItem = {
  id?: string;
  kind: TrollDeathKind;
  date: string;
  eventDate?: string;
  title: string;
  copy: string;
  tags?: string[];
  sourceLabel?: string;
  sourceHref?: string;
};

const KIND_META: Record<TrollDeathKind, { label: string; tone: "alert" | "terminal" }> = {
  fud: { label: "fud", tone: "alert" },
  guardian: { label: "guardian", tone: "terminal" },
};

export default function TrollDeathsPage() {
  const [items, setItems] = useState<TrollDeathItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TrollDeathKind | "all">("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trolldeaths")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else setItems(data.items ?? []);
      })
      .catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = items?.filter((it) => filter === "all" || it.kind === filter) ?? null;

  return (
    <main className="home-hero flex-1 flex flex-col items-center px-4 py-10 sm:py-14">
      <div className="home-hero-bg-frame" aria-hidden="true">
        <div className="home-hero-bg" />
      </div>
      <div className="w-full max-w-7xl">
        <Nav />
        <Banner art={BANNER_TROLLDEATHS} label="trolldeaths" tone="alert" />
        <p className="text-foreground font-bold text-sm mb-8">
          receipts on who called it and who was wrong
        </p>

        {items && items.length > 0 && <TrollDeathsChart items={items} />}

        {items && items.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
            {(["all", "fud", "guardian"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                aria-pressed={filter === k}
                className={`border px-2 py-1 transition-colors ${
                  filter === k
                    ? "border-terminal text-terminal"
                    : "border-dim text-dim hover:border-terminal hover:text-terminal"
                }`}
              >
                {k === "all" ? "[ all ]" : `[ ${KIND_META[k].label} ]`}
              </button>
            ))}
          </div>
        )}

        {error && (
          <Frame title="trolldeaths" tone="terminal">
            <p className="text-alert text-sm">[connection error: {error}]</p>
          </Frame>
        )}
        {!error && items === null && (
          <Frame title="trolldeaths" tone="terminal">
            <p className="text-dim text-sm animate-pulse">loading ledger...</p>
          </Frame>
        )}
        {!error && items && items.length === 0 && (
          <Frame title="trolldeaths" tone="terminal">
            <p className="text-dim text-sm">[no entries yet]</p>
          </Frame>
        )}
        {!error && filtered && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item, i) => {
              const meta = KIND_META[item.kind];
              return (
                <Frame
                  key={item.id ?? `${item.kind}-${i}`}
                  tone={meta.tone}
                  bodyClassName="flex flex-col h-full"
                >
                  <div className="flex items-center gap-2 text-xs mb-2">
                    <span className={meta.tone === "alert" ? "text-alert" : "text-terminal"}>
                      [ {meta.label} ]
                    </span>
                    <span className="text-dim">{item.date}</span>
                  </div>
                  <p className="text-foreground text-sm font-bold mb-1">{item.title}</p>
                  <p className="text-dim text-sm leading-relaxed flex-1">{item.copy}</p>
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] lg:text-sm text-dim">
                      {item.tags.map((tag) => (
                        <span key={tag} className="border border-dim px-1.5 py-0.5">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.sourceHref && (
                    <div className="mt-3 pt-3 border-t border-dim/40 text-xs">
                      <a
                        href={item.sourceHref}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-terminal underline decoration-dim underline-offset-2"
                      >
                        {item.sourceLabel ?? "view source"}
                      </a>
                    </div>
                  )}
                </Frame>
              );
            })}
          </div>
        )}
        {!error && filtered && filtered.length === 0 && items && items.length > 0 && (
          <Frame title="trolldeaths" tone="terminal">
            <p className="text-dim text-sm">[no {KIND_META[filter as TrollDeathKind]?.label ?? ""} entries yet]</p>
          </Frame>
        )}

        <p className="relative z-[1] text-foreground text-xs mt-8 text-center [text-shadow:0_1px_3px_var(--background)]">
          part of the{" "}
          <a
            href="https://trollrunner.net"
            className="glow-loop underline decoration-dim underline-offset-4"
          >
            trollrunner.net
          </a>{" "}
          network
        </p>
        <Faq />
      </div>
    </main>
  );
}
