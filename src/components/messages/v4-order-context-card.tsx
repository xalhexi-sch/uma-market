import Link from "next/link";
import { RiFileList3Line, RiExternalLinkLine } from "@remixicon/react";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { formatCurrency } from "@/lib/utils";
import type { OrderStatus } from "@/lib/constants";

interface V4OrderContextCardProps {
  order: {
    id: string;
    status: string;
    total_amount: number;
  };
}

export function V4OrderContextCard({ order }: V4OrderContextCardProps) {
  const orderRef = `UMA-${order.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-background/95 p-2.5 text-xs shadow-2xs max-w-sm transition-colors hover:border-primary/50">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <RiFileList3Line className="size-5" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
          <span>{orderRef}</span>
          <OrderStatusBadge status={order.status as OrderStatus} />
        </div>
        <p className="text-muted-foreground mt-0.5">
          Total: <span className="font-semibold text-foreground">{formatCurrency(order.total_amount)}</span>
        </p>
      </div>

      <Link
        href={`/orders/${order.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 flex items-center gap-1 font-medium text-primary hover:underline px-2 py-1 rounded hover:bg-primary/5"
      >
        <span>Order</span>
        <RiExternalLinkLine className="size-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
