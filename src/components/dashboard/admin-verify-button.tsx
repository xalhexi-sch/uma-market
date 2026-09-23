"use client";

import { useTransition } from "react";
import { RiCheckboxCircleFill, RiShieldCheckLine } from "@remixicon/react";
import { toggleProfileVerification } from "@/app/(dashboard)/admin/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

interface AdminVerifyButtonProps {
  clerkId: string;
  isVerified: boolean;
}

export function AdminVerifyButton({ clerkId, isVerified }: AdminVerifyButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const res = await toggleProfileVerification(clerkId, !isVerified);
      if (res.success) {
        toast.success(isVerified ? "Verification revoked." : "User verified.");
      } else {
        toast.error(res.error ?? "Action failed.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {isVerified ? (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-500/20">
            <RiCheckboxCircleFill className="size-3.5" />
            Verified
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            disabled={isPending}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            {isPending ? "Updating…" : "Revoke"}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleToggle}
          disabled={isPending}
          className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
        >
          <RiShieldCheckLine className="size-3.5 mr-1" />
          {isPending ? "Verifying…" : "Verify"}
        </Button>
      )}
    </div>
  );
}
