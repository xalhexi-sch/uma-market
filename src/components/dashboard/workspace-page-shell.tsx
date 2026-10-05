import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";

/** Page frame shared by the V4 business dashboard pages. */
export function WorkspacePageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketplaceHeader activeRoute="dashboard" />
      <main className="flex-1 pb-16">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
