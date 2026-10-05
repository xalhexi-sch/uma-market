"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RiCalendarLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OVERVIEW_RANGE_KEYS, type OverviewRangeKey } from "@/lib/overview-range";
import { formatDayKeyLong } from "@/lib/overview-format";

const PRESETS: Array<{ key: Exclude<OverviewRangeKey, "custom">; label: string }> = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "mtd", label: "MTD" },
];

/** A custom window is only usable once both ends are a valid ordered pair. */
function completeCustom(from?: string, to?: string): boolean {
  return Boolean(from && to && from <= to);
}

/** react-day-picker hands back a local-midnight Date; take its calendar day. */
function toDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDayKey(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00`);
}

/**
 * Writes the selected window to the URL — the same search params
 * `resolveOverviewRange` already reads — so the range survives reload and
 * shared links, and no widget can disagree about the window.
 */
export function RangeControl({
  activeKey,
  from,
  to,
}: {
  activeKey: OverviewRangeKey;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const custom = activeKey === "custom" && completeCustom(from, to);

  function apply(params: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(params)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Tabs
        // No trigger owns "custom", so a custom window shows no preset as
        // selected — the Custom button carries that state instead.
        value={activeKey === "custom" ? "" : activeKey}
        onValueChange={(value) => {
          const key = value as OverviewRangeKey;
          if (!OVERVIEW_RANGE_KEYS.includes(key) || key === "custom") return;
          setOpen(false);
          // Switching to a preset clears stale custom bounds, otherwise the
          // next custom pick would start from an old pair.
          apply({ range: key, from: undefined, to: undefined });
        }}
      >
        <TabsList>
          {PRESETS.map((preset) => (
            <TabsTrigger key={preset.key} value={preset.key} className="px-2.5 text-xs">
              {preset.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant={custom ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5 text-xs font-medium"
            />
          }
        >
          <RiCalendarLine className="size-3.5" />
          {custom ? `${from} → ${to}` : "Custom"}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto">
          <Calendar
            mode="range"
            defaultMonth={from ? fromDayKey(from) : undefined}
            selected={
              from
                ? { from: fromDayKey(from), to: to ? fromDayKey(to) : undefined }
                : undefined
            }
            onSelect={(value) => {
              const start = value?.from ? toDayKey(value.from) : undefined;
              const end = value?.to ? toDayKey(value.to) : undefined;
              // A single click is a start, not a range — wait for the second.
              if (!start || !end) return;
              setOpen(false);
              apply({ range: "custom", from: start, to: end });
            }}
            numberOfMonths={2}
            className="p-0"
          />
          <p className="px-1 pb-1 text-[11px] text-muted-foreground">
            {custom
              ? `${formatDayKeyLong(from!)} – ${formatDayKeyLong(to!)}`
              : "Pick a start and end date."}
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}