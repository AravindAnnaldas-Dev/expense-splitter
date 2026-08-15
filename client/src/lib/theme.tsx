"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

const STORAGE_KEY = "theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start with "light" on the server (and first client render) to match
  // the inline script in layout.tsx that already applied the real class
  // before hydration — see the comment there for why we need both.
  const [theme, setTheme] = useState<Theme>("light");
  // Guards the effect below from running with the "light" default before
  // we've actually read localStorage — without this, mount fires both
  // effects with theme still "light", which strips the "dark" class the
  // inline script (layout.tsx) already applied, causing a flash back to
  // light before flipping to the real saved theme a moment later.
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    setResolved(true);
  }, []);

  useEffect(() => {
    if (!resolved) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, resolved]);

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
