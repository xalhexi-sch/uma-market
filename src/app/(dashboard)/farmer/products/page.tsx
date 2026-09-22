import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { RiAddLine, RiPlantLine, RiEditLine } from "@remixicon/react";
import { getFarmerProducts } from "@/lib/supabase/queries/products";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CURRENCY } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";

export const metadata: Metadata = { title: "My Products" };
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  active:      "text-emerald-700 bg-emerald-50 border-emerald-200",
  draft:       "text-amber-700 bg-amber-50 border-amber-200",
  out_of_stock:"text-red-700 bg-red-50 border-red-200",
  archived:    "text-muted-foreground bg-muted border-border",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  draft: "Draft",
  out_of_stock: "Out of Stock",
  archived: "Archived",
};

export default async function FarmerProductsPage() {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  if (role !== "farmer" || !userId) {
    if (role === "business") redirect("/business");
    redirect("/onboarding");
  }

  const products = await getFarmerProducts(userId);

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} product{products.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/farmer/products/new" className={buttonVariants()}>
          <RiAddLine className="size-4 mr-2" />
          Add Product
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center rounded-xl border border-border border-dashed">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <RiPlantLine className="size-7 text-muted-foreground/60" />
          </div>
          <div>
            <p className="font-medium text-foreground">No products yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first product listing to start receiving orders.
            </p>
          </div>
          <Link href="/farmer/products/new" className={buttonVariants({ variant: "outline" })}>
            <RiAddLine className="size-4 mr-2" />
            Add First Product
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                  Category
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">
                  Available
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground sr-only">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{product.name}</p>
                    {product.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {product.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {product.category?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                    {CURRENCY}
                    {product.price_per_unit.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    <span className="font-normal text-muted-foreground">/ {product.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell tabular-nums">
                    {product.quantity_available} {product.unit}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={STATUS_STYLES[product.status] ?? ""}
                    >
                      {STATUS_LABELS[product.status] ?? product.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/farmer/products/${product.id}/edit`}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <RiEditLine className="size-3.5" />
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
