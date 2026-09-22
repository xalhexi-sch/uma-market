import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { RiArrowLeftLine } from "@remixicon/react";
import { getCategories, getFarmerProductById } from "@/lib/supabase/queries/products";
import { ProductForm } from "@/components/dashboard/product-form";
import type { UserRole } from "@/lib/constants";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  await params;
  return { title: `Edit Product` };
}

export default async function EditProductPage({ params }: PageProps) {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  if (role !== "farmer" || !userId) {
    redirect(role === "business" ? "/business" : "/onboarding");
  }

  const { id } = await params;
  const [product, categories] = await Promise.all([
    getFarmerProductById(id, userId),
    getCategories(),
  ]);

  if (!product) notFound();

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
          Edit Product
        </h1>
        <ProductForm categories={categories} mode="edit" product={product} />
      </div>
    </div>
  );
}
