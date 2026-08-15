import { HTMLAttributes } from "react";
import clsx from "@/lib/clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-card border border-border bg-surface shadow-subtle",
        className
      )}
      {...props}
    />
  );
}
