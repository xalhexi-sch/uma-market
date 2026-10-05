import { RiLoader4Line } from "@remixicon/react";

export default function CheckoutLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RiLoader4Line className="size-6 animate-spin" />
          <p className="text-sm font-medium">Loading checkout…</p>
        </div>
      </div>
    </div>
  );
}
