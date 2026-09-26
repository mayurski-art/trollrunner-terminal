// The "what is this site?" FAQ as one picture: talk → mint PROBLEMS →
// spend them in logs / archive / vault. Hand-drawn SVG in the site's own
// tokens (--problem gold, --gain green, --dim lines) so it follows the
// light/dark theme. Laid out top-to-bottom at a narrow 360 wide so it stays
// legible at phone width; capped on desktop so the text doesn't balloon.
// Keep the numbers in step with the FAQ copy in components/Faq.tsx.

const BRANCHES = [
  { x: 12, tag: "[ logs ]", lines: ["guess a", "transmission"], cost: "−1 per try", gain: "+10 if right" },
  { x: 128, tag: "[ archive ]", lines: ["unlock", "troll lore"], cost: "−1 per article", gain: null },
  { x: 244, tag: "[ vault ]", lines: ["1 → 25 XP", "69 → 1 $TROLL"], cost: null, gain: "cash out" },
];
const BOX_W = 104;

export default function FaqDiagram() {
  return (
    <svg
      viewBox="0 0 360 392"
      role="img"
      aria-labelledby="faq-diagram-title faq-diagram-desc"
      className="block w-full max-w-[440px] mx-auto font-mono"
    >
      <title id="faq-diagram-title">how the terminal works</title>
      <desc id="faq-diagram-desc">
        Talk to the terminal to mint PROBLEMS; the buddy meter improves bonus odds the more you
        talk. Spend PROBLEMS in the logs to guess transmissions (1 per try, +10 if right), in the
        archive to unlock lore (1 per article), or in the vault for XP (1 = 25 XP) or $TROLL (69 = 1
        $TROLL).
      </desc>
      <defs>
        <marker id="faq-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" style={{ fill: "var(--dim)" }} />
        </marker>
      </defs>

      {/* 1. talk */}
      <rect x="20" y="8" width="320" height="52" style={{ fill: "none", stroke: "var(--terminal)" }} />
      <text x="180" y="30" textAnchor="middle" fontSize="15" style={{ fill: "var(--terminal)" }}>
        1. talk to the terminal
      </text>
      <text x="180" y="48" textAnchor="middle" fontSize="11" style={{ fill: "var(--dim)" }}>
        real messages, not filler
      </text>

      {/* buddy meter side note */}
      <rect x="20" y="70" width="320" height="34" strokeDasharray="4 3" style={{ fill: "none", stroke: "var(--dim)" }} />
      <text x="180" y="91" textAnchor="middle" fontSize="11" style={{ fill: "var(--dim)" }}>
        ♥ buddy meter: talk more → better bonus odds
      </text>

      {/* mints */}
      <line x1="180" y1="104" x2="180" y2="138" markerEnd="url(#faq-arrow)" style={{ stroke: "var(--dim)" }} />
      <text x="190" y="126" fontSize="11" style={{ fill: "var(--dim)" }}>
        mints
      </text>

      {/* 2. PROBLEMS */}
      <rect
        x="20"
        y="142"
        width="320"
        height="58"
        style={{ fill: "color-mix(in srgb, var(--problem) 14%, transparent)", stroke: "var(--problem)", strokeWidth: 2 }}
      />
      <text x="180" y="168" textAnchor="middle" fontSize="17" fontWeight="700" style={{ fill: "var(--problem)" }}>
        2. ▣ PROBLEMS
      </text>
      <text x="180" y="188" textAnchor="middle" fontSize="11" style={{ fill: "var(--problem)" }}>
        your balance · top right corner
      </text>

      {/* spend on → three branches */}
      <line x1="180" y1="200" x2="180" y2="216" style={{ stroke: "var(--dim)" }} />
      <line x1="64" y1="216" x2="296" y2="216" style={{ stroke: "var(--dim)" }} />
      <text x="190" y="211" fontSize="11" style={{ fill: "var(--dim)" }}>
        3. spend on
      </text>
      {BRANCHES.map((b) => {
        const cx = b.x + BOX_W / 2;
        return (
          <g key={b.tag}>
            <line x1={cx} y1="216" x2={cx} y2="236" markerEnd="url(#faq-arrow)" style={{ stroke: "var(--dim)" }} />
            <rect x={b.x} y="240" width={BOX_W} height="116" style={{ fill: "none", stroke: "var(--dim)" }} />
            <text x={cx} y="262" textAnchor="middle" fontSize="12" style={{ fill: "var(--terminal)" }}>
              {b.tag}
            </text>
            {b.lines.map((line, i) => (
              <text key={line} x={cx} y={284 + i * 16} textAnchor="middle" fontSize="11" style={{ fill: "var(--foreground)" }}>
                {line}
              </text>
            ))}
            {b.cost && (
              <text x={cx} y="326" textAnchor="middle" fontSize="11" style={{ fill: "var(--alert)" }}>
                {b.cost}
              </text>
            )}
            {b.gain && (
              <text x={cx} y={b.cost ? 344 : 326} textAnchor="middle" fontSize="11" style={{ fill: "var(--gain)" }}>
                {b.gain}
              </text>
            )}
          </g>
        );
      })}

      <text x="180" y="382" textAnchor="middle" fontSize="11" style={{ fill: "var(--dim)" }}>
        tip: click your balance to spend from any page
      </text>
    </svg>
  );
}
