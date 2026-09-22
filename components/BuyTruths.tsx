"use client";

/**
 * Front-page CTA to buy $TRUTHS, the terminal's own coin (lore §57), on
 * pump.fun.
 *
 * Deliberately the same visual grammar as AuthPanel's "[ join the trolling ]"
 * entry button — bracketed lowercase label, terminal border, and the
 * always-on `glitch-btn-auto` shake — because those two are the page's only
 * two "do the thing" CTAs and should read as a matched pair rather than one
 * of them looking like a stray link.
 *
 * The mint is hardcoded here rather than imported from the truths-price API
 * route: that route is server-side (`app/api/truths-price/route.ts`) and this
 * is a client component, so importing it would drag the route module into the
 * client bundle to reuse one string constant.
 *
 * Renders as a repeated row (not a single button) so the CTA spans the same
 * width as SiteTicker directly below it, instead of sitting as one small
 * island above a full-width marquee.
 */
const TRUTHS_MINT = "HsryXB2BdWJuRXAY29hDcw2g4BPH57Q5nL1qu8kQpump";
const PUMP_FUN_URL = `https://pump.fun/coin/${TRUTHS_MINT}`;
const BUTTON_COUNT = 6;

export default function BuyTruths() {
  return (
    <div className="flex flex-wrap justify-center gap-2 w-full">
      {Array.from({ length: BUTTON_COUNT }).map((_, i) => (
        <a
          key={i}
          href={PUMP_FUN_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Buy $TRUTHS on pump.fun (opens in a new tab)"
          aria-hidden={i === 0 ? undefined : true}
          tabIndex={i === 0 ? undefined : -1}
          className="glitch-btn glitch-btn-auto flex-1 min-w-[7.5rem] text-center border border-terminal text-terminal px-3 py-1.5 text-sm hover:bg-terminal hover:text-background transition-colors"
        >
          [ buy $TRUTHS ]
        </a>
      ))}
    </div>
  );
}
