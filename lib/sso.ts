import type { Session } from "@supabase/supabase-js";
import { getPublicClient } from "@/lib/supabase";

// Every TrollRunner subdomain shares the registrable domain trollrunner.net,
// so a cookie set with Domain=.trollrunner.net is visible to all of them on
// a normal top-level load — no iframe bridge needed. This mirrors the
// current session into that cookie on auth changes, and adopts it on init
// if this origin doesn't already have one, giving free cross-subdomain SSO
// (e.g. already logged into trollrunner.net → already logged in here).
// Ported from assets/js/troll-accounts.js in the main site repo — keep the
// cookie name/shape in sync with that file and trollrunner-fitness's
// src/lib/accounts/sso.ts.
const SSO_COOKIE = "trollrunner_sso";

function ssoCookieDomain(): string | null {
  return /(^|\.)trollrunner\.net$/i.test(window.location.hostname)
    ? ".trollrunner.net"
    : null;
}

export function writeSsoCookie(session: Session | null) {
  const domain = ssoCookieDomain();
  if (!domain) return;
  if (!session) {
    document.cookie = `${SSO_COOKIE}=; Domain=${domain}; Path=/; Max-Age=0; SameSite=Lax; Secure`;
    return;
  }
  const value = encodeURIComponent(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
  );
  document.cookie = `${SSO_COOKIE}=${value}; Domain=${domain}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`;
}

function readSsoCookie(): { access_token: string; refresh_token: string } | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${SSO_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

let adopted: Promise<void> | null = null;

// Idempotent — safe to call from every page that checks session state.
export function adoptSsoCookie(): Promise<void> {
  if (!adopted) adopted = adoptSsoCookieOnce();
  return adopted;
}

async function adoptSsoCookieOnce() {
  if (!ssoCookieDomain()) return;
  keepSsoCookieFresh();
  const sb = getPublicClient();
  const { data } = await sb.auth.getSession();
  if (data?.session) return; // this origin already has its own session
  const cookieSession = readSsoCookie();
  if (!cookieSession?.access_token || !cookieSession?.refresh_token) return;
  try {
    await sb.auth.setSession(cookieSession);
  } catch {
    // stale/expired — ignore
  }
}

let watching = false;

// Supabase refresh tokens rotate and are single-use — the cookie written at
// login time goes stale the instant this tab's session silently refreshes
// (which happens routinely; access tokens are short-lived), leaving every
// *other* device stuck adopting an already-consumed refresh token. Keeping
// the cookie in lockstep with every auth state change (not just explicit
// login/logout) is what makes cross-device SSO actually stay alive instead
// of working once and then failing on the next device to try it.
export function keepSsoCookieFresh() {
  if (watching || !ssoCookieDomain()) return;
  watching = true;
  const sb = getPublicClient();
  sb.auth.onAuthStateChange((_event, session) => {
    writeSsoCookie(session);
  });
}
