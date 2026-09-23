/**
 * Supabase Storage Utilities for UMA Market.
 * Resolves public URLs for canonical storage paths (e.g., products/{farmer_clerk_id}/{product_id}.webp).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export const PRODUCT_IMAGES_BUCKET = "product-images";
export const DEFAULT_PRODUCT_PLACEHOLDER = "/product-placeholder.svg";

/**
 * Converts a canonical storage path into a public serving URL.
 * Supports clean fallback when no image exists.
 */
export function getProductImageUrl(
  imagePath?: string | null,
  legacyImageUrl?: string | null
): string | null {
  if (imagePath && imagePath.trim()) {
    const clean = imagePath.trim().replace(/^\/+/, "");
    return `${SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${clean}`;
  }
  if (legacyImageUrl && legacyImageUrl.trim()) {
    return legacyImageUrl.trim();
  }
  return null;
}

/**
 * Validates an image file before upload.
 * Max 5MB, format: jpeg, png, webp.
 */
export function validateProductImageFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file format. Please upload a JPEG, PNG, or WebP image.",
    };
  }

  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: "File is too large. Maximum image size is 5MB.",
    };
  }

  return { valid: true };
}
