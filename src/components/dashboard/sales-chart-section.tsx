"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesAreaChart } from "./overview-charts";
import { CURRENCY } from "@/lib/constants";

interface SalesChartSectionProps {
  data: Array<{ date: string; sales: number; orders: number }>;
  /** Farmer sells, business buys — the series labels follow the role. */
  seriesLabel?: { sales: string; orders: string };
}

export function SalesChartSection({
  data,
  seriesLabel = { sales: "Sales", orders: "Orders" },
}: SalesChartSectionProps) {
  const [activeKey, setActiveKey] = useState<"sales" | "orders">("sales");

  return (
    <div>
      <Tabs
        value={activeKey}
        onValueChange={(value) => setActiveKey(value as "sales" | "orders")}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="sales" className="text-xs">
            {seriesLabel.sales} ({CURRENCY})
          </TabsTrigger>
          <TabsTrigger value="orders" className="text-xs">
            {seriesLabel.orders}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <SalesAreaChart data={data} activeKey={activeKey} />
    </div>
  );
}