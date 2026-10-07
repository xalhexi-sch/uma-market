"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  RiStore2Line,
  RiShoppingCart2Line,
  RiPlantLine,
  RiExchangeLine,
  RiTeamLine,
  RiArrowRightLine,
  RiCheckLine,
  RiAlertLine,
  RiInformationLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { routes } from "@/platform/routes";
import { updateBusinessSettingsAction } from "@/platform/business-actions";
import { cn } from "@/lib/utils";
import type { Business, BusinessRole } from "@/lib/types";

interface BusinessSettingsClientProps {
  business: Business;
  role: BusinessRole;
  isOwner: boolean;
  canBuy: boolean;
  canSell: boolean;
}

type CapabilityOption = "buy" | "sell" | "both";

export function BusinessSettingsClient({
  business,
  role,
  isOwner,
  canBuy: initialCanBuy,
  canSell: initialCanSell,
}: BusinessSettingsClientProps) {
  const router = useRouter();

  // Initial capability selection
  const initialCapability: CapabilityOption =
    initialCanBuy && initialCanSell
      ? "both"
      : initialCanSell
      ? "sell"
      : "buy";

  const [name, setName] = useState(business.name);
  const [capability, setCapability] = useState<CapabilityOption>(initialCapability);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

    setError(null);
    setSuccess(null);

    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setError("Business name must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 100) {
      setError("Business name cannot exceed 100 characters.");
      return;
    }

    startTransition(async () => {
      const result = await updateBusinessSettingsAction({
        businessId: business.id,
        name: trimmed,
        capability,
      });

      if (!result.success) {
        const errMsg = result.error || "Failed to update business settings.";
        setError(errMsg);
        toast.error("Save failed", { description: errMsg });
        return;
      }

      setSuccess("Business settings updated successfully.");
      toast.success("Settings saved", {
        description: "Your business details have been updated.",
      });
      router.refresh();
    });
  };

  const capabilityChoices: Array<{
    id: CapabilityOption;
    title: string;
    subtitle: string;
    badge: string;
    Icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: "buy",
      title: "Buy",
      subtitle: "Source agricultural products from producers and farmers.",
      badge: "Buyer",
      Icon: RiShoppingCart2Line,
    },
    {
      id: "sell",
      title: "Sell",
      subtitle: "List agricultural produce and manage inventory for buyers.",
      badge: "Producer",
      Icon: RiPlantLine,
    },
    {
      id: "both",
      title: "Buy & Sell",
      subtitle: "Use UMA for both sourcing and supplying agricultural produce.",
      badge: "Hybrid",
      Icon: RiExchangeLine,
    },
  ];

  return (
    <div
      data-testid="business-settings-container"
      className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-12"
    >
      {/* Staff read-only notice */}
      {!isOwner && (
        <Alert
          data-testid="staff-readonly-notice"
          className="border-border bg-muted/40 text-muted-foreground"
        >
          <RiInformationLine className="size-4 text-primary" aria-hidden="true" />
          <AlertTitle className="font-semibold text-foreground">Read-only view</AlertTitle>
          <AlertDescription className="mt-0.5">
            You are signed in as a <span className="font-medium text-foreground">{role}</span> member. Only the business owner can edit business information or change capabilities.
          </AlertDescription>
        </Alert>
      )}

      {/* Inline Feedback Alerts */}
      {error && (
        <Alert
          variant="destructive"
          data-testid="settings-error"
          className="border-destructive/30 bg-destructive/10 text-destructive"
        >
          <RiAlertLine className="size-4" aria-hidden="true" />
          <AlertTitle className="font-medium">Error</AlertTitle>
          <AlertDescription className="text-destructive font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert
          data-testid="settings-success"
          role="status"
          className="border-primary/30 bg-primary/10 text-primary"
        >
          <RiCheckLine className="size-4 text-primary" aria-hidden="true" />
          <AlertTitle className="font-medium text-primary">Success</AlertTitle>
          <AlertDescription className="font-medium text-primary">{success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-8">
        {/* Section 1: Business Information */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 border-b border-border/60 pb-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RiStore2Line className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle id="business-info-heading">Business Information</CardTitle>
              <CardDescription className="text-xs">
                The public name of your farm or business across UMA Market.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="business-name"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Business or Farm Name
              </label>
              <Input
                id="business-name"
                data-testid="business-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isOwner || isPending}
                placeholder="e.g. Bukidnon Highland Farm"
                maxLength={100}
                required
                className="h-10 text-sm max-w-lg"
              />
              <p className="text-xs text-muted-foreground">
                Between 2 and 100 characters. Used on invoices, orders, and marketplace chats.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: How you use UMA */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 border-b border-border/60 pb-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RiExchangeLine className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle id="capability-heading">How you use UMA</CardTitle>
              <CardDescription className="text-xs">
                Configure whether this business operates as a buyer, producer, or hybrid.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {capabilityChoices.map((choice) => {
                const isSelected = capability === choice.id;
                const { Icon } = choice;

                return (
                  <button
                    key={choice.id}
                    type="button"
                    data-testid={`capability-option-${choice.id}`}
                    disabled={!isOwner || isPending}
                    onClick={() => isOwner && setCapability(choice.id)}
                    className={cn(
                      "flex flex-col items-start rounded-lg border p-4 text-left transition-all",
                      isOwner ? "cursor-pointer" : "cursor-default opacity-85",
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border bg-background hover:border-border/80 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center rounded-md",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </div>
                      <Badge variant={isSelected ? "default" : "outline"} className="text-[10px]">
                        {choice.badge}
                      </Badge>
                    </div>

                    <h3 className="mt-3 text-sm font-semibold text-foreground">{choice.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{choice.subtitle}</p>
                  </button>
                );
              })}
            </div>

            {capability === "buy" && initialCanSell && (
              <p className="mt-4 text-xs text-amber-600 dark:text-amber-400">
                Note: Changing to Buyer-only hides producer listing and inventory management tools for this business.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Save button (Owners only) */}
        {isOwner && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="submit"
              data-testid="save-business-settings-btn"
              disabled={isPending || !name.trim()}
              className="h-10 min-w-32 px-5 font-semibold"
            >
              {isPending ? (
                <>
                  <Spinner className="size-4 shrink-0" />
                  <span>Saving…</span>
                </>
              ) : (
                <span>Save changes</span>
              )}
            </Button>
          </div>
        )}
      </form>

      {/* Section 4: Team & Members Link */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RiTeamLine className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="team-heading" className="text-base font-semibold text-foreground">
                Team & Authorized Staff
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Invite staff members and manage authorized operators for this business.
              </p>
            </div>
          </div>

          <Link
            href={routes.dashboard.members}
            data-testid="manage-members-link"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted self-start sm:self-auto"
          >
            <span>Manage members</span>
            <RiArrowRightLine className="size-3.5" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
