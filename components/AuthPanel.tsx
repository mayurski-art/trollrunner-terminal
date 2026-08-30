"use client";

import { useEffect, useState } from "react";
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
  // Matched in JS rather than with an `sm:hidden` twin so only one copy of the
  // form ever exists — a CSS-hidden second copy is still live to autofill.
  // Starts false so SSR and the client's first paint agree.
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
        className="glitch-btn border border-terminal text-terminal px-3 py-1.5 text-sm hover:bg-terminal hover:text-background transition-colors"
      >
        [ join the trolling ]
      </button>
    );
  }

  const form = (
    <form onSubmit={resolved ? submit : proceed} className="space-y-3 text-sm">
      {resolved && (
        <p className="text-dim text-xs">
          {resolved === "login" ? "welcome back, troublemaker" : "never seen you before — let's fix that"}
        </p>
      )}

      <label className="block">
        <span className="text-dim block mb-1">username</span>
        <input
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            if (resolved) reset();
          }}
          className="w-full bg-transparent border border-dim px-2 py-1.5 text-you outline-none focus:border-terminal disabled:opacity-60"
          autoComplete="username"
          disabled={checking}
          required
        />
      </label>

      {resolved && (
        <label className="block">
          <span className="text-dim block mb-1">password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent border border-dim px-2 py-1.5 text-you outline-none focus:border-terminal"
            autoComplete={resolved === "login" ? "current-password" : "new-password"}
            autoFocus
            required
          />
        </label>
      )}

      {error && <p className="text-alert text-xs">[ {error} ]</p>}

      <button
        type="submit"
        disabled={checking || busy}
        className="glitch-btn border border-terminal text-terminal px-3 py-1.5 hover:bg-terminal hover:text-background transition-colors disabled:opacity-40"
      >
        {checking ? "..." : busy ? "..." : !resolved ? "next >" : resolved === "login" ? "connect >" : "register >"}
      </button>
    </form>
  );

  // Desktop/tablet: the form sits inline in its Frame as it always has.
  if (!phone) return form;

  // Phones: sign-in takes over the screen. Inline, the form sits partway down
  // a long scrolling page, so tapping a field makes Safari scroll somewhere
  // unpredictable and then stack the keyboard and the AutoFill bar on top of
  // whatever landed at the bottom. Full-screen gives the native UI the bottom
  // half to itself with no terminal chrome behind it, so the two stop fighting
  // for the same space. Rendered as the only copy of the form — a second,
  // CSS-hidden one would still be visible to Safari's autofill scan.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={resolved === "login" ? "Sign in" : "Join the trolling"}
      className="fixed inset-0 z-50 bg-background/95 overflow-y-auto p-6 flex flex-col justify-center"
    >
      <div className="w-full max-w-sm mx-auto space-y-4">
        <p className="text-dim text-xs">trollface terminal // identify yourself</p>
        {form}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-dim text-xs hover:text-foreground"
        >
          [ cancel ]
        </button>
      </div>
    </div>
  );
}
