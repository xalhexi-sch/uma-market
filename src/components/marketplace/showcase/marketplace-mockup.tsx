import Image from "next/image";
import {
  RiSearchLine,
  RiCheckDoubleLine,
  RiShieldCheckLine,
} from "@remixicon/react";
import { BrowserFrame } from "@/components/marketplace/showcase/browser-frame";

const MOCK_PRODUCE = [
  {
    name: "Carabao Sweet Mangoes (Grade A)",
    category: "Fruits",
    imageUrl: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&auto=format&fit=crop&q=80",
    price: 130,
    unit: "kg",
    stock: "250 kg",
    moq: "15 kg",
    farmer: "Golden Harvest Agro",
    city: "Butuan",
    verified: true,
  },
  {
    name: "Native Purple Ube (Tuber)",
    category: "Root Crops",
    imageUrl: "https://images.unsplash.com/photo-1730815048561-45df6f7f331d?w=800&auto=format&fit=crop&q=80",
    price: 95,
    unit: "kg",
    stock: "120 kg",
    moq: "10 kg",
    farmer: "Agusan Valley Organics",
    city: "Butuan",
    verified: true,
  },
  {
    name: "Highland Green Ampalaya",
    category: "Vegetables",
    imageUrl: "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=800&auto=format&fit=crop&q=80",
    price: 75,
    unit: "kg",
    stock: "150 kg",
    moq: "10 kg",
    farmer: "Verdant Ridge Farm",
    city: "Butuan",
    verified: true,
  },
];

export function MarketplaceMockup() {
  return (
    <BrowserFrame url="uma.market/products" badge="Live Marketplace">
      <div className="p-4 sm:p-6 bg-background/50">
        {/* Mockup Header & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
          <div className="relative flex-1 max-w-md">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              readOnly
              value="fresh harvest mangoes, ube, highland crops"
              className="w-full rounded-md border border-border bg-background py-1.5 pl-9 pr-3 text-xs text-foreground shadow-2xs focus:outline-none pointer-events-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
            <span className="rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground whitespace-nowrap">
              All Produce
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-muted-foreground whitespace-nowrap">
              Vegetables
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-muted-foreground whitespace-nowrap">
              Fruits
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-muted-foreground whitespace-nowrap hidden sm:inline-block">
              Root Crops
            </span>
          </div>
        </div>

        {/* Status Line */}
        <div className="flex items-center justify-between py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground/80">
            <RiCheckDoubleLine className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>21 active offerings · Farm-gate pricing</span>
          </div>
          <span className="text-[11px] text-muted-foreground/70 hidden sm:inline-block">
            Updated today from Butuan growers
          </span>
        </div>

        {/* Produce Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
          {MOCK_PRODUCE.map((p) => (
            <div
              key={p.name}
              className="group rounded-xl border border-border/80 bg-card p-3 shadow-2xs transition-all hover:border-primary/40 flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted/30 mb-2.5">
                  <Image
                    src={p.imageUrl}
                    alt={p.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute top-2 left-2 rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] font-medium text-white">
                    {p.category}
                  </div>
                  <div className="absolute bottom-2 right-2 rounded-md bg-emerald-600/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-semibold text-white">
                    In Stock
                  </div>
                </div>

                <h4 className="text-xs font-semibold text-foreground truncate">
                  {p.name}
                </h4>

                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-sm font-bold text-foreground">
                    ₱{p.price.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    / {p.unit}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Stock: {p.stock}</span>
                  <span>MOQ: {p.moq}</span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="truncate font-medium text-foreground/80">
                  {p.farmer}
                </span>
                {p.verified && (
                  <RiShieldCheckLine className="size-3.5 text-emerald-600 shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}
