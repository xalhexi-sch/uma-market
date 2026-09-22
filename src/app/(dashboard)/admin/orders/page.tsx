import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RiArrowLeftLine, RiShoppingBagLine } from "@remixicon/react";
import { getAdminOrders } from "@/lib/supabase/queries/admin";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { Badge } from "@/components/ui/badge";
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
    redirect(role === "farmer" ? "/farmer" : role === "business" ? "/business" : "/onboarding");
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">Order Ref</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Commercial Buyer</th>
                <th className="py-3 px-4">Farm Supplier</th>
                <th className="py-3 px-4">Fulfillment</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No orders placed on the platform yet.
                  </td>
                </tr>
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
                    <tr key={order.id} className="border-b border-border transition-colors hover:bg-muted/20 text-sm">
                      <td className="py-3 px-4 font-mono font-medium text-foreground text-xs">
                        {ref}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {buyerName}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {farmerName}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="capitalize text-xs font-medium">
                          {order.fulfillment_type === "seller_delivery" ? "Delivery" : "Pickup"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground tabular-nums">
                        {CURRENCY}{(Number(order.total_amount) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <OrderStatusBadge status={order.status as OrderStatus} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
