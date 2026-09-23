"use client";

import { useState } from "react";
import { DEFAULT_PRODUCT_PLACEHOLDER } from "@/lib/supabase/storage";

interface ProductImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
}

export function ProductImage({
  src,
  alt,
  fallbackSrc = DEFAULT_PRODUCT_PLACEHOLDER,
  className,
  ...props
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  if (prevSrc !== src) {
    setPrevSrc(src);
    setHasError(false);
  }

  const displaySrc = !hasError && src ? src : fallbackSrc;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      src={displaySrc}
      alt={alt}
      onError={() => {
        setHasError(true);
      }}
      className={className}
    />
  );
}
