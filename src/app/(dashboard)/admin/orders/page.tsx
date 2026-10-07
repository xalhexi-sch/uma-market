import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RiArrowLeftLine, RiShoppingBagLine } from "@remixicon/react";
import { getAdminOrders } from "@/lib/supabase/queries/admin";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { CURRENCY } from "@/lib/constants";
import type { UserRole, OrderStatus } from "@/lib/constants";

export const metadata = {
  title: "Order Auditing — UMA Market Admin",
  description: "Platform-wide wholesale order monitoring and audit logs.",
};

export default async function AdminOrdersPage() {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;

  if (role !== "admin") {
    if (role === "farmer" || role === "business") redirect("/dashboard");
    redirect("/onboarding");
  }

  const orders = await getAdminOrders();

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-6xl">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <RiArrowLeftLine className="size-3.5" />
          Back to Overview
        </Link>
        <div className="flex items-center gap-2">
          <RiShoppingBagLine className="size-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Platform Orders Audit
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Audit and inspect all wholesale purchase orders placed between commercial businesses and local farms.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order Ref</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Commercial Buyer</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Farm Supplier</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fulfillment</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Amount</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <RiShoppingBagLine className="size-4" />
                      </EmptyMedia>
                      <EmptyTitle>No orders placed on the platform yet</EmptyTitle>
                      <EmptyDescription>
                        Orders will appear here when commercial buyers start placing wholesale purchases.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const ref = `UMA-${order.id.slice(0, 8).toUpperCase()}`;
                const buyerName = order.business?.business_name || order.business?.full_name || "Buyer";
                const farmerName = order.farmer?.business_name || order.farmer?.full_name || "Farm";
                const dateStr = new Date(order.created_at).toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <TableRow key={order.id} className="border-b border-border transition-colors hover:bg-muted/20 text-sm">
                    <TableCell className="py-3 px-4 font-mono font-medium text-xs">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-primary hover:underline hover:text-primary/80 transition-colors"
                      >
                        {ref}
                      </Link>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-xs text-muted-foreground">
                      {dateStr}
                    </TableCell>
                    <TableCell className="py-3 px-4 font-medium text-foreground">
                      {buyerName}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-muted-foreground">
                      {farmerName}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <Badge variant="outline" className="capitalize text-xs font-medium">
                        {order.fulfillment_type === "seller_delivery" ? "Delivery" : "Pickup"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 px-4 font-semibold text-foreground tabular-nums">
                      {CURRENCY}{(Number(order.total_amount) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <OrderStatusBadge status={order.status as OrderStatus} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
