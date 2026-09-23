import * as React from "react";
import { RiWifiLine, RiBatteryChargeLine } from "@remixicon/react";

interface PhoneFrameProps {
  children: React.ReactNode;
  className?: string;
  screenClassName?: string;
}

export function PhoneFrame({
  children,
  className = "",
  screenClassName = "",
}: PhoneFrameProps) {
  return (
    <div
      className={`relative mx-auto max-w-[320px] sm:max-w-[340px] rounded-[44px] sm:rounded-[50px] bg-zinc-950 p-3 shadow-2xl ring-1 ring-zinc-800/80 ${className}`}
      style={{
        boxShadow:
          "0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Outer subtle frame sheen / side buttons simulation */}
      <div className="relative rounded-[36px] sm:rounded-[40px] overflow-hidden bg-background border border-zinc-800/60 flex flex-col">
        {/* Dynamic Island / Status Bar */}
        <div className="relative z-20 flex items-center justify-between px-6 pt-3 pb-2 text-[11px] font-semibold text-foreground/80 bg-background/95 backdrop-blur-xs select-none">
          <span>9:41</span>

          {/* Dynamic Island Cutout */}
          <div className="absolute left-1/2 -translate-x-1/2 top-2.5 h-4 w-20 rounded-full bg-zinc-950 flex items-center justify-end px-2">
            <span className="size-2 rounded-full bg-zinc-800" />
          </div>

          <div className="flex items-center gap-1.5 text-foreground/70">
            <RiWifiLine className="size-3.5" />
            <RiBatteryChargeLine className="size-3.5 text-emerald-500" />
          </div>
        </div>

        {/* Screen Content Viewport */}
        <div className={`relative flex-1 overflow-y-auto no-scrollbar bg-background ${screenClassName}`}>
          {children}
        </div>

        {/* Home Indicator Bar */}
        <div className="relative z-20 py-2.5 flex justify-center bg-background/95 backdrop-blur-xs">
          <div className="h-1 w-28 rounded-full bg-foreground/25" />
        </div>
      </div>
    </div>
  );
}
