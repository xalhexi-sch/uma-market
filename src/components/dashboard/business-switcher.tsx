"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  RiPlantLine,
  RiBuildingLine,
  RiArrowDownSLine,
  RiCheckLine,
  RiAddLine,
  RiExchangeLine,
  RiSettings4Line,
} from "@remixicon/react";
import { routes } from "@/platform/routes";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ActiveBusinessIdentity } from "@/platform";
import { switchBusinessAction, createBusinessAction } from "@/platform/business-actions";

export type BusinessSwitcherVariant = "sidebar" | "header" | "drawer" | "mobile-header";

interface BusinessSwitcherProps {
  activeBusiness: ActiveBusinessIdentity;
  variant?: BusinessSwitcherVariant;
}

export function BusinessSwitcher({
  activeBusiness,
  variant = "sidebar",
}: BusinessSwitcherProps) {
  const router = useRouter();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isSwitching, startSwitchTransition] = useTransition();
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Creation form state
  const [newBizName, setNewBizName] = useState("");
  const [newBizCapability, setNewBizCapability] = useState<"sell" | "buy" | "both">("sell");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, startCreateTransition] = useTransition();

  const memberships = activeBusiness.memberships ?? [
    {
      id: activeBusiness.id ?? "default",
      name: activeBusiness.name,
      role: activeBusiness.role,
      canBuy: activeBusiness.canBuy,
      canSell: activeBusiness.canSell,
      isActive: true,
    },
  ];

  const hasMultiple = memberships.length > 1;

  function handleSwitch(targetId: string, targetName: string) {
    if (targetId === activeBusiness.id || isSwitching) return;
    setSwitchingId(targetId);
    startSwitchTransition(async () => {
      try {
        const result = await switchBusinessAction(targetId);
        if (result.success) {
          toast.success(`Switched active business to ${targetName}`);
          setPopoverOpen(false);
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to switch business.");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to switch business.";
        toast.error(msg);
      } finally {
        setSwitchingId(null);
      }
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newBizName.trim() || isCreating) return;
    setCreateError(null);

    startCreateTransition(async () => {
      try {
        const result = await createBusinessAction({
          name: newBizName.trim(),
          capability: newBizCapability,
        });

        if (result.success) {
          toast.success(`Created "${result.businessName}" and set as active.`);
          setNewBizName("");
          setNewBizCapability("sell");
          setCreateDialogOpen(false);
          router.refresh();
        } else {
          setCreateError(result.error ?? "Failed to create business.");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create business.";
        setCreateError(msg);
      }
    });
  }

  // ── Trigger Rendering Per Variant ─────────────────────────────────────────

  const triggerContent = (() => {
    switch (variant) {
      case "sidebar":
        return (
          <button
            type="button"
            data-testid="sidebar-business-switcher-trigger"
            aria-label={`Active business: ${activeBusiness.name}, ${activeBusiness.role}. Click to switch.`}
            className="group flex w-full items-center justify-between gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/15 px-3.5 py-2.5 text-left transition-colors hover:bg-sidebar-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                aria-hidden="true"
              >
                {activeBusiness.canSell ? (
                  <RiPlantLine className="size-4" />
                ) : (
                  <RiBuildingLine className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  data-testid="sidebar-business-name"
                  className="truncate text-xs font-semibold text-sidebar-foreground leading-tight"
                  title={activeBusiness.name}
                >
                  {activeBusiness.name}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Badge
                    variant="outline"
                    data-testid="sidebar-business-role"
                    className="h-4 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-border/60"
                  >
                    {activeBusiness.role}
                  </Badge>
                  <span className="text-muted-foreground/40" aria-hidden="true">•</span>
                  <span className="truncate">
                    {activeBusiness.canBuy && activeBusiness.canSell
                      ? "Buy & Sell"
                      : activeBusiness.canSell
                      ? "Producer"
                      : "Buyer"}
                  </span>
                </div>
              </div>
            </div>
            <RiArrowDownSLine
              className="size-4 text-muted-foreground transition-transform group-hover:text-sidebar-foreground shrink-0"
              aria-hidden="true"
            />
          </button>
        );

      case "header":
        return (
          <button
            type="button"
            data-testid="header-business-switcher-trigger"
            aria-label={`Operating as ${activeBusiness.name}, ${activeBusiness.role}. Click to switch.`}
            className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <div
              className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
              aria-hidden="true"
            >
              {activeBusiness.canSell ? (
                <RiPlantLine className="size-3.5" />
              ) : (
                <RiBuildingLine className="size-3.5" />
              )}
            </div>
            <div className="flex flex-col min-w-0 max-w-[170px] text-left">
              <span
                className="truncate font-semibold text-xs leading-tight"
                title={activeBusiness.name}
              >
                {activeBusiness.name}
              </span>
              <div className="flex items-center gap-1 leading-none mt-0.5 text-[10px] text-muted-foreground">
                <Badge
                  variant="outline"
                  className="h-3.5 px-1 py-0 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground border-border/60"
                >
                  {activeBusiness.role}
                </Badge>
                <span className="text-muted-foreground/40 text-[9px]" aria-hidden="true">•</span>
                <span className="truncate">
                  {activeBusiness.canBuy && activeBusiness.canSell
                    ? "Buy & Sell"
                    : activeBusiness.canSell
                    ? "Producer"
                    : "Buyer"}
                </span>
              </div>
            </div>
            <RiArrowDownSLine className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          </button>
        );

      case "drawer":
        return (
          <button
            type="button"
            data-testid="drawer-business-switcher-trigger"
            aria-label={`Operating as ${activeBusiness.name}, ${activeBusiness.role}. Click to switch.`}
            className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                aria-hidden="true"
              >
                {activeBusiness.canSell ? (
                  <RiPlantLine className="size-4" />
                ) : (
                  <RiBuildingLine className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-xs font-semibold text-foreground leading-tight"
                  title={activeBusiness.name}
                >
                  {activeBusiness.name}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Badge
                    variant="outline"
                    className="h-4 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-border/60"
                  >
                    {activeBusiness.role}
                  </Badge>
                  <span className="text-muted-foreground/40" aria-hidden="true">•</span>
                  <span className="truncate">
                    {activeBusiness.canBuy && activeBusiness.canSell
                      ? "Buy & Sell"
                      : activeBusiness.canSell
                      ? "Producer"
                      : "Buyer"}
                  </span>
                </div>
              </div>
            </div>
            <RiArrowDownSLine className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          </button>
        );

      case "mobile-header":
        return (
          <button
            type="button"
            data-testid="mobile-header-business-switcher-trigger"
            aria-label={`Operating as ${activeBusiness.name}, ${activeBusiness.role}. Click to switch.`}
            className="hidden min-[430px]:flex items-center gap-1.5 max-w-[140px] truncate rounded-md bg-muted/40 border border-border/50 px-2 py-0.5 text-xs text-foreground cursor-pointer"
          >
            <span
              className="flex size-4 shrink-0 items-center justify-center rounded-xs text-primary"
              aria-hidden="true"
            >
              {activeBusiness.canSell ? (
                <RiPlantLine className="size-3.5" />
              ) : (
                <RiBuildingLine className="size-3.5" />
              )}
            </span>
            <span className="truncate text-[11px] font-semibold">{activeBusiness.name}</span>
            <RiArrowDownSLine className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
          </button>
        );
    }
  })();

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger render={triggerContent} />

        <PopoverContent
          align={variant === "header" ? "end" : "start"}
          sideOffset={6}
          className="w-72 p-2"
          data-testid="business-switcher-popover"
        >
          {/* Header */}
          <div className="px-2 py-1.5">
            <p className="text-xs font-semibold text-foreground">UMA Businesses</p>
            <p className="text-[11px] text-muted-foreground">
              {hasMultiple
                ? "Select a business to operate or add another."
                : "Your active UMA business workspace."}
            </p>
          </div>

          <Separator className="my-1" />

          {/* Memberships List */}
          <ScrollArea className="max-h-60" role="menu">
            <div className="flex flex-col gap-0.5 pr-2">
              {memberships.map((m) => {
                const isCurrent = m.isActive || m.id === activeBusiness.id;
                const isThisSwitching = isSwitching && switchingId === m.id;

                return (
                  <button
                    key={m.id}
                    type="button"
                    role="menuitem"
                    data-testid={`business-item-${m.id}`}
                    data-business-option={`business-option-${m.id}`}
                    disabled={isSwitching}
                    onClick={() => handleSwitch(m.id, m.name)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors cursor-pointer",
                      isCurrent
                        ? "bg-accent/60 text-foreground font-medium"
                        : "hover:bg-muted/60 text-muted-foreground hover:text-foreground",
                      isSwitching && !isThisSwitching && "opacity-50 pointer-events-none"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                        aria-hidden="true"
                      >
                        {m.canSell ? (
                          <RiPlantLine className="size-3.5" />
                        ) : (
                          <RiBuildingLine className="size-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold leading-tight text-foreground" title={m.name}>
                          {m.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Badge
                            variant="outline"
                            className="h-3.5 px-1 py-0 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground border-border/60"
                          >
                            {m.role}
                          </Badge>
                          <span className="text-muted-foreground/40" aria-hidden="true">•</span>
                          <span className="truncate">
                            {m.canBuy && m.canSell
                              ? "Buy & Sell"
                              : m.canSell
                              ? "Producer"
                              : "Buyer"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isThisSwitching ? (
                      <Spinner className="size-4 shrink-0 text-primary" />
                    ) : isCurrent ? (
                      <span className="flex items-center gap-1">
                        <span className="sr-only">Active</span>
                        <RiCheckLine
                          data-testid="active-check"
                          className="size-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          <Separator className="my-1" />

          {/* Action: Create another business */}
          <button
            type="button"
            data-testid="create-business-trigger"
            onClick={() => {
              setPopoverOpen(false);
              setCreateDialogOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 cursor-pointer"
          >
            <RiAddLine className="size-4 shrink-0" aria-hidden="true" />
            <span>Create another business</span>
          </button>

          {/* Action: Business Settings */}
          <Link
            href={routes.dashboard.settings}
            data-testid="business-settings-switcher-link"
            onClick={() => setPopoverOpen(false)}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <RiSettings4Line className="size-4 shrink-0" aria-hidden="true" />
            <span>Business settings</span>
          </Link>
        </PopoverContent>
      </Popover>

      {/* Lightweight Creation Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="create-business-dialog">
          <DialogHeader>
            <DialogTitle>Create another business</DialogTitle>
            <DialogDescription>
              Register an additional farm or wholesale business on UMA Market under your account.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-1">
            {createError && (
              <Alert
                variant="destructive"
                data-testid="create-business-error"
                className="p-2.5 text-xs border-destructive/30 bg-destructive/10"
              >
                <AlertDescription className="text-xs text-destructive">
                  {createError}
                </AlertDescription>
              </Alert>
            )}

            {/* Field 1: Business Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="new-business-name"
                className="text-xs font-semibold text-foreground"
              >
                Business or Farm Name
              </label>
              <Input
                id="new-business-name"
                data-testid="create-business-name-input"
                data-input="new-business-name-input"
                value={newBizName}
                onChange={(e) => setNewBizName(e.target.value)}
                placeholder="e.g. Bukidnon Mountain Arabica Farm"
                maxLength={100}
                required
                disabled={isCreating}
                autoFocus
              />
            </div>

            {/* Field 2: Capability Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                How will you use UMA?
              </label>
              <div className="grid grid-cols-1 gap-2">
                {/* Sell Produce */}
                <button
                  type="button"
                  data-testid="create-business-cap-sell"
                  data-option="capability-option-sell"
                  onClick={() => setNewBizCapability("sell")}
                  disabled={isCreating}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer",
                    newBizCapability === "sell"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary mt-0.5">
                    <RiPlantLine className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Sell produce</p>
                    <p className="text-[11px] text-muted-foreground">
                      Producer / Grower — list wholesale harvests directly to commercial buyers.
                    </p>
                  </div>
                </button>

                {/* Buy Produce */}
                <button
                  type="button"
                  data-testid="create-business-cap-buy"
                  data-option="capability-option-buy"
                  onClick={() => setNewBizCapability("buy")}
                  disabled={isCreating}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer",
                    newBizCapability === "buy"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary mt-0.5">
                    <RiBuildingLine className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Buy produce</p>
                    <p className="text-[11px] text-muted-foreground">
                      Commercial Buyer — source and purchase fresh harvests for restaurants or markets.
                    </p>
                  </div>
                </button>

                {/* Buy & Sell */}
                <button
                  type="button"
                  data-testid="create-business-cap-both"
                  data-option="capability-option-both"
                  onClick={() => setNewBizCapability("both")}
                  disabled={isCreating}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer",
                    newBizCapability === "both"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 mt-0.5">
                    <RiExchangeLine className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Buy & Sell</p>
                    <p className="text-[11px] text-muted-foreground">
                      Both — operate as a trading business, selling harvests and sourcing supplies.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateDialogOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                data-testid="create-business-submit-btn"
                data-btn="submit-create-business"
                disabled={!newBizName.trim() || isCreating}
              >
                {isCreating ? (
                  <>
                    <Spinner className="mr-1.5 size-3.5" />
                    Creating...
                  </>
                ) : (
                  "Create Business"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
