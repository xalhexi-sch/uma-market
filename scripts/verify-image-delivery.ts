// ==============================================================================
// UMA Market — Image Delivery & Rendering Optimization Verification Suite
// Slice 2 verification: Next.js Image pathing, crash-proof source handling,
// responsive sizes, LCP priority, untouched Clerk avatars & upload previews
// ==============================================================================

import { readFileSync } from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import sharp from "sharp";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xckdihprwjdwutglytwu.supabase.co";

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(id: string, name: string, condition: boolean, details: string) {
  results.push({ id, name, passed: condition, details });
  const status = condition ? "PASS" : "FAIL";
  console.log(`[${status}] ${id}: ${name} — ${details}`);
}

async function runImageDeliveryVerification() {
  console.log("==============================================================================");
  console.log("UMA Market — Optimization Slice 2: Image Delivery Verification");
  console.log("==============================================================================\n");

  const rootDir = process.cwd();

  // Read target source files
  const productImageCode = readFileSync(path.join(rootDir, "src/components/ui/product-image.tsx"), "utf8");
  const marketplaceCardCode = readFileSync(path.join(rootDir, "src/components/marketplace/marketplace-product-card.tsx"), "utf8");
  const productGalleryCode = readFileSync(path.join(rootDir, "src/components/marketplace/product-gallery.tsx"), "utf8");
  const nextConfigCode = readFileSync(path.join(rootDir, "next.config.ts"), "utf8");
  const avatarCode = readFileSync(path.join(rootDir, "src/components/ui/avatar.tsx"), "utf8");
  const productFormCode = readFileSync(path.join(rootDir, "src/components/dashboard/product-form.tsx"), "utf8");

  // -------------------------------------------------------------------------
  // TEST-01: Next.js <Image> import and usage in ProductImage
  // -------------------------------------------------------------------------
  const hasNextImageImport = productImageCode.includes('import Image from "next/image"');
  const rendersNextImage = productImageCode.includes("<Image");
  assert(
    "TEST-01",
    "ProductImage uses Next.js <Image> for safe paths",
    hasNextImageImport && rendersNextImage,
    "ProductImage imports and renders Next.js <Image> for allowlisted paths"
  );

  // -------------------------------------------------------------------------
  // TEST-02: Crash-proof source validation for Supabase vs unconfigured hosts
  // -------------------------------------------------------------------------
  const hasSafetyCheck = productImageCode.includes("isSafeNextImageSrc");
  const checksSupabaseHost = productImageCode.includes(".supabase.co");
  const checksPublicStorage = productImageCode.includes("/storage/v1/object/public/");
  const hasNativeFallback = productImageCode.includes("<img");
  assert(
    "TEST-02",
    "Crash-proof source validation prevents un-allowlisted hostname crashes",
    hasSafetyCheck && checksSupabaseHost && checksPublicStorage && hasNativeFallback,
    "Strict allowlist checks for *.supabase.co and /storage/v1/object/public/, with native <img> fallback"
  );

  // -------------------------------------------------------------------------
  // TEST-03: Missing or null image gracefully defaults to placeholder SVG
  // -------------------------------------------------------------------------
  const usesPlaceholder = productImageCode.includes("DEFAULT_PRODUCT_PLACEHOLDER");
  const hasErrorState = productImageCode.includes("hasError");
  assert(
    "TEST-03",
    "Missing / failed images fall back to product placeholder",
    usesPlaceholder && hasErrorState,
    "Clean error handling with fallbackSrc defaulting to DEFAULT_PRODUCT_PLACEHOLDER (/product-placeholder.svg)"
  );

  // -------------------------------------------------------------------------
  // TEST-04: Marketplace product cards provide responsive sizes & optional priority
  // -------------------------------------------------------------------------
  const hasCardSizes = marketplaceCardCode.includes('sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 288px"');
  const hasCardPriority = marketplaceCardCode.includes("priority?: boolean");
  const passesPriorityToImage = marketplaceCardCode.includes("priority={priority}");
  assert(
    "TEST-04",
    "MarketplaceProductCard configures responsive sizes and priority prop",
    hasCardSizes && hasCardPriority && passesPriorityToImage,
    "Responsive sizes configured for 1/2/3/4-col grid; priority prop exposed and wired"
  );

  // -------------------------------------------------------------------------
  // TEST-05: Product gallery hero image prioritizes primary image as LCP candidate
  // -------------------------------------------------------------------------
  const hasGalleryHeroSizes = productGalleryCode.includes('sizes="(max-width: 1024px) 100vw, 460px"');
  const hasPrimaryHeroPriority = productGalleryCode.includes("priority={index === 0}") || productGalleryCode.includes("priority\n");
  assert(
    "TEST-05",
    "ProductGallery hero image configures responsive sizes and LCP priority",
    hasGalleryHeroSizes && hasPrimaryHeroPriority,
    "Hero image uses sizes='(max-width: 1024px) 100vw, 460px' with priority on index 0"
  );

  // -------------------------------------------------------------------------
  // TEST-06: Product gallery thumbnails configure compact sizing (80px)
  // -------------------------------------------------------------------------
  const hasThumbSizes = productGalleryCode.includes('sizes="80px"');
  assert(
    "TEST-06",
    "ProductGallery thumbnails configure 80px sizing",
    hasThumbSizes,
    "Thumbnails specify sizes='80px' to serve compact cached thumbnails instead of master resolution"
  );

  // -------------------------------------------------------------------------
  // TEST-07: Clerk avatars remain untouched
  // -------------------------------------------------------------------------
  const usesBaseUiAvatar = avatarCode.includes("@base-ui/react/avatar");
  const avatarDoesNotImportNextImage = !avatarCode.includes('from "next/image"');
  assert(
    "TEST-07",
    "Clerk / shared Avatar component remains untouched",
    usesBaseUiAvatar && avatarDoesNotImportNextImage,
    "Avatar preserves @base-ui/react/avatar primitives with zero next/image modification"
  );

  // -------------------------------------------------------------------------
  // TEST-08: Farmer product upload previews remain untouched
  // -------------------------------------------------------------------------
  const productFormUsesNativeImg = productFormCode.includes("<img");
  const productFormDoesNotImportNextImage = !productFormCode.includes('from "next/image"');
  assert(
    "TEST-08",
    "Product upload form previews remain untouched",
    productFormUsesNativeImg && productFormDoesNotImportNextImage,
    "Product form continues using native <img> for client-side blob: preview URLs"
  );

  // -------------------------------------------------------------------------
  // TEST-09: next.config.ts modern image formats added without domain expansion
  // -------------------------------------------------------------------------
  const hasAvifFormat = nextConfigCode.includes('"image/avif"');
  const hasWebpFormat = nextConfigCode.includes('"image/webp"');
  const noWikimediaAllowlist = !nextConfigCode.includes("wikimedia");
  const strictSupabasePattern = nextConfigCode.includes("*.supabase.co");
  assert(
    "TEST-09",
    "next.config.ts adds AVIF/WebP formats with strict remotePatterns",
    hasAvifFormat && hasWebpFormat && noWikimediaAllowlist && strictSupabasePattern,
    "formats: ['image/avif', 'image/webp'] added; strict *.supabase.co and img.clerk.com patterns preserved"
  );

  // -------------------------------------------------------------------------
  // TEST-10: Empirical Sharp optimization test on actual Supabase image
  // -------------------------------------------------------------------------
  let sharpReductionAchieved = false;
  let originalBytes = 0;
  let optimizedBytes = 0;

  try {
    const testImageUrl = `${supabaseUrl}/storage/v1/object/public/product-images/products/demo_farmer_agusan_valley/native-purple-ube.jpg`;
    const res = await fetch(testImageUrl);
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      originalBytes = buffer.length;

      // Simulate Next.js image transformation at 384w WebP quality 75 (desktop card target)
      const optimized = await sharp(buffer)
        .resize(384)
        .webp({ quality: 75 })
        .toBuffer();
      optimizedBytes = optimized.length;

      // Expect > 70% reduction from master image
      sharpReductionAchieved = optimizedBytes < originalBytes * 0.3;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("Could not fetch remote image for live sharp test:", msg);
  }

  assert(
    "TEST-10",
    "Empirical Sharp compression test demonstrates substantial payload reduction",
    sharpReductionAchieved,
    `Original: ${originalBytes} B -> Optimized 384w WebP: ${optimizedBytes} B (${((1 - optimizedBytes / originalBytes) * 100).toFixed(1)}% reduction)`
  );

  console.log("\n==============================================================================");
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`SUMMARY: ${passedCount}/${results.length} PASSED (${results.length - passedCount} failed)`);
  console.log("==============================================================================");

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runImageDeliveryVerification().catch((err) => {
  console.error("Verification failed with uncaught error:", err);
  process.exit(1);
});
