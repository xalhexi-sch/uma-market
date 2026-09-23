import Image from "next/image";
import {
  RiAddLine,
  RiShieldCheckLine,
  RiSeedlingLine,
  RiMoneyDollarCircleLine,
  RiCheckboxCircleLine,
} from "@remixicon/react";
import { BrowserFrame } from "@/components/marketplace/showcase/browser-frame";

const FARMER_LISTINGS = [
  {
    name: "Native Purple Ube (Tuber)",
    category: "Root Crops",
    imageUrl: "https://images.unsplash.com/photo-1730815048561-45df6f7f331d?w=800&auto=format&fit=crop&q=80",
    price: 95,
    unit: "kg",
    stock: "120 kg",
    moq: "10 kg",
    status: "Active",
  },
  {
    name: "Yellow Sweet Camote",
    category: "Root Crops",
    imageUrl: "https://images.unsplash.com/photo-1753445657069-ba23263dd733?w=800&auto=format&fit=crop&q=80",
    price: 42,
    unit: "kg",
    stock: "180 kg",
    moq: "10 kg",
    status: "Active",
  },
  {
    name: "Dinorado Fragrant Rice",
    category: "Rice & Grains",
    imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&auto=format&fit=crop&q=80",
    price: 1250,
    unit: "sack",
    stock: "50 sacks",
    moq: "2 sacks",
    status: "Active",
  },
];

export function GrowerDashboardMockup() {
  return (
    <BrowserFrame url="uma.market/farmer/products" badge="Grower Portal">
      <div className="p-4 sm:p-6 bg-background/50 flex flex-col gap-4">
        {/* Farm Profile Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-foreground">
                Agusan Valley Organics
              </h3>
              <RiShieldCheckLine className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-xs text-muted-foreground">
              Producer ID: FM-8820 · Butuan Agricultural Corridor
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs">
            <RiAddLine className="size-3.5" />
            <span>Add New Produce</span>
          </div>
        </div>

        {/* 3 Metric Summary Cards */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <RiSeedlingLine className="size-3.5 text-primary" />
              <span>Active Listings</span>
            </div>
            <p className="mt-1 text-base sm:text-lg font-bold text-foreground">
              8 items
            </p>
          </div>

          <div className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <RiMoneyDollarCircleLine className="size-3.5 text-emerald-600" />
              <span>Fulfilled Orders</span>
            </div>
            <p className="mt-1 text-base sm:text-lg font-bold text-foreground">
              ₱48,500
            </p>
          </div>

          <div className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <RiCheckboxCircleLine className="size-3.5 text-emerald-600" />
              <span>Fulfillment Rate</span>
            </div>
            <p className="mt-1 text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
              100%
            </p>
          </div>
        </div>

        {/* Produce Inventory Table */}
        <div className="rounded-lg border border-border/70 overflow-hidden bg-card shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-[11px] font-semibold text-muted-foreground border-b border-border/60">
              <tr>
                <th className="py-2.5 px-3">Produce</th>
                <th className="py-2.5 px-3">Price / Unit</th>
                <th className="py-2.5 px-3 hidden sm:table-cell">Stock</th>
                <th className="py-2.5 px-3 hidden sm:table-cell">MOQ</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {FARMER_LISTINGS.map((item) => (
                <tr key={item.name} className="hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="relative size-8 rounded-md overflow-hidden bg-muted shrink-0">
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          sizes="32px"
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground truncate max-w-[120px] sm:max-w-[160px]">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.category}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="py-2.5 px-3 font-semibold text-foreground whitespace-nowrap">
                    ₱{item.price.toFixed(2)}
                    <span className="text-[10px] font-normal text-muted-foreground">
                      /{item.unit}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell">
                    {item.stock}
                  </td>

                  <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell">
                    {item.moq}
                  </td>

                  <td className="py-2.5 px-3 text-right">
                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </BrowserFrame>
  );
}
