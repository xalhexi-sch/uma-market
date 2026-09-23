import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { RiShoppingBagLine } from "@remixicon/react";
import { getFarmerOrders } from "@/lib/supabase/queries/orders";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { CURRENCY, FULFILLMENT_LABELS } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";

export const metadata: Metadata = { title: "Incoming Orders" };
export const dynamic = "force-dynamic";

export default async function FarmerOrdersPage() {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  if (role !== "farmer" || !userId) {
    redirect(role === "business" ? "/business/orders" : "/onboarding");
  }

  const orders = await getFarmerOrders(userId);
  const pending = orders.filter((o) => o.status === "pending");
  const active = orders.filter((o) => ["accepted","preparing","ready","for_delivery"].includes(o.status));
  const past = orders.filter((o) => ["completed","cancelled"].includes(o.status));

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Incoming Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pending.length > 0
            ? `${pending.length} order${pending.length !== 1 ? "s" : ""} awaiting your response`
            : "No orders awaiting response"}
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center rounded-xl border border-dashed border-border">
          <RiShoppingBagLine className="size-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-foreground">No orders yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Orders from businesses will appear here once you have active products.
            </p>
          </div>
          <Link
            href="/farmer/products"
            className="text-sm font-medium text-primary hover:underline"
          >
            Manage Products
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {pending.length > 0 && (
            <OrderTable title="Awaiting Response" orders={pending} />
          )}
          {active.length > 0 && (
            <OrderTable title="Active" orders={active} />
          )}
          {past.length > 0 && (
            <OrderTable title="Past" orders={past} />
          )}
        </div>
      )}
    </div>
  );
}

function OrderTable({
  title,
  orders,
}: {
  title: string;
  orders: Awaited<ReturnType<typeof getFarmerOrders>>;
}) {
  return (
    <div>
      <h2 className="text-sm font-medium text-muted-foreground mb-3">{title}</h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Business</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Fulfillment</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => {
              const bizName =
                order.business?.business_name || order.business?.full_name || "—";
              return (
                <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/farmer/orders/${order.id}`}
                      className="font-mono text-sm font-medium text-foreground hover:text-primary transition-colors"
                    >
                      #{order.id.slice(0, 8).toUpperCase()}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(order.created_at).toLocaleDateString("en-PH", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-foreground">{bizName}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {FULFILLMENT_LABELS[order.fulfillment_type]}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                    {CURRENCY}{(order.total_amount ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
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
