import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RiArrowLeftLine, RiStoreLine } from "@remixicon/react";
import { getAdminProducts } from "@/lib/supabase/queries/admin";
import { AdminProductRow } from "@/components/dashboard/admin-product-row";
import type { UserRole } from "@/lib/constants";

export const metadata = {
  title: "Produce Moderation — UMA Market Admin",
  description: "Moderate and inspect all agricultural listings on UMA Market.",
};

export default async function AdminProductsPage() {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;

  if (role !== "admin") {
    redirect(role === "farmer" ? "/farmer" : role === "business" ? "/business" : "/onboarding");
  }

  const products = await getAdminProducts();

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
          <RiStoreLine className="size-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Produce Moderation
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Audit agricultural produce listings, review unit pricing, and moderate active status across all Butuan producers.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">Produce & Category</th>
                <th className="py-3 px-4">Farm Producer</th>
                <th className="py-3 px-4">Unit Price</th>
                <th className="py-3 px-4">Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Moderation</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No products listed on the platform yet.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <AdminProductRow key={product.id} product={product} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
