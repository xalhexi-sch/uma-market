"use client";

import { useState } from "react";
import Image from "next/image";
import { DEFAULT_PRODUCT_PLACEHOLDER } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";

export interface ProductImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  quality?: number;
  containerClassName?: string;
}

/**
 * Checks whether an image source URL is safe to pass to Next.js <Image>.
 * Allowed:
 * 1. Local relative paths (e.g. "/product-placeholder.svg")
 * 2. Remote URLs matching the configured Supabase storage pattern (*.supabase.co /storage/v1/object/public/**)
 *
 * Unconfigured/legacy external URLs (e.g. upload.wikimedia.org) or blob/data URLs
 * must NOT be passed to Next.js <Image> to prevent runtime hostname exceptions.
 */
function isSafeNextImageSrc(url: string): boolean {
  if (!url) return false;

  // Local static path (e.g. /product-placeholder.svg)
  if (url.startsWith("/") && !url.startsWith("//")) {
    return true;
  }

  // Parse absolute URL safely
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    // Check against configured Supabase Storage remotePattern:
    // hostname: *.supabase.co, pathname: /storage/v1/object/public/**
    const isSupabaseHost =
      parsed.hostname.endsWith(".supabase.co") &&
      parsed.hostname !== "supabase.co";
    const isSupabasePublicStorage = parsed.pathname.startsWith(
      "/storage/v1/object/public/"
    );

    return isSupabaseHost && isSupabasePublicStorage;
  } catch {
    return false;
  }
}

export function ProductImage({
  src,
  alt,
  fallbackSrc = DEFAULT_PRODUCT_PLACEHOLDER,
  fill = true,
  priority = false,
  sizes,
  quality,
  className,
  containerClassName,
  style,
  ...props
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  if (prevSrc !== src) {
    setPrevSrc(src);
    setHasError(false);
  }

  const displaySrc = !hasError && src ? src : fallbackSrc;
  const isNextSafe = isSafeNextImageSrc(displaySrc);

  // If source is safe for Next.js <Image> (local static path or allowlisted Supabase public storage)
  if (isNextSafe) {
    return (
      <div className={cn("relative h-full w-full overflow-hidden", containerClassName)}>
        <Image
          src={displaySrc}
          alt={alt}
          fill={fill}
          sizes={sizes}
          priority={priority}
          quality={quality}
          className={cn("object-cover", className)}
          style={style}
          onError={() => {
            setHasError(true);
          }}
        />
      </div>
    );
  }

  // For unconfigured external URLs, blob: previews, or unsupported protocols:
  // Render native <img> with error fallback to preserve safety and prevent crashes
  return (
    <div className={cn("relative h-full w-full overflow-hidden", containerClassName)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...props}
        src={displaySrc}
        alt={alt}
        loading={priority ? "eager" : (props.loading as "lazy" | "eager" | undefined) || "lazy"}
        onError={() => {
          setHasError(true);
        }}
        className={cn("h-full w-full object-cover", className)}
        style={style}
      />
    </div>
  );
}
