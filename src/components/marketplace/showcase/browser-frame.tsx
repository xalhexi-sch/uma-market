import * as React from "react";
import { RiLockLine, RiRefreshLine } from "@remixicon/react";

interface BrowserFrameProps {
  children: React.ReactNode;
  url?: string;
  badge?: string;
  className?: string;
  contentClassName?: string;
}

export function BrowserFrame({
  children,
  url = "uma.market/products",
  badge,
  className = "",
  contentClassName = "",
}: BrowserFrameProps) {
  return (
    <div
      className={`rounded-2xl border border-border/80 bg-card shadow-2xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden ${className}`}
    >
      {/* Browser Chrome Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 sm:px-5">
        {/* Window controls (traffic lights) */}
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-rose-500/80 inline-block shadow-2xs" />
          <span className="size-3 rounded-full bg-amber-400/80 inline-block shadow-2xs" />
          <span className="size-3 rounded-full bg-emerald-500/80 inline-block shadow-2xs" />
        </div>

        {/* Address / URL Bar */}
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-2xs max-w-sm sm:max-w-md w-full font-mono">
          <RiLockLine className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate text-foreground/85 font-sans font-medium">{url}</span>
          <RiRefreshLine className="size-3 text-muted-foreground/60 shrink-0 ml-auto hidden sm:inline-block" />
        </div>

        {/* Right pill / badge indicator */}
        <div className="flex items-center gap-2">
          {badge ? (
            <span className="hidden sm:inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {badge}
            </span>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>

      {/* Main Screen Viewport */}
      <div className={`relative bg-background overflow-hidden ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}
