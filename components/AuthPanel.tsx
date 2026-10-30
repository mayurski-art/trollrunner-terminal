"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { checkUsernameExists, login, register } from "@/lib/auth";

// Which account state the typed username resolved to — null means "not
// checked yet" (still on the username step), so the password step and its
// copy only ever appear once we actually know.
type Resolved = "login" | "register" | null;

export default function AuthPanel({ onDone }: { onDone?: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [resolved, setResolved] = useState<Resolved>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // iOS Safari pops its "Fill Password" keychain sheet the moment a login form
  // exists in the DOM, which lands right on top of the boot animation. Keep the
  // fields unmounted until the visitor actually asks to sign in.
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Whether the phone dialog has been moved under <body>. `position: fixed`
  // only means "the screen" when no ancestor has a transform, filter or
  // similar; inside the archive's sign-in block one does, so the "full-screen"
  // dialog was as tall as the whole page with the form centred halfway down
  // it, a long scroll from the button. Once the CSS has picked the fixed
  // (phone) layout, the dialog is portalled to <body>, where fixed is the
  // screen again. The desktop dropdown is absolute and stays where it is.
  const [portalled, setPortalled] = useState(false);

  // Desktop dropdown's click-away/Escape only — the phone dialog (below
  // `sm:`) has its own [ cancel ] button, so there's no "outside" to click.
  // This used to gate on a JS-computed `phone` boolean from matchMedia, but
  // that boolean can end up wrong (e.g. it reads the CSS viewport, which
  // Safari's "Request Desktop Site" fakes wide even on a real phone) and the
  // wrong dropdown/dialog would render outright — not just this listener.
  // The markup below is unconditional Tailwind (`sm:` classes only), so the
  // browser's own layout engine decides every time, with nothing to get out
  // of sync. This listener still shouldn't fire on phone-width screens, so it
  // checks the live media query directly rather than trusting stored state.
  useEffect(() => {
    if (!open) return;
    function isPhoneWidth() {
      return window.matchMedia("(max-width: 639px)").matches;
    }
    function onClickAway(e: MouseEvent) {
      if (isPhoneWidth()) return;
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPortalled(false);
      return;
    }
    const el = dropdownRef.current;
    if (el && !portalled && getComputedStyle(el).position === "fixed") setPortalled(true);
  }, [open, portalled]);

  // Step 1 -> step 2: look up the typed username once and remember whether
  // it's an existing account or a new one, so the visitor never has to pick
  // "sign in" vs "create account" themselves.
  async function proceed(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    setError(null);
    setChecking(true);
    try {
      const exists = await checkUsernameExists(identifier);
      setResolved(exists ? "login" : "register");
    } finally {
      setChecking(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolved) return;
    setError(null);
    setBusy(true);
    try {
      if (resolved === "login") {
        await login(identifier, password);
      } else {
        await register(identifier, password);
      }
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function reveal() {
    setOpen(true);
  }

  function reset() {
    setResolved(null);
    setPassword("");
    setError(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={reveal}
        className="glitch-btn glitch-btn-auto border border-terminal text-terminal px-3 py-1.5 text-sm hover:bg-terminal hover:text-background transition-colors"
      >
        [ join the trolling ]
      </button>
    );
  }

  // Sized mobile-first (roomy: base text, tall inputs, full-width button) and
  // shrunk back down at `sm:` for the desktop dropdown. Pure CSS breakpoint —
  // no JS viewport detection. This used to branch in JS on a `phone` boolean
  // from `matchMedia`, which reads the CSS viewport width; Safari's "Request
  // Desktop Site" fakes that wide even on an actual phone, so the JS branch
  // could pick the tiny desktop dropdown on a real phone screen. A `sm:`
  // class can't get that wrong — the browser's own layout engine evaluates it
  // against the real viewport at paint time, every time.
  const form = (
    <form onSubmit={resolved ? submit : proceed} className="space-y-4 sm:space-y-3 text-base sm:text-sm">
      {/* There's no separate sign-up: a name nobody has taken becomes a new
          account on the spot. Say so up front, or "username" + "password"
          reads like you need an account made somewhere else first. */}
      <p className="text-dim text-sm sm:text-xs">
        {resolved === "login"
          ? "welcome back, troublemaker. enter your password."
          : resolved === "register"
            ? "that name is yours. pick any password (8+ characters) and remember it. that's your whole account."
            : "no sign-up needed. pick any username and password and just remember them."}
      </p>

      <label className="block">
        <span className="text-dim block mb-1.5 sm:mb-1 text-sm sm:text-xs">
          {resolved ? "username" : "pick a username"}
        </span>
        <input
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            if (resolved) reset();
          }}
          className="w-full bg-transparent border border-dim rounded-md sm:rounded-none px-3 sm:px-2 py-3 sm:py-1.5 text-base sm:text-sm text-you outline-none focus:border-terminal disabled:opacity-60"
          autoComplete="username"
          disabled={checking}
          required
        />
      </label>

      {resolved && (
        <label className="block">
          <span className="text-dim block mb-1.5 sm:mb-1 text-sm sm:text-xs">
            {resolved === "login" ? "password" : "pick a password"}
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent border border-dim rounded-md sm:rounded-none px-3 sm:px-2 py-3 sm:py-1.5 text-base sm:text-sm text-you outline-none focus:border-terminal"
            autoComplete={resolved === "login" ? "current-password" : "new-password"}
            autoFocus
            required
          />
        </label>
      )}

      {error && <p className="text-alert text-sm sm:text-xs">[ {error} ]</p>}

      <button
        type="submit"
        disabled={checking || busy}
        className="glitch-btn glitch-btn-auto w-full sm:w-auto border border-terminal text-terminal rounded-md sm:rounded-none px-3 py-3 sm:py-1.5 text-base sm:text-sm hover:bg-terminal hover:text-background transition-colors disabled:opacity-40"
      >
        {checking ? "..." : busy ? "..." : !resolved ? "next >" : resolved === "login" ? "connect >" : "start trolling >"}
      </button>
    </form>
  );

  // Below `sm:`: fixed full-screen dialog. Inline, the form sits partway down
  // a long scrolling page, so tapping a field makes Safari scroll somewhere
  // unpredictable and then stack the keyboard and the AutoFill bar on top of
  // whatever landed at the bottom. Full-screen gives the native UI the bottom
  // half to itself with no terminal chrome behind it, so the two stop fighting
  // for the same space.
  //
  // At `sm:` and up: an absolutely-positioned dropdown, like [ menu ]'s own
  // (Nav.tsx) — sitting inline here used to push the whole page down by the
  // form's height the moment it opened, reflowing everything below the nav
  // (banner, ticker, both frames) just from clicking [ join the trolling ].
  //
  // One instance of the form renders either way — a second, CSS-hidden copy
  // would still be visible to Safari's autofill scan and iOS pops its "Fill
  // Password" sheet the moment any login form exists in the DOM.
  const dialog = (
    <div
      ref={dropdownRef}
      role="dialog"
      aria-modal="true"
      aria-label={resolved === "login" ? "Sign in" : "Join the trolling"}
      className="fixed inset-0 z-50 bg-background/95 overflow-y-auto p-6 flex flex-col justify-center sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:block sm:w-64 sm:rounded-md sm:border sm:border-dim sm:bg-black/90 sm:backdrop-blur sm:px-4 sm:py-3 sm:shadow-lg"
    >
      <div className="w-full max-w-sm mx-auto space-y-6 sm:max-w-none sm:mx-0 sm:space-y-0">
        <p className="text-dim text-sm sm:hidden">trollface terminal // pick a name</p>
        {form}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-dim text-sm hover:text-foreground sm:hidden"
        >
          [ cancel ]
        </button>
      </div>
    </div>
  );
  return portalled ? createPortal(dialog, document.body) : dialog;
}
