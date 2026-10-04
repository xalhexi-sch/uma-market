"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesAreaChart } from "./overview-charts";
import { CURRENCY } from "@/lib/constants";

interface SalesChartSectionProps {
  data: Array<{ date: string; sales: number; orders: number }>;
}

export function SalesChartSection({ data }: SalesChartSectionProps) {
  const [activeKey, setActiveKey] = useState<"sales" | "orders">("sales");

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <Tabs
          defaultValue="sales"
          onValueChange={(v) => setActiveKey(v as "sales" | "orders")}
        >
          <TabsList>
            <TabsTrigger value="sales">
              Sales ({CURRENCY})
            </TabsTrigger>
            <TabsTrigger value="orders">
              Orders
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <SalesAreaChart data={data} activeKey={activeKey} />
    </div>
  );
}
