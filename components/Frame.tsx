import type { ReactNode } from "react";

type FrameProps = {
  title?: string;
  children: ReactNode;
  variant?: "double" | "single";
  tone?: "dim" | "terminal" | "problem" | "alert";
  className?: string;
  bodyClassName?: string;
};

const TONE_COLOR: Record<NonNullable<FrameProps["tone"]>, string> = {
  dim: "border-dim text-dim",
  terminal: "border-terminal text-terminal",
  problem: "border-problem text-problem",
  alert: "border-alert text-alert",
};

// A box-drawing-styled panel. Uses real CSS borders (double-line style)
// rather than literal ╔═╗ character rows, so it stays crisp and responsive
// at any width — the title is cut into the top border the way a real
// terminal-UI box would render it.
export default function Frame({
  title,
  children,
  variant = "single",
  tone = "dim",
  className = "",
  bodyClassName = "",
}: FrameProps) {
  const borderStyle = variant === "double" ? "border-double" : "border-solid";
  const borderWidth = variant === "double" ? "border-[6px]" : "border";

  return (
    <div
      className={`relative ${borderWidth} ${borderStyle} ${TONE_COLOR[tone]} bg-panel/60 ${className}`}
    >
      {title && (
        <span
          className={`absolute -top-3 left-4 bg-background px-2 text-xs tracking-wide ${TONE_COLOR[tone].split(" ")[1]}`}
        >
          [ {title} ]
        </span>
      )}
      <div className={`p-4 sm:p-5 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
