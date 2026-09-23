"use client";

import * as React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";

interface ProductRailCarouselProps {
  children: React.ReactNode;
  /** Number of items (used for hiding arrows when unnecessary) */
  itemCount: number;
}

export function ProductRailCarousel({
  children,
  itemCount,
}: ProductRailCarouselProps) {
  return (
    <Carousel
      opts={{
        align: "start",
        loop: false,
        slidesToScroll: 1,
      }}
      className="w-full"
    >
      <CarouselContent className="-ml-4">
        {React.Children.map(children, (child, index) => (
          <CarouselItem
            key={index}
            className="pl-4 basis-[85%] sm:basis-[48%] lg:basis-[25%]"
          >
            {child}
          </CarouselItem>
        ))}
      </CarouselContent>

      {/* Prev / Next — hidden on mobile where swipe is primary, shown on desktop when useful */}
      {itemCount > 4 && (
        <>
          <CarouselPrevious className="hidden lg:inline-flex -left-4 top-1/2 -translate-y-1/2" />
          <CarouselNext className="hidden lg:inline-flex -right-4 top-1/2 -translate-y-1/2" />
        </>
      )}
    </Carousel>
  );
}
