"use client";

import { useTransition } from "react";
import {
  RiCheckboxCircleFill,
  RiAlertFill,
  RiCloseCircleFill,
  RiPauseCircleLine,
  RiRefreshLine,
} from "@remixicon/react";
import { updateProfileAccountStatus } from "@/app/(dashboard)/admin/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

interface AdminAccountStatusButtonProps {
  clerkId: string;
  status?: "active" | "suspended" | "revoked" | string;
}

export function AdminAccountStatusButton({
  clerkId,
  status = "active",
}: AdminAccountStatusButtonProps) {
  const [isPending, startTransition] = useTransition();

  const currentStatus = status || "active";

  function handleStatusChange(newStatus: "active" | "suspended") {
    startTransition(async () => {
      const res = await updateProfileAccountStatus(clerkId, newStatus);
      if (res.success) {
        toast.success(
          newStatus === "suspended" ? "Account suspended." : "Account reactivated."
        );
      } else {
        toast.error(res.error ?? "Action failed.");
      }
    });
  }

  if (currentStatus === "suspended") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
          <RiAlertFill className="size-3.5" />
          Suspended
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleStatusChange("active")}
          disabled={isPending}
          className="h-7 px-2 text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
        >
          <RiRefreshLine className="size-3 mr-1" />
          {isPending ? "Reactivating…" : "Reactivate"}
        </Button>
      </div>
    );
  }

  if (currentStatus === "revoked") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive border border-destructive/20" title="Account permanently closed or revoked">
          <RiCloseCircleFill className="size-3.5" />
          Revoked
        </span>
        <span className="text-[11px] text-muted-foreground italic">
          Permanent
        </span>
      </div>
    );
  }

  // Default: active
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
        <RiCheckboxCircleFill className="size-3.5" />
        Active
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => handleStatusChange("suspended")}
        disabled={isPending}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400"
      >
        <RiPauseCircleLine className="size-3 mr-1" />
        {isPending ? "Suspending…" : "Suspend"}
      </Button>
    </div>
  );
}
