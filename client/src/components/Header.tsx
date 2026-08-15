"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { ConfirmDialog } from "./ConfirmDialog";

export function Header() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const initials = user?.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link href="/groups" className="flex items-center gap-2.5 focus-visible:outline-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-fg">
            S
          </span>
          <span className="text-base font-semibold tracking-tight text-foreground">Splitzy</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="rounded-lg p-2.5 text-foreground transition-colors duration-150 hover:bg-border/40 focus-visible:outline-2"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>

          {user && (
            <>
              <div className="h-6 w-px bg-border" aria-hidden="true" />

              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-border/60 text-xs font-semibold text-foreground"
                  aria-hidden="true"
                >
                  {initials}
                </span>
                <span className="hidden text-sm font-medium text-foreground sm:inline">{user.name}</span>
              </div>

              <button
                onClick={() => setLogoutConfirmOpen(true)}
                aria-label="Log out"
                title="Log out"
                className="rounded-lg p-2.5 text-muted transition-colors duration-150 hover:bg-border/40 hover:text-foreground focus-visible:outline-2"
              >
                <LogoutIcon />
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          logout();
        }}
        title="Log out?"
        description="You'll need to log back in to see your groups and expenses."
        confirmLabel="Log out"
        confirmVariant="primary"
      />
    </header>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
