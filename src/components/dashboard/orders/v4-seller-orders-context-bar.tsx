"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiBuildingLine, RiTeamLine, RiShieldUserLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { switchActiveBusiness } from "@/platform/cart-actions";
import { toast } from "@/components/ui/toast";
import type { Business, BusinessMember, BusinessRole } from "@/lib/types";

interface V4SellerOrdersContextBarProps {
  business: Business;
  role: BusinessRole;
  canBuy: boolean;
  canSell: boolean;
  memberships: BusinessMember[];
}

export function V4SellerOrdersContextBar({
  business,
  role,
  canBuy,
  canSell,
  memberships,
}: V4SellerOrdersContextBarProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const hasMultiple = memberships.length > 1;

  const capabilityLabel =
    canBuy && canSell
      ? "Buy & Sell"
      : canSell
      ? "Producer"
      : "Buyer Business";

  function handleSwitch(businessId: string) {
    if (!businessId || businessId === business.id) return;
    startTransition(async () => {
      try {
        const res = await switchActiveBusiness(businessId);
        if (res.success) {
          toast.success("Switched active business.");
          router.refresh();
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to switch business.";
        toast.error(message);
      }
    });
  }

  return (
    <div
      data-testid="v4-seller-orders-context-bar"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between shadow-2xs"
    >
      <div className="flex items-center gap-3.5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <RiBuildingLine className="size-5.5" aria-hidden="true" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Seller Order Operations
            </span>
            <Badge
              data-testid="role-badge"
              variant="outline"
              className="text-[11px] font-medium uppercase tracking-wide"
            >
              {role}
            </Badge>
            <Badge
              data-testid="capability-badge"
              variant="secondary"
              className="text-[11px] font-medium"
            >
              {capabilityLabel}
            </Badge>
          </div>
          <h2 data-testid="business-name" className="text-lg font-semibold text-foreground">
            {business.name}
          </h2>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {role === "OWNER" ? (
            <>
              <RiShieldUserLine className="size-3.5 text-primary" aria-hidden="true" />
              <span>Owner Privileges</span>
            </>
          ) : (
            <>
              <RiTeamLine className="size-3.5 text-primary" aria-hidden="true" />
              <span>Staff Access</span>
            </>
          )}
        </div>

        {hasMultiple && (
          <div className="flex items-center gap-2">
            <label htmlFor="seller-orders-business-switch-select" className="sr-only">
              Switch Business
            </label>
            <NativeSelect
              id="seller-orders-business-switch-select"
              value={business.id}
              disabled={isPending}
              onChange={(e) => handleSwitch(e.target.value)}
              size="sm"
              className="min-w-[150px]"
            >
              {memberships.map((m) => (
                <NativeSelectOption key={m.business_id} value={m.business_id}>
                  {m.business?.name || "Business"} ({m.role})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>
    </div>
  );
}
