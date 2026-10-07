import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        // Supabase storage — product images, avatars
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Clerk user avatar CDN
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
  async redirects() {
    return [
      // ── Legacy V2 → V4 Route Migration ──────────────────────────────────
      // Dynamic: legacy public farmer profiles → V4 producer profiles
      {
        source: "/farmers/:id",
        destination: "/producers/:id",
        permanent: false,
      },

      // Farmer / Producer legacy URLs
      {
        source: "/farmer/products/new",
        destination: "/dashboard/listings/new",
        permanent: false,
      },
      {
        source: "/farmer/products/:id/edit",
        destination: "/dashboard/listings/:id/edit",
        permanent: false,
      },
      {
        source: "/farmer/products/:id",
        destination: "/products/:id",
        permanent: false,
      },
      {
        source: "/farmer/products",
        destination: "/dashboard/listings",
        permanent: false,
      },
      {
        // Legacy SELLER-side notification URL. This must NOT map to
        // /orders/:id — that route is the BUYER order detail page, and there
        // is no seller order detail route in V4. Sellers converge on the
        // canonical /dashboard/orders workspace instead (the order id stays
        // preserved in notifications.entity_id).
        source: "/farmer/orders/:id",
        destination: "/dashboard/orders",
        permanent: false,
      },
      {
        source: "/farmer/orders",
        destination: "/dashboard/orders",
        permanent: false,
      },
      {
        source: "/farmer/messages",
        destination: "/messages",
        permanent: false,
      },
      {
        source: "/farmer/profile",
        destination: "/profile",
        permanent: false,
      },
      {
        source: "/farmer",
        destination: "/dashboard",
        permanent: false,
      },

      // Business / Buyer legacy URLs
      {
        source: "/business/checkout/confirmation/:orderId",
        destination: "/checkout/confirmation/:orderId",
        permanent: false,
      },
      {
        source: "/business/checkout/confirmation",
        destination: "/checkout/confirmation",
        permanent: false,
      },
      {
        source: "/business/checkout",
        destination: "/checkout",
        permanent: false,
      },
      {
        source: "/business/cart",
        destination: "/cart",
        permanent: false,
      },
      {
        source: "/business/products/:id",
        destination: "/products/:id",
        permanent: false,
      },
      {
        source: "/business/products",
        destination: "/products",
        permanent: false,
      },
      {
        // Legacy BUYER-side notification URL → canonical buyer order detail.
        source: "/business/orders/:id",
        destination: "/orders/:id",
        permanent: false,
      },
      {
        source: "/business/orders",
        destination: "/orders",
        permanent: false,
      },
      {
        source: "/business/messages",
        destination: "/messages",
        permanent: false,
      },
      {
        source: "/business/profile",
        destination: "/profile",
        permanent: false,
      },
      {
        source: "/business",
        destination: "/dashboard",
        permanent: false,
      },

      // Dashboard aliases
      {
        source: "/dashboard/messages",
        destination: "/messages",
        permanent: false,
      },
      {
        source: "/dashboard/farmer",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/dashboard/business",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "xalhexidev",
  project: "uma-market",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: true,
  },
});
