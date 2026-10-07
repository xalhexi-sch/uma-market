import { RiBuildingLine, RiShieldCheckLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import type { ActiveBusinessContext } from "@/platform/business-context";

interface V4MessagesContextBarProps {
  context: ActiveBusinessContext;
}

export function V4MessagesContextBar({ context }: V4MessagesContextBarProps) {
  const { business, role, canBuy, canSell } = context;

  return (
    <aside
      aria-label="Active Business Messaging Context"
      className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-colors"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Identity & Badges */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5 sm:mt-0">
            <RiBuildingLine className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-semibold text-foreground">
                {business.name}
              </span>
              <Badge variant="secondary" className="text-xs font-medium">
                {role}
              </Badge>
              {canBuy && canSell ? (
                <Badge variant="outline" className="border-primary/30 text-primary dark:text-primary-foreground text-xs">
                  Buyer & Producer
                </Badge>
              ) : canSell ? (
                <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
                  Producer
                </Badge>
              ) : (
                <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-400 text-xs">
                  Buyer
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Shared business inbox • All team members coordinate under this relationship view
            </p>
          </div>
        </div>

        {/* Right: Security & isolation indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50 self-start sm:self-auto shrink-0">
          <RiShieldCheckLine className="size-4 text-primary shrink-0" aria-hidden="true" />
          <span>Business-isolated communications</span>
        </div>
      </div>
    </aside>
  );
}
