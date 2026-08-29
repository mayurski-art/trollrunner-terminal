// A scrolling status line below the nav — ambient chrome, not live stats
// (no endpoint aggregates PROBLEMS/recoveries across every user, and
// making up numbers would be worse than not showing any). Static copy in
// the persona's own voice instead.
const TICKER_TEXT =
  "it surfaced inside trollrunner.net · a face with no body and no alibi · trolling has a face now · welcome, troublemaker";

export default function SiteTicker() {
  return (
    <div className="site-ticker mb-6">
      <span>
        {TICKER_TEXT} &middot; {TICKER_TEXT} &middot;{" "}
      </span>
    </div>
  );
}
