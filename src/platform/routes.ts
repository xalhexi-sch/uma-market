/**
 * UMA Platform — Route Map
 *
 * Single source of truth for all application routes.
 * Eliminates scattered hardcoded route strings.
 *
 * Usage:
 *   import { routes } from "@/platform/routes";
 *
 *   redirect(routes.signIn);
 *   revalidatePath(routes.dashboard.orders);
 *   <Link href={routes.product("abc-123")}>
 *   <Link href={routes.producer("clerk_xyz")}>
 */

// ── Public routes ──────────────────────────────────────────────────────────────

export const routes = {
  // Landing / public
  home: "/",
  about: "/about",
  terms: "/terms",
  privacy: "/privacy",
  products: "/products",
  product: (id: string) => `/products/${id}` as const,
  producers: "/producers",
  producer: (id: string) => `/producers/${id}` as const,
  cart: "/cart",
  checkout: "/checkout",
  checkoutConfirmation: (orderId?: string) =>
    (orderId ? `/checkout/confirmation/${orderId}` : "/checkout/confirmation") as string,
  orders: "/orders",
  order: (id: string) => `/orders/${id}` as const,
  dashboardRoot: "/dashboard",
  dashboardOrders: "/dashboard/orders",

  // Auth
  signIn: "/sign-in",
  signUp: "/sign-up",
  onboarding: "/onboarding",

  // Dashboard (role-neutral base)
  dashboard: {
    root: "/dashboard",
    orders: "/dashboard/orders",
    // Farmer / producer dashboard
    farmer: {
      root: "/farmer",
      products: "/farmer/products",
      product: (id: string) => `/farmer/products/${id}` as const,
      newProduct: "/farmer/products/new",
      editProduct: (id: string) => `/farmer/products/${id}/edit` as const,
      orders: "/farmer/orders",
      order: (id: string) => `/farmer/orders/${id}` as const,
    },

    // Business / buyer dashboard
    business: {
      root: "/business",
      orders: "/business/orders",
      order: (id: string) => `/business/orders/${id}` as const,
      cart: "/business/cart",
      checkout: "/business/checkout",
      favorites: "/business/favorites",
    },

    // Shared
    messages: "/messages",
    message: (orderId: string) => `/messages/${orderId}` as const,
    conversation: (
      conversationId: string,
      params?: { productId?: string; orderId?: string }
    ) => {
      const sp = new URLSearchParams();
      if (params?.productId) sp.set("productId", params.productId);
      if (params?.orderId) sp.set("orderId", params.orderId);
      const qs = sp.toString();
      return (qs ? `/messages/${conversationId}?${qs}` : `/messages/${conversationId}`) as string;
    },
    profile: "/profile",
    notifications: "/notifications",
  },

  // Admin
  admin: {
    root: "/admin",
    users: "/admin/users",
    products: "/admin/products",
    orders: "/admin/orders",
  },

  // API
  api: {
    health: "/api/health",
    search: "/api/search",
    webhooks: {
      clerk: "/api/webhooks/clerk",
    },
  },
} as const;

// ── Helper: role-based dashboard root ──────────────────────────────────────────

import type { UserRole } from "@/lib/constants";

const DASHBOARD_ROOTS: Record<UserRole, string> = {
  farmer: routes.dashboard.farmer.root,
  business: routes.dashboard.business.root,
  admin: routes.admin.root,
};

/**
 * Returns the dashboard root path for a given user role.
 * Useful for post-login redirects and navigation.
 */
export function dashboardRoot(role: UserRole): string {
  return DASHBOARD_ROOTS[role] ?? routes.home;
}
