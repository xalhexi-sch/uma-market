import {
  RiCheckLine,
  RiTruckLine,
  RiSendPlaneFill,
  RiUser3Line,
} from "@remixicon/react";
import { BrowserFrame } from "@/components/marketplace/showcase/browser-frame";

export function OrderFulfillmentMockup() {
  return (
    <BrowserFrame url="uma.market/orders/B0000001" badge="Active Order #B0000001">
      <div className="p-4 sm:p-6 bg-background/50 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left Side: Order Progress & Line Items (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Order Meta Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-foreground">
                  #B0000001
                </span>
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Ready for Delivery
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Buyer: Sunrise Eatery · Vendor: Agusan Valley Organics
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
              <RiTruckLine className="size-3.5 text-primary" />
              <span>Seller Delivery</span>
            </div>
          </div>

          {/* Stepper Progression */}
          <div className="rounded-lg border border-border/70 bg-card p-3.5 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Fulfillment Timeline
            </p>
            <div className="flex items-center justify-between relative text-[11px]">
              {/* Connecting line */}
              <div className="absolute top-3 left-4 right-4 h-0.5 bg-border/80 z-0">
                <div className="h-full bg-emerald-600 w-3/4" />
              </div>

              {/* Step 1 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="size-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <RiCheckLine className="size-3.5" />
                </div>
                <span className="mt-1.5 text-[10px] font-medium text-foreground">
                  Accepted
                </span>
              </div>

              {/* Step 2 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="size-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <RiCheckLine className="size-3.5" />
                </div>
                <span className="mt-1.5 text-[10px] font-medium text-foreground">
                  Preparing
                </span>
              </div>

              {/* Step 3 (Active) */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="size-6 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-4 ring-emerald-500/20 shadow-xs animate-pulse">
                  <RiTruckLine className="size-3.5" />
                </div>
                <span className="mt-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  In Transit
                </span>
              </div>

              {/* Step 4 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="size-6 rounded-full bg-muted border border-border text-muted-foreground flex items-center justify-center">
                  <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                </div>
                <span className="mt-1.5 text-[10px] text-muted-foreground">
                  Completed
                </span>
              </div>
            </div>
          </div>

          {/* Line items snapshot */}
          <div className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs text-xs">
            <div className="flex justify-between pb-2 border-b border-border/60 text-muted-foreground text-[11px] font-medium">
              <span>Ordered Produce</span>
              <span>Subtotal</span>
            </div>
            <div className="py-2 space-y-1.5 divide-y divide-border/40">
              <div className="flex justify-between pt-1">
                <span>Dinorado Fragrant Rice (25kg)</span>
                <span className="font-mono font-medium">₱1,250.00</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Native Purple Ube (15 kg)</span>
                <span className="font-mono font-medium">₱1,425.00</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Yellow Sweet Camote (20 kg)</span>
                <span className="font-mono font-medium">₱840.00</span>
              </div>
            </div>
            <div className="flex justify-between pt-2 border-t border-border/80 font-bold text-foreground">
              <span>Total Wholesale Amount</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                ₱3,515.00
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Embedded Realtime Coordination Chat (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-lg border border-border/70 bg-card p-3.5 shadow-2xs">
          <div>
            <div className="flex items-center gap-2 pb-2.5 border-b border-border/60">
              <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                <RiUser3Line className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Order Direct Chat
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                  Live Coordination
                </p>
              </div>
            </div>

            {/* Message Thread */}
            <div className="py-3 space-y-2.5 text-xs">
              {/* Farmer message */}
              <div className="flex flex-col items-start max-w-[90%]">
                <div className="rounded-lg rounded-tl-xs bg-muted/70 px-3 py-2 text-foreground/90 border border-border/60">
                  Good morning Chef! 15kg Ube and 25kg Rice have been packed fresh.
                </div>
                <span className="text-[9px] text-muted-foreground mt-0.5 ml-1">
                  Grower · 7:45 AM
                </span>
              </div>

              {/* Buyer message */}
              <div className="flex flex-col items-end ml-auto max-w-[90%]">
                <div className="rounded-lg rounded-tr-xs bg-primary px-3 py-2 text-primary-foreground">
                  Great! Our kitchen receiving dock is open starting 8:30 AM.
                </div>
                <span className="text-[9px] text-muted-foreground mt-0.5 mr-1">
                  Buyer · 7:52 AM
                </span>
              </div>

              {/* Farmer confirmation */}
              <div className="flex flex-col items-start max-w-[90%]">
                <div className="rounded-lg rounded-tl-xs bg-muted/70 px-3 py-2 text-foreground/90 border border-border/60">
                  Noted. Driver Jun is en route with temperature-safe crates.
                </div>
                <span className="text-[9px] text-muted-foreground mt-0.5 ml-1">
                  Grower · 8:05 AM
                </span>
              </div>
            </div>
          </div>

          {/* Chat Input Bar */}
          <div className="pt-2 border-t border-border/60 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value="Write a coordination note…"
              className="flex-1 rounded-md border border-border/70 bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-2xs pointer-events-none"
            />
            <button
              type="button"
              className="size-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-2xs"
            >
              <RiSendPlaneFill className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}
