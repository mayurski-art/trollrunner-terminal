import type { CSSProperties, PointerEvent, ReactNode } from "react";

type FrameProps = {
  title?: string;
  children: ReactNode;
  variant?: "double" | "single";
  tone?: "dim" | "terminal" | "problem" | "alert";
  className?: string;
  bodyClassName?: string;
  /** Opt-in: a neon sweep runs once left-to-right across the whole
   * "[ title ]", then settles into a steady glow. Off by default —
   * reserved for the homepage's two hero panels, not every Frame. */
  titleEffect?: "trace";
  traceHue?: string;
  /** Rendered pinned to the top-right inner corner, alongside the title. */
  cornerAction?: ReactNode;
  style?: CSSProperties;
  /** When set, renders an invisible strip across the top edge that starts
   * a drag on pointerdown — used to make a fixed-position Frame (e.g. the
   * popped-out chat) movable by its title bar. Pairs with
   * onHeaderPointerMove/Up, which fire on the same element once pointer
   * capture is set in the pointerdown handler. */
  onHeaderPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
  onHeaderPointerMove?: (e: PointerEvent<HTMLDivElement>) => void;
  onHeaderPointerUp?: (e: PointerEvent<HTMLDivElement>) => void;
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
  titleEffect,
  traceHue,
  cornerAction,
  style,
  onHeaderPointerDown,
  onHeaderPointerMove,
  onHeaderPointerUp,
}: FrameProps) {
  const borderStyle = variant === "double" ? "border-double" : "border-solid";
  const borderWidth = variant === "double" ? "border-[6px]" : "border";

  return (
    <div
      className={`relative ${borderWidth} ${borderStyle} ${TONE_COLOR[tone]} bg-panel/85 backdrop-blur-sm ${className}`}
      style={{ ...(traceHue ? { "--trace-hue": traceHue } : undefined), ...style } as CSSProperties}
    >
      {titleEffect === "trace" && (
        <>
          <span aria-hidden="true" className="frame-trace-border" />
          {title && (
            <span className="frame-trace absolute -top-3 left-4 w-fit self-start bg-panel/85 backdrop-blur-sm px-2 text-xs tracking-wide">
              [ {title} ]
            </span>
          )}
        </>
      )}
      {title && titleEffect !== "trace" && (
        <span
          className={`absolute -top-3 left-4 w-fit self-start bg-panel/85 backdrop-blur-sm px-2 text-xs tracking-wide ${TONE_COLOR[tone].split(" ")[1]}`}
        >
          [ {title} ]
        </span>
      )}
      {cornerAction && (
        <div className="absolute -top-3 right-4 bg-panel/85 backdrop-blur-sm px-2 z-10">{cornerAction}</div>
      )}
      {onHeaderPointerDown && (
        <div
          className="absolute -top-3 left-0 right-0 h-8 cursor-grab active:cursor-grabbing"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
          aria-hidden="true"
        />
      )}
      <div className={`p-4 sm:p-5 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
