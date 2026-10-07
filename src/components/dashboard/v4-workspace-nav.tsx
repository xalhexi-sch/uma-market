import Link from "next/link";
import { RiDashboardLine, RiPlantLine, RiStackLine, RiTeamLine } from "@remixicon/react";
import { routes } from "@/platform/routes";
import { cn } from "@/lib/utils";

export type WorkspaceSection = "overview" | "listings" | "inventory" | "members";

interface V4WorkspaceNavProps {
  active: WorkspaceSection;
  /** Producer sections only exist for businesses with SELL capability. */
  canSell: boolean;
}

/** Section links for the business dashboard. Visibility is UX only; every page re-checks access. */
export function V4WorkspaceNav({ active, canSell }: V4WorkspaceNavProps) {
  const items = [
    { id: "overview" as const, label: "Overview", href: routes.dashboardRoot, Icon: RiDashboardLine },
    ...(canSell
      ? [
          { id: "listings" as const, label: "Listings", href: routes.dashboard.listings, Icon: RiPlantLine },
          { id: "inventory" as const, label: "Inventory", href: routes.dashboard.inventory, Icon: RiStackLine },
        ]
      : []),
    { id: "members" as const, label: "Members", href: routes.dashboard.members, Icon: RiTeamLine },
  ];

  return (
    <nav aria-label="Business workspace" data-testid="v4-workspace-nav" className="border-b border-border">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {items.map(({ id, label, href, Icon }) => {
          const isActive = id === active;
          return (
            <li key={id} className="shrink-0">
              <Link
                href={href}
                data-testid={`v4-workspace-nav-${id}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-t-md",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
