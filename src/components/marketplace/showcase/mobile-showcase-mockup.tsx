import Image from "next/image";
import {
  RiSearchLine,
  RiMenuLine,
  RiShieldCheckLine,
  RiShoppingBag3Line,
} from "@remixicon/react";
import { PhoneFrame } from "@/components/marketplace/showcase/phone-frame";

export function MobileShowcaseMockup() {
  return (
    <PhoneFrame>
      <div className="flex flex-col text-xs text-foreground bg-background">
        {/* Mobile Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-background/95 backdrop-blur-xs sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="relative size-6 shrink-0">
              <Image
                src="/brand/uma-icon-512.png"
                alt="UMA"
                fill
                sizes="24px"
                className="object-contain"
              />
            </div>
            <span className="font-bold tracking-tight text-foreground text-sm">
              UMA Market
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative p-1.5 rounded-md hover:bg-muted text-foreground">
              <RiShoppingBag3Line className="size-4" />
              <span className="absolute top-0 right-0 size-2 rounded-full bg-primary" />
            </div>
            <div className="p-1.5 rounded-md hover:bg-muted text-foreground">
              <RiMenuLine className="size-4" />
            </div>
          </div>
        </div>

        {/* Mobile Search & Category bar */}
        <div className="p-3 border-b border-border/60 bg-muted/20 space-y-2">
          <div className="relative">
            <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              readOnly
              value="Highland ampalaya, mangoes"
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-[11px] shadow-2xs pointer-events-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[10px]">
            <span className="rounded-full bg-primary px-2.5 py-0.5 font-medium text-primary-foreground">
              All
            </span>
            <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-muted-foreground whitespace-nowrap">
              Vegetables
            </span>
            <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-muted-foreground whitespace-nowrap">
              Fruits
            </span>
            <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-muted-foreground whitespace-nowrap">
              Root Crops
            </span>
          </div>
        </div>

        {/* Mobile Produce Cards */}
        <div className="p-3 space-y-3 pb-6">
          {/* Card 1 */}
          <div className="rounded-xl border border-border/80 bg-card p-2.5 shadow-2xs">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-muted mb-2">
              <Image
                src="https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=800&auto=format&fit=crop&q=80"
                alt="Highland Green Ampalaya"
                fill
                sizes="280px"
                className="object-cover"
              />
              <div className="absolute top-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">
                Vegetables
              </div>
              <div className="absolute bottom-1.5 right-1.5 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                In Stock
              </div>
            </div>

            <div className="flex items-start justify-between gap-1">
              <div>
                <h4 className="font-semibold text-foreground text-[11px] leading-tight">
                  Highland Green Ampalaya
                </h4>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                  <span>Verdant Ridge Farm</span>
                  <RiShieldCheckLine className="size-3 text-emerald-600" />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-foreground">₱75.00</span>
                <span className="text-[10px] text-muted-foreground">/kg</span>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="rounded-xl border border-border/80 bg-card p-2.5 shadow-2xs">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-muted mb-2">
              <Image
                src="https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&auto=format&fit=crop&q=80"
                alt="Carabao Sweet Mangoes"
                fill
                sizes="280px"
                className="object-cover"
              />
              <div className="absolute top-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">
                Fruits
              </div>
              <div className="absolute bottom-1.5 right-1.5 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                In Stock
              </div>
            </div>

            <div className="flex items-start justify-between gap-1">
              <div>
                <h4 className="font-semibold text-foreground text-[11px] leading-tight">
                  Carabao Sweet Mangoes
                </h4>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                  <span>Golden Harvest Agro</span>
                  <RiShieldCheckLine className="size-3 text-emerald-600" />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-foreground">₱130.00</span>
                <span className="text-[10px] text-muted-foreground">/kg</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
