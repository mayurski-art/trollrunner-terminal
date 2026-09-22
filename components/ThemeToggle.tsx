"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "theme";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export default function ThemeToggle() {
  // Starts "dark" (the site default) until the effect below reads
  // localStorage, so server and first client render always agree.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light") {
      setTheme("light");
      applyTheme("light");
    }
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "switch to light mode" : "switch to dark mode"}
      className="nav-neon nav-neon--terminal nav-neon--theme whitespace-nowrap"
    >
      {theme === "dark" ? "[ light ]" : "[ dark ]"}
    </button>
  );
}
