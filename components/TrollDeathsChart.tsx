"use client";

import { useEffect, useMemo, useState } from "react";
import Frame from "@/components/Frame";
import type { TrollDeathItem } from "@/app/trolldeaths/page";

type PricePoint = [number, number]; // [timestamp, price]

const RANGES = [
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
  { key: "365", label: "1y" },
  { key: "max", label: "max" },
] as const;

function fmtPrice(value: number): string {
  const fractionDigits = value > 0 && value < 0.01 ? 8 : 4;
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: fractionDigits });
}

function fmtCompactDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getNearestIndex(points: PricePoint[], timestamp: number): number {
  let nearest = 0;
  let smallest = Math.abs(points[0][0] - timestamp);
  for (let i = 1; i < points.length; i++) {
    const d = Math.abs(points[i][0] - timestamp);
    if (d < smallest) {
      smallest = d;
      nearest = i;
    }
  }
  return nearest;
}

const WIDTH = 920;
const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 20, left: 8 };

export default function TrollDeathsChart({ items }: { items: TrollDeathItem[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("365");
  const [points, setPoints] = useState<PricePoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeEvent, setActiveEvent] = useState<TrollDeathItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    setError(null);
    setActiveEvent(null);
    fetch(`/api/trolldeaths/chart?days=${range}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else setPoints(data.prices ?? []);
      })
      .catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const chart = useMemo(() => {
    if (!points || points.length < 2) return null;
    const prices = points.map((p) => p[1]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || max || 1;
    const chartW = WIDTH - PAD.left - PAD.right;
    const chartH = HEIGHT - PAD.top - PAD.bottom;
    const xFor = (i: number) => PAD.left + (chartW * i) / Math.max(points.length - 1, 1);
    const yFor = (v: number) => PAD.top + ((max - v) / span) * chartH;
    const coords = points.map((p, i): [number, number] => [xFor(i), yFor(p[1])]);
    const linePath = "M" + coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" L");
    const areaPath = `${linePath} L${(PAD.left + chartW).toFixed(2)},${(HEIGHT - PAD.bottom).toFixed(2)} L${PAD.left.toFixed(2)},${(HEIGHT - PAD.bottom).toFixed(2)} Z`;
    const first = prices[0];
    const last = prices[prices.length - 1];
    const change = first ? ((last - first) / first) * 100 : 0;
    const start = points[0][0];
    const end = points[points.length - 1][0];

    const eventMarkers = items
      .map((item) => {
        if (!item.eventDate) return null;
        const eventTime = new Date(item.eventDate).getTime();
        return { item, eventTime };
      })
      .filter((e): e is { item: TrollDeathItem; eventTime: number } => !!e && !Number.isNaN(e.eventTime));

    const markers = eventMarkers
      .filter((e) => e.eventTime >= start && e.eventTime <= end)
      .map((e) => {
        const idx = getNearestIndex(points, e.eventTime);
        return { item: e.item, x: coords[idx][0], y: coords[idx][1] };
      });

    return { min, max, change, linePath, areaPath, markers, start, end };
  }, [points, items]);

  const lineTone = chart && chart.change < 0 ? "var(--alert)" : "var(--gain)";

  return (
    <Frame title="$troll price" tone="terminal" className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={`border px-2 py-1 transition-colors ${
                range === r.key
                  ? "border-terminal text-terminal"
                  : "border-dim text-dim hover:border-terminal hover:text-terminal"
              }`}
            >
              [ {r.label} ]
            </button>
          ))}
        </div>
        {chart && (
          <div className="text-xs text-dim">
            change:{" "}
            <span style={{ color: lineTone }}>
              {chart.change >= 0 ? "+" : ""}
              {chart.change.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {error && <p className="text-alert text-sm">[chart unavailable: {error}]</p>}
      {!error && !chart && <p className="text-dim text-sm animate-pulse">loading price history...</p>}

      {!error && chart && (
        <div className="relative">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full h-auto"
            role="img"
            aria-label="$TROLL price history line chart"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((step) => {
              const y = PAD.top + (HEIGHT - PAD.top - PAD.bottom) * step;
              return (
                <line
                  key={step}
                  x1={PAD.left}
                  y1={y}
                  x2={WIDTH - PAD.right}
                  y2={y}
                  stroke="var(--dim)"
                  strokeOpacity={0.25}
                  strokeWidth={1}
                />
              );
            })}
            <path d={chart.areaPath} fill={lineTone} fillOpacity={0.08} stroke="none" />
            <path d={chart.linePath} fill="none" stroke={lineTone} strokeWidth={1.5} />
            {chart.markers.map((m, i) => (
              <circle
                key={i}
                cx={m.x}
                cy={m.y}
                r={5}
                fill={m.item.kind === "guardian" ? "var(--terminal)" : "var(--alert)"}
                fillOpacity={0.85}
                stroke="var(--background)"
                strokeWidth={1}
                className="cursor-pointer"
                onClick={() => setActiveEvent(m.item)}
              />
            ))}
            <text x={PAD.left} y={HEIGHT - 5} fill="var(--dim)" fontSize={10}>
              {fmtCompactDate(chart.start)}
            </text>
            <text x={WIDTH - PAD.right} y={HEIGHT - 5} fill="var(--dim)" fontSize={10} textAnchor="end">
              {fmtCompactDate(chart.end)}
            </text>
            <text x={WIDTH - PAD.right} y={PAD.top + 10} fill="var(--dim)" fontSize={10} textAnchor="end">
              ${fmtPrice(chart.max)}
            </text>
            <text x={WIDTH - PAD.right} y={HEIGHT - PAD.bottom - 4} fill="var(--dim)" fontSize={10} textAnchor="end">
              ${fmtPrice(chart.min)}
            </text>
          </svg>

          {activeEvent && (
            <div className="mt-3 border border-dim p-3 text-xs bg-panel">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={activeEvent.kind === "guardian" ? "text-terminal" : "text-alert"}>
                  [ {activeEvent.kind} ] {activeEvent.date}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveEvent(null)}
                  className="text-dim hover:text-terminal"
                  aria-label="close"
                >
                  [ x ]
                </button>
              </div>
              <p className="text-foreground font-bold mb-1">{activeEvent.title}</p>
              <p className="text-dim leading-relaxed">{activeEvent.copy}</p>
              {activeEvent.sourceHref && (
                <a
                  href={activeEvent.sourceHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block hover:text-terminal underline decoration-dim underline-offset-2"
                >
                  {activeEvent.sourceLabel ?? "view source"}
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </Frame>
  );
}
