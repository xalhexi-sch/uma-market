import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { RiArrowLeftLine } from "@remixicon/react";
import { getCategories } from "@/lib/supabase/queries/products";
import { ProductForm } from "@/components/dashboard/product-form";
import type { UserRole } from "@/lib/constants";

export const metadata: Metadata = { title: "Add Product" };

export default async function NewProductPage() {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  if (role !== "farmer") {
    redirect(role === "business" ? "/business" : "/onboarding");
  }

  const categories = await getCategories();

  return (
    <div className="flex flex-col gap-0 min-h-full">
      <div className="border-b border-border px-6 py-3 lg:px-8">
        <Link
          href="/farmer/products"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RiArrowLeftLine className="size-3.5" />
          Back to Products
        </Link>
      </div>
      <div className="p-6 lg:p-8 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-6">
          Add Product
        </h1>
        <ProductForm categories={categories} mode="create" />
      </div>
    </div>
  );
}
