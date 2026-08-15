"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "@/lib/clsx";

interface Toast {
  id: number;
  message: string;
  variant: "success" | "error";
}

const ToastContext = createContext<{ show: (message: string, variant?: Toast["variant"]) => void } | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // The server has no `document` to portal into, so it renders nothing here.
  // Checking `typeof document !== "undefined"` inline doesn't fix that — the
  // client's *first* render pass (before effects run) needs to match the
  // server's output too, or React flags a hydration mismatch. Gating on a
  // mounted flag that only flips true in an effect (post-hydration) keeps
  // both initial passes rendering nothing, then reveals the portal right
  // after.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const show = useCallback((message: string, variant: Toast["variant"] = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
            role="region"
            aria-live="polite"
            aria-label="Notifications"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                role="status"
                className={clsx(
                  "rounded-lg border px-4 py-2.5 text-sm shadow-elevated animate-in",
                  t.variant === "success"
                    ? "border-success/30 bg-surface text-success"
                    : "border-danger/30 bg-surface text-danger"
                )}
              >
                {t.message}
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
