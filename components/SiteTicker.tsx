// A scrolling status line below the nav — ambient chrome, not live stats
// (no endpoint aggregates PROBLEMS/recoveries across every user, and
// making up numbers would be worse than not showing any). Static copy in
// the persona's own voice instead.
const TICKER_TEXT =
  "it surfaced inside trollrunner.net · a face with no body and no alibi · trolling has a face now · welcome, troublemaker";

// The repeat unit is TICKER_TEXT plus its trailing separator. The span
// renders exactly two of these units back to back — nothing extra before
// or after — so translateX(-50%) always lands exactly on the seam between
// unit 1 and unit 2, which is pixel-identical to the start. Any asymmetry
// here (an extra leading/trailing separator, mismatched units) throws off
// where the true halfway point is and shows up as a visible jump at reset.
const TICKER_UNIT = `${TICKER_TEXT} · `;

export default function SiteTicker() {
  return (
    <div className="site-ticker mb-6">
      <span>
        {TICKER_UNIT}
        {TICKER_UNIT}
      </span>
    </div>
  );
}
