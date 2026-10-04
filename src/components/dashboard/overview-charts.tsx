"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  Label,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { CURRENCY } from "@/lib/constants";

// ── Sales Area Chart ──────────────────────────────

interface SalesChartProps {
  data: Array<{ date: string; sales: number; orders: number }>;
  activeKey: "sales" | "orders";
}

const salesChartConfig = {
  sales: {
    label: `Sales (${CURRENCY})`,
    color: "var(--color-primary)",
  },
  orders: {
    label: "Orders",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig;

export function SalesAreaChart({ data, activeKey }: SalesChartProps) {
  return (
    <ChartContainer
      config={salesChartConfig}
      className="aspect-auto h-[220px] w-full sm:h-[260px]"
    >
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          width={50}
          tickFormatter={(v: number) =>
            activeKey === "sales"
              ? v >= 1000
                ? `${CURRENCY}${(v / 1000).toFixed(0)}K`
                : `${CURRENCY}${v}`
              : String(v)
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => {
                const v = Number(value);
                if (name === "sales") {
                  return (
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {CURRENCY}
                      {v.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </span>
                  );
                }
                return (
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {v}
                  </span>
                );
              }}
            />
          }
        />
        {activeKey === "sales" && (
          <Area
            type="monotone"
            dataKey="sales"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#salesGradient)"
            dot={{ r: 3, fill: "var(--color-primary)", stroke: "var(--color-background)", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: "var(--color-primary)", stroke: "var(--color-background)", strokeWidth: 2 }}
          />
        )}
        {activeKey === "orders" && (
          <Area
            type="monotone"
            dataKey="orders"
            stroke="var(--color-chart-2)"
            strokeWidth={2}
            fill="url(#ordersGradient)"
            dot={{ r: 3, fill: "var(--color-chart-2)", stroke: "var(--color-background)", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: "var(--color-chart-2)", stroke: "var(--color-background)", strokeWidth: 2 }}
          />
        )}
      </AreaChart>
    </ChartContainer>
  );
}

// ── Order Status Donut ────────────────────────────

interface OrderStatusDonutProps {
  data: Array<{
    status: string;
    label: string;
    count: number;
    color: string;
  }>;
  total: number;
}

export function OrderStatusDonut({ data, total }: OrderStatusDonutProps) {
  const chartConfig = data.reduce(
    (acc, item) => {
      acc[item.status] = {
        label: item.label,
        color: item.color,
      };
      return acc;
    },
    {} as ChartConfig
  );

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square h-[160px] sm:h-[180px]"
    >
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={72}
          strokeWidth={2}
          stroke="var(--color-background)"
        >
          {data.map((entry) => (
            <Cell key={entry.status} fill={entry.color} />
          ))}
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) - 6}
                      className="fill-foreground text-2xl font-bold"
                    >
                      {total}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 14}
                      className="fill-muted-foreground text-[10px]"
                    >
                      Total Orders
                    </tspan>
                  </text>
                );
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
