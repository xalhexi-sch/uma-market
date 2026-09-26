import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

export interface PublicFarmerProfile {
  clerk_id: string;
  full_name: string | null;
  business_name: string | null;
  city: string;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

/**
 * Fetch a public farmer profile from the privacy-hardened public_farmer_profiles view.
 * Exposes ONLY approved public provenance columns (name, farm name, city, bio, avatar, verified).
 * Protected against sensitive data leakage (phone, address, credentials omitted at DB engine level).
 * Wrapped in React cache() to deduplicate render passes (e.g. generateMetadata + Page).
 */
export const getPublicFarmerProfile = cache(
  async (clerkId: string): Promise<PublicFarmerProfile | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("public_farmer_profiles")
      .select("clerk_id, full_name, business_name, city, bio, avatar_url, is_verified")
      .eq("clerk_id", clerkId)
      .maybeSingle();

    if (error) {
      console.error("[public-profiles] getPublicFarmerProfile error:", error.message);
      return null;
    }

    return (data as PublicFarmerProfile | null) ?? null;
  }
);

interface RawProductRow {
  id: string;
  farmer_clerk_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_per_unit: number;
  unit: string;
  quantity_available: number;
  min_order_quantity: number;
  image_url: string | null;
  image_path: string | null;
  harvest_date: string | null;
  available_until: string | null;
  status: Product["status"];
  created_at: string;
  updated_at: string;
  category: Product["category"];
  images: { id: string; product_id: string; image_path: string; sort_order: number }[] | null;
}

/**
 * Fetch active produce listings owned by a farmer.
 * Strictly filters by status = 'active' to ensure draft or archived products are never exposed.
 * Project images and category relationships matching marketplace standards.
 */
export async function getActiveProductsByFarmer(
  clerkId: string,
  farmerProfile?: PublicFarmerProfile | null
): Promise<Product[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, farmer_clerk_id, category_id, name, description,
      price_per_unit, unit, quantity_available, min_order_quantity,
      image_url, image_path, harvest_date, available_until, status, created_at, updated_at,
      category:categories(id, name, slug),
      images:product_images(id, product_id, image_path, sort_order)
    `
    )
    .eq("farmer_clerk_id", clerkId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[public-profiles] getActiveProductsByFarmer error:", error.message);
    return [];
  }

  const rawRows = (data ?? []) as unknown as RawProductRow[];

  return rawRows.map((row) => {
    let images = row.images ?? [];
    if (images.length > 0) {
      images = [...images].sort((a, b) => a.sort_order - b.sort_order);
    } else if (row.image_path || row.image_url) {
      images = [
        {
          id: "primary",
          product_id: row.id,
          image_path: row.image_path || row.image_url || "",
          sort_order: 0,
        },
      ];
    }

    return {
      id: row.id,
      farmer_clerk_id: row.farmer_clerk_id,
      category_id: row.category_id,
      name: row.name,
      description: row.description,
      price_per_unit: Number(row.price_per_unit),
      unit: row.unit,
      quantity_available: Number(row.quantity_available),
      min_order_quantity: Number(row.min_order_quantity),
      image_url: row.image_url,
      image_path: row.image_path,
      harvest_date: row.harvest_date,
      available_until: row.available_until,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      category: row.category && row.category.id ? row.category : undefined,
      farmer: farmerProfile
        ? {
            clerk_id: farmerProfile.clerk_id,
            full_name: farmerProfile.full_name,
            business_name: farmerProfile.business_name,
            city: farmerProfile.city,
            avatar_url: farmerProfile.avatar_url,
            bio: farmerProfile.bio,
            is_verified: farmerProfile.is_verified,
          }
        : undefined,
      images,
    } as Product;
  });
}
