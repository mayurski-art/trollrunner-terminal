import { blockMeter } from "@/lib/ascii";

type MeterProps = {
  fraction: number; // 0..1
  width?: number;
  tone?: "terminal" | "problem" | "alert";
  label?: string;
};

const TONE_COLOR: Record<NonNullable<MeterProps["tone"]>, string> = {
  terminal: "text-terminal",
  problem: "text-problem",
  alert: "text-alert",
};

// Renders a block-character progress meter, e.g. "███████░░░░░░░ 47%".
// Purely decorative text — screen readers get the label + percentage via
// aria, not the block characters.
export default function Meter({
  fraction,
  width = 12,
  tone = "problem",
  label,
}: MeterProps) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "progress"}
      className="font-mono text-[9px] sm:text-xs"
    >
      {label && <span className="text-dim mr-2">{label}</span>}
      <span aria-hidden="true" className={TONE_COLOR[tone]}>
        {blockMeter(fraction, width)}
      </span>
    </div>
  );
}
