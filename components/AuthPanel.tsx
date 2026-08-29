"use client";

import { useState } from "react";
import { login, register } from "@/lib/auth";

type Mode = "login" | "register";

export default function AuthPanel({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // iOS Safari pops its "Fill Password" keychain sheet the moment a login form
  // exists in the DOM, which lands right on top of the boot animation. Keep the
  // fields unmounted until the visitor actually asks to sign in.
  const [open, setOpen] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
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

  function reveal(next: Mode) {
    setMode(next);
    setOpen(true);
  }

  if (!open) {
    return (
      <div className="flex gap-4 text-sm">
        <button
          type="button"
          onClick={() => reveal("login")}
          className="glitch-btn border border-terminal text-terminal px-3 py-1.5 hover:bg-terminal hover:text-background transition-colors"
        >
          [ sign in ]
        </button>
        <button
          type="button"
          onClick={() => reveal("register")}
          className="border border-dim text-dim px-3 py-1.5 hover:text-foreground hover:border-foreground transition-colors"
        >
          [ create account ]
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-sm">
      <div className="flex gap-4 text-xs text-dim">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={mode === "login" ? "text-terminal" : "hover:text-foreground"}
        >
          [ sign in ]
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={mode === "register" ? "text-terminal" : "hover:text-foreground"}
        >
          [ create account ]
        </button>
      </div>

      <label className="block">
        <span className="text-dim block mb-1">
          {mode === "login" ? "username or email" : "choose a username"}
        </span>
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="w-full bg-transparent border border-dim px-2 py-1.5 text-you outline-none focus:border-terminal"
          autoComplete="username"
          required
        />
      </label>

      <label className="block">
        <span className="text-dim block mb-1">password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-transparent border border-dim px-2 py-1.5 text-you outline-none focus:border-terminal"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
      </label>

      {error && <p className="text-alert text-xs">[ {error} ]</p>}

      <button
        type="submit"
        disabled={busy}
        className="glitch-btn border border-terminal text-terminal px-3 py-1.5 hover:bg-terminal hover:text-background transition-colors disabled:opacity-40"
      >
        {busy ? "..." : mode === "login" ? "connect >" : "register >"}
      </button>
    </form>
  );
}
