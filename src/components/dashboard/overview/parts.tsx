import Link from "next/link";
import {
  RiArrowRightLine,
  RiArrowDownLine,
  RiArrowUpLine,
  RiShoppingBagLine,
} from "@remixicon/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { OrderStatusDonut } from "@/components/dashboard/overview-charts";
import type { OrderStatusBreakdown, TopProduct } from "@/lib/supabase/queries/overview";
import { describeDelta, formatPeso, type Delta } from "@/lib/overview-format";
import { cn } from "@/lib/utils";

// ── KPI tile ───────────────────────────────────────

const DELTA_TONE: Record<Delta["direction"], string> = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-destructive",
  flat: "text-muted-foreground",
};

/**
 * One metric. The delta is optional: pass `previous` to compare against the
 * equal-length preceding window, omit it for a plain count.
 */
export function KpiTile({
  label,
  value,
  current,
  previous,
  icon,
  iconClassName,
  footnote,
}: {
  label: string;
  value: string;
  current?: number;
  previous?: number;
  icon: React.ReactNode;
  iconClassName: string;
  footnote?: string;
}) {
  const delta =
    current !== undefined && previous !== undefined
      ? describeDelta(current, previous)
      : null;

  return (
    <Card size="sm" className="min-w-0">
      <CardContent className="flex h-full flex-col justify-between gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg",
              iconClassName,
            )}
          >
            {icon}
          </span>
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {value}
          </p>
          {/* min-h reserves the sub-line so every tile's number sits on the
              same baseline whether it carries a delta, a footnote, or neither. */}
          <div className="mt-1 min-h-4">
            {delta?.label ? (
              <p
                className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  DELTA_TONE[delta.direction],
                )}
              >
                {delta.direction === "up" && <RiArrowUpLine className="size-3" />}
                {delta.direction === "down" && <RiArrowDownLine className="size-3" />}
                <span className="tabular-nums">{delta.label}</span>
                <span className="font-normal text-muted-foreground">vs previous</span>
              </p>
            ) : (
              footnote && (
                <p className="truncate text-xs text-muted-foreground">{footnote}</p>
              )
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Needs attention ─────────────────────────────────

export interface AttentionItem {
  id: string;
  label: string;
  detail: string;
  href: string;
  action: string;
  icon: React.ReactNode;
  tone: "warn" | "info";
}

const ATTENTION_TONE: Record<AttentionItem["tone"], string> = {
  warn: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  info: "bg-primary/10 text-primary",
};

/**
 * Only renders when there is something real to act on. Every item is backed
 * by a count the dashboard already queried — nothing is invented to fill
 * the row, and the section disappears entirely when every count is zero.
 */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Needs attention</CardTitle>
        <CardDescription className="text-xs">
          {items.length === 1 ? "1 item is waiting on you." : `${items.length} items are waiting on you.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                ATTENTION_TONE[item.tone],
              )}
            >
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium text-foreground">{item.label}</p>
              <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
            </div>
            <Link
              href={item.href}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              {item.action}
              <RiArrowRightLine className="size-3.5" />
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Order status ────────────────────────────────────

/** Donut plus legend. The legend lives here so both pages cannot diverge. */
export function OrderStatusCard({
  breakdown,
  total,
  rangeLabel,
  rangePhrase,
  ordersHref,
}: {
  breakdown: OrderStatusBreakdown[];
  total: number;
  rangeLabel: string;
  /** Lowercased variant for mid-sentence copy. */
  rangePhrase: string;
  ordersHref: string;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <CardTitle>Order status</CardTitle>
          <CardDescription>{rangeLabel}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <Empty className="border py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RiShoppingBagLine />
              </EmptyMedia>
              <EmptyTitle>No orders {rangePhrase}</EmptyTitle>
              <EmptyDescription>
                Nothing fell inside this window. Try a wider range.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <OrderStatusDonut data={breakdown} total={total} />
            <div className="w-full space-y-2">
              {breakdown.map((item) => (
                <div key={item.status} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate text-muted-foreground">{item.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 tabular-nums">
                    <span className="font-medium text-foreground">{item.count}</span>
                    <span className="w-9 text-right text-muted-foreground">
                      {Math.round((item.count / total) * 100)}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <Link
              href={ordersHref}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "w-full text-muted-foreground",
              )}
            >
              View all orders
              <RiArrowRightLine className="size-3.5" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Top products ────────────────────────────────────

/**
 * Ranked revenue list with a share bar — the same rows the old table showed,
 * framed as "what is carrying this period" instead of a second order table.
 */
export function TopProductsCard({
  products,
  rangePhrase,
  productsHref,
}: {
  products: TopProduct[];
  rangePhrase: string;
  productsHref: string;
}) {
  const maxRevenue = products.reduce((max, product) => Math.max(max, product.revenue), 0);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <CardTitle>Top products</CardTitle>
          <CardDescription>By completed revenue {rangePhrase}.</CardDescription>
        </div>
        <CardAction>
          <Link
            href={productsHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            All products
            <RiArrowRightLine className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <Empty className="border py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RiShoppingBagLine />
              </EmptyMedia>
              <EmptyTitle>No completed sales {rangePhrase}</EmptyTitle>
              <EmptyDescription>
                Rankings appear once an order inside this window is completed.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ol className="divide-y divide-border">
            {products.map((product, index) => (
              <li key={product.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="w-4 shrink-0 pt-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {formatPeso(product.revenue)}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {product.category} · {product.unitsSold.toLocaleString()} {product.unit} sold
                  </p>
                  <Progress
                    value={maxRevenue > 0 ? (product.revenue / maxRevenue) * 100 : 0}
                    className="mt-2"
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ── Quick actions ───────────────────────────────────

export interface QuickActionItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

/**
 * Flat links, not nested boxes. The previous version put four bordered cards
 * inside a Card, which read as decoration rather than navigation.
 */
export function QuickActions({ items }: { items: QuickActionItem[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>Jump straight to a common task.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="@container">
        {/* Two columns only when the CARD is wide enough. In the farmer page
            this card sits in a 340px side column, where two-up truncated every
            label; a container query reacts to the card, not the viewport.
            `@container` must sit on an ancestor — a query cannot target the
            element that establishes it. */}
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border @min-[380px]:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 bg-card px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <span className="shrink-0 text-muted-foreground">{item.icon}</span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <RiArrowRightLine className="size-3.5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Section heading (unframed) ──────────────────────

/**
 * A plain typographic section head, for places where a Card would add a
 * border around nothing.
 */
export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}