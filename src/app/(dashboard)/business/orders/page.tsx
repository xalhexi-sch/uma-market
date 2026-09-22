import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { RiShoppingBagLine } from "@remixicon/react";
import { getBusinessOrders } from "@/lib/supabase/queries/orders";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { CURRENCY, FULFILLMENT_LABELS } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";

export const metadata: Metadata = { title: "My Orders" };
export const dynamic = "force-dynamic";

export default async function BusinessOrdersPage() {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  if (role !== "business" || !userId) redirect("/onboarding");

  const orders = await getBusinessOrders(userId);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <RiShoppingBagLine className="size-8 text-muted-foreground/60" />
        </div>
        <div>
          <p className="font-semibold text-foreground">No orders yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse products and place your first order.
          </p>
        </div>
        <Link
          href="/business/products"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Explore Products
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {orders.length} order{orders.length !== 1 ? "s" : ""} total
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Farmer</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                Items
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                Fulfillment
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => {
              const farmerName =
                order.farmer?.business_name || order.farmer?.full_name || "—";
              const itemCount = order.items?.length ?? 0;
              return (
                <tr
                  key={order.id}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/business/orders/${order.id}`}
                      className="font-mono text-sm font-medium text-foreground hover:text-primary transition-colors"
                    >
                      #{order.id.slice(0, 8).toUpperCase()}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(order.created_at).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-foreground">{farmerName}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {itemCount} item{itemCount !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {FULFILLMENT_LABELS[order.fulfillment_type]}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                    {CURRENCY}
                    {(order.total_amount ?? 0).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
