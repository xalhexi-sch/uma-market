import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RiArrowLeftLine, RiStoreLine } from "@remixicon/react";
import { Empty, EmptyHeader, EmptyTitle, EmptyMedia } from "@/components/ui/empty";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
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
    if (role === "farmer" || role === "business") redirect("/dashboard");
    redirect("/onboarding");
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
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/40">
                <TableHead className="text-muted-foreground">Produce & Category</TableHead>
                <TableHead className="text-muted-foreground">Farm Producer</TableHead>
                <TableHead className="text-muted-foreground">Unit Price</TableHead>
                <TableHead className="text-muted-foreground">Stock</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-right text-muted-foreground">Moderation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8">
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <RiStoreLine className="size-4" />
                        </EmptyMedia>
                        <EmptyTitle>No products listed on the platform yet.</EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <AdminProductRow key={product.id} product={product} />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
