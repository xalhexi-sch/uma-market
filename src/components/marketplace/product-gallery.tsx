"use client";

import * as React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import { ProductImage } from "@/components/ui/product-image";
import { getProductImageUrl, DEFAULT_PRODUCT_PLACEHOLDER } from "@/lib/supabase/storage";
import type { ProductImageItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images?: ProductImageItem[];
  productName: string;
  fallbackImagePath?: string | null;
  fallbackImageUrl?: string | null;
  categoryName?: string;
  className?: string;
}

export function ProductGallery({
  images = [],
  productName,
  fallbackImagePath,
  fallbackImageUrl,
  categoryName,
  className,
}: ProductGalleryProps) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);

  // Normalize image list
  const galleryItems = React.useMemo(() => {
    if (images && images.length > 0) {
      return images
        .map((img) => ({
          id: img.id,
          url: getProductImageUrl(img.image_path) || "",
        }))
        .filter((item) => Boolean(item.url));
    }
    const singleUrl = getProductImageUrl(fallbackImagePath, fallbackImageUrl);
    if (singleUrl) {
      return [{ id: "fallback-primary", url: singleUrl }];
    }
    return [];
  }, [images, fallbackImagePath, fallbackImageUrl]);

  React.useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap());
      setCount(api.scrollSnapList().length);
    };

    const timer = setTimeout(onSelect, 0);
    api.on("select", onSelect);
    api.on("reInit", onSelect);

    return () => {
      clearTimeout(timer);
      api.off("select", onSelect);
    };
  }, [api]);

  // Case 1: No images at all -> placeholder
  if (galleryItems.length === 0) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-muted border border-border/60 shadow-xs relative">
          <ProductImage
            src={DEFAULT_PRODUCT_PLACEHOLDER}
            alt={productName}
            className="h-full w-full object-cover"
          />
          {categoryName && (
            <span className="absolute top-4 left-4 rounded-full bg-background/95 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-foreground shadow-xs">
              {categoryName}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Case 2: Exactly 1 image -> simple focused hero display without redundant controls
  if (galleryItems.length === 1) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-muted border border-border/60 shadow-xs relative">
          <ProductImage
            src={galleryItems[0].url}
            alt={productName}
            className="h-full w-full object-cover"
          />
          {categoryName && (
            <span className="absolute top-4 left-4 rounded-full bg-background/95 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-foreground shadow-xs">
              {categoryName}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Case 3: Multiple images (2 to 5) -> multi-photo procurement gallery
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Primary Carousel */}
      <Carousel
        setApi={setApi}
        opts={{
          loop: true,
          align: "start",
        }}
        className="relative w-full"
      >
        <div className="w-full rounded-2xl overflow-hidden bg-muted border border-border/60 shadow-xs relative group">
          <CarouselContent className="-ml-0">
            {galleryItems.map((item, index) => (
              <CarouselItem key={item.id} className="pl-0 basis-full">
                <div className="relative aspect-[4/3] w-full">
                  <ProductImage
                    src={item.url}
                    alt={`${productName} — Photo ${index + 1}`}
                    className="absolute inset-0 h-full w-full object-cover object-center select-none"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* Category Badge */}
          {categoryName && (
            <span className="absolute top-4 left-4 rounded-full bg-background/95 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-foreground shadow-xs z-10 pointer-events-none">
              {categoryName}
            </span>
          )}

          {/* Slide Indicator Badge */}
          <div className="absolute bottom-4 right-4 z-10 rounded-full bg-background/90 backdrop-blur-xs px-2.5 py-1 text-xs font-medium text-foreground shadow-xs border border-border/50 tabular-nums pointer-events-none">
            {current + 1} / {count || galleryItems.length}
          </div>

          {/* Previous / Next Overlay Controls for Desktop */}
          <div className="absolute inset-y-0 left-3 flex items-center z-10">
            <CarouselPrevious
              className="static translate-y-0 size-8 sm:size-9 rounded-full border-border/80 bg-background/90 text-foreground hover:bg-background shadow-xs opacity-80 hover:opacity-100 transition-opacity"
            />
          </div>
          <div className="absolute inset-y-0 right-3 flex items-center z-10">
            <CarouselNext
              className="static translate-y-0 size-8 sm:size-9 rounded-full border-border/80 bg-background/90 text-foreground hover:bg-background shadow-xs opacity-80 hover:opacity-100 transition-opacity"
            />
          </div>
        </div>
      </Carousel>

      {/* Thumbnail Strip */}
      <div
        className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin focus:outline-none"
        role="tablist"
        aria-label="Produce photos thumbnail navigation"
      >
        {galleryItems.map((item, index) => {
          const isSelected = current === index;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-label={`Show photo ${index + 1} of ${galleryItems.length}`}
              onClick={() => api?.scrollTo(index)}
              className={cn(
                "relative aspect-square size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl border bg-muted transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isSelected
                  ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100 shadow-xs"
                  : "border-border/80 opacity-60 hover:opacity-90"
              )}
            >
              <ProductImage
                src={item.url}
                alt={`${productName} thumbnail ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
