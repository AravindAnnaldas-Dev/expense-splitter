"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "@/lib/clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium px-4 py-2.5 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2";

const variants = {
  primary: "bg-accent text-accent-fg hover:opacity-90 active:opacity-80",
  secondary: "bg-surface border border-border text-foreground hover:bg-border/40",
  ghost: "text-foreground hover:bg-surface",
  danger: "bg-danger/10 text-danger hover:bg-danger/20",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(base, variants[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";
