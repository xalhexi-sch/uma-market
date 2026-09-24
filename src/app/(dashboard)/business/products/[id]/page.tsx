import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { RiArrowLeftLine, RiPlantLine, RiMapPinLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AddToCartControls } from "@/components/dashboard/add-to-cart-controls";
import { ProductGallery } from "@/components/marketplace/product-gallery";
import { getProductById } from "@/lib/supabase/queries/products";
import { CURRENCY } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id).catch(() => null);
  return {
    title: product?.name ?? "Product",
    description: product?.description ?? undefined,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  if (role !== "business") {
    if (role === "farmer") redirect("/farmer");
    if (role === "admin") redirect("/admin");
    redirect("/onboarding");
  }

  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  const farmerName =
    product.farmer?.business_name ||
    product.farmer?.full_name ||
    "Local Farm";
  const isAvailable = product.quantity_available > 0;
  return (
    <div className="flex flex-col gap-0 min-h-full">
      {/* Breadcrumb */}
      <div className="border-b border-border px-6 py-3 lg:px-8">
        <Link
          href="/business/products"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RiArrowLeftLine className="size-3.5" />
          Back to Products
        </Link>
      </div>

      <div className="flex flex-col gap-8 p-6 lg:p-8 lg:flex-row lg:gap-12 max-w-5xl">
        {/* Gallery */}
        <div className="w-full lg:w-[420px] shrink-0">
          <ProductGallery
            images={product.images}
            productName={product.name}
            fallbackImagePath={product.image_path}
            fallbackImageUrl={product.image_url}
          />
        </div>

        {/* Details */}
        <div className="flex flex-1 flex-col gap-6">
          {/* Identity */}
          <div>
            {product.category && (
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-primary">
                {product.category.name}
              </p>
            )}
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {product.name}
            </h1>
            <p className="mt-2 text-3xl font-bold text-foreground">
              {CURRENCY}
              {product.price_per_unit.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}{" "}
              <span className="text-lg font-normal text-muted-foreground">
                per {product.unit}
              </span>
            </p>
          </div>

          {/* Availability */}
          <div className="flex items-center gap-2">
            {isAvailable ? (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                <span className="text-sm text-foreground">
                  {product.quantity_available} {product.unit} available
                </span>
              </>
            ) : (
              <Badge variant="secondary">Out of stock</Badge>
            )}
          </div>

          {/* Source */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <RiPlantLine className="size-4 text-primary" />
              <span className="text-sm font-medium text-foreground">{farmerName}</span>
              {product.farmer?.is_verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  ✓ Verified Producer
                </span>
              )}
            </div>
            {product.farmer?.city && (
              <div className="flex items-center gap-2 ml-6">
                <RiMapPinLine className="size-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{product.farmer.city}</span>
              </div>
            )}
            {product.farmer?.bio && (
              <p className="ml-6 text-sm text-muted-foreground mt-1 leading-relaxed">
                {product.farmer.bio}
              </p>
            )}
          </div>

          {/* Attributes */}
          {(product.harvest_date || product.available_until || product.min_order_quantity > 1) && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {product.min_order_quantity > 1 && (
                <div>
                  <p className="text-muted-foreground">Minimum order</p>
                  <p className="font-medium text-foreground">
                    {product.min_order_quantity} {product.unit}
                  </p>
                </div>
              )}
              {product.harvest_date && (
                <div>
                  <p className="text-muted-foreground">Harvest date</p>
                  <p className="font-medium text-foreground">
                    {new Date(product.harvest_date).toLocaleDateString("en-PH", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </p>
                </div>
              )}
              {product.available_until && (
                <div>
                  <p className="text-muted-foreground">Available until</p>
                  <p className="font-medium text-foreground">
                    {new Date(product.available_until).toLocaleDateString("en-PH", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div>
              <Separator className="mb-4" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          <Separator />

          {/* Add to Cart */}
          <AddToCartControls product={product} />
        </div>
      </div>
    </div>
  );
}
