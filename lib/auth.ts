"use client";

// Thin client-side auth wrapper around the shared TrollRunner Supabase
// project. Mirrors the username scheme in the main site's
// assets/js/troll-accounts.js so an account created on trollrunner.net logs
// in here unchanged, and vice versa.
import { getPublicClient } from "@/lib/supabase";
import { adoptSsoCookie, writeSsoCookie } from "@/lib/sso";

const LOGIN_EMAIL_DOMAIN = "login.trollrunner.net";
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function loginEmailFor(username: string): string {
  return `u_${username.toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;
}

function friendlyError(raw: string, fallback: string): Error {
  if (/invalid login credentials/i.test(raw)) {
    return new Error("Wrong username/email or password.");
  }
  if (/email not confirmed/i.test(raw)) {
    return new Error("This account needs email confirmation — sign in from trollrunner.net first.");
  }
  if (/email.*(taken|exists|in use)|address.*already/i.test(raw)) {
    return new Error("That username is already taken.");
  }
  return new Error(raw || fallback);
}

export async function login(identifier: string, password: string) {
  const sb = getPublicClient();
  const id = identifier.trim();
  if (!id || !password) throw new Error("Enter your username (or email) and password.");

  const { data, error } = await sb.auth.signInWithPassword({
    email: id.includes("@") ? id : loginEmailFor(id),
    password,
  });
  if (error) throw friendlyError(error.message, "Could not sign in.");
  writeSsoCookie(data.session);
  return data.session;
}

export async function register(username: string, password: string) {
  const sb = getPublicClient();
  const name = username.trim();
  if (!USERNAME_RE.test(name)) {
    throw new Error("Usernames are 3–20 letters, numbers, or underscores.");
  }
  if (password.length < 8) {
    throw new Error("Use a password with at least 8 characters.");
  }

  const { data, error } = await sb.auth.signUp({
    email: loginEmailFor(name),
    password,
    options: { data: { username: name } },
  });
  if (error) throw friendlyError(error.message, "Could not create account.");

  let session = data.session;
  if (!session) {
    // Confirm-email is on for this project — sign in anyway, mirroring the
    // main site's flow (its account setup disables confirmation).
    const { data: loginData, error: loginError } = await sb.auth.signInWithPassword({
      email: loginEmailFor(name),
      password,
    });
    if (loginError) throw friendlyError(loginError.message, "Account created — sign in.");
    session = loginData.session;
  }
  writeSsoCookie(session);
  return session;
}

// Backs the single sign-in/create-account form's auto-detect: ask the
// server whether this username already has an account before deciding
// whether to log in or register. Fails open to "new account" — worst case
// is a clear "username taken" error on submit instead of a silent block.
export async function checkUsernameExists(username: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/check-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim() }),
    });
    if (!res.ok) return false;
    const body = await res.json();
    return !!body.exists;
  } catch {
    return false;
  }
}

export async function logout() {
  const sb = getPublicClient();
  await sb.auth.signOut();
  writeSsoCookie(null);
}

export async function getSession() {
  try {
    await adoptSsoCookie();
    const sb = getPublicClient();
    const { data } = await sb.auth.getSession();
    return data.session;
  } catch (err) {
    // A misconfigured/missing Supabase env var should degrade to "not
    // logged in", not crash every page that checks auth state on mount.
    console.error("[auth] getSession unavailable:", err);
    return null;
  }
}

export function onAuthChange(cb: (session: import("@supabase/supabase-js").Session | null) => void) {
  try {
    const sb = getPublicClient();
    const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session));
    return () => data.subscription.unsubscribe();
  } catch (err) {
    console.error("[auth] onAuthChange unavailable:", err);
    return () => {};
  }
}

export function displayName(session: { user: { user_metadata?: Record<string, unknown> } } | null): string | null {
  if (!session) return null;
  const meta = session.user.user_metadata;
  return (meta?.username as string | undefined) ?? null;
}

export { EMAIL_RE };
