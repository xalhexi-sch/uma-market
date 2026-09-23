// Demo data — not real persons or businesses
// UMA Market — Seed Demo Data Script (Checkpoint 5.3)

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Category Slugs to UUIDs mapped dynamically from database
interface CategoryRecord {
  id: string;
  slug: string;
  name: string;
}

// 4 Fictional Farmers
const DEMO_FARMERS = [
  {
    clerk_id: "demo_farmer_verdant_ridge",
    role: "farmer" as const,
    full_name: "Demo Producer Alpha",
    business_name: "Verdant Ridge Demo Farm",
    phone: "0917-000-0001",
    city: "Butuan",
    address: "Demo Agricultural Zone 1, Butuan City",
    bio: "Specializing in organic highland vegetables, crisp greens, and pesticide-free produce for commercial kitchens.",
    is_verified: true,
  },
  {
    clerk_id: "demo_farmer_agusan_valley",
    role: "farmer" as const,
    full_name: "Demo Producer Beta",
    business_name: "Agusan Valley Demo Organics",
    phone: "0917-000-0002",
    city: "Butuan",
    address: "Demo Farm Corridor 2, Butuan City",
    bio: "Wholesale grain, premium milling rice, and heritage root crops cultivated under sustainable farming methods.",
    is_verified: true,
  },
  {
    clerk_id: "demo_farmer_golden_harvest",
    role: "farmer" as const,
    full_name: "Demo Producer Gamma",
    business_name: "Golden Harvest Demo Agro",
    phone: "0917-000-0003",
    city: "Butuan",
    address: "Demo Rural Sector 3, Butuan City",
    bio: "Family-run demo orchard producing sweet tropical fruits, raw wild honey, and aromatic native spices.",
    is_verified: false,
  },
  {
    clerk_id: "demo_farmer_riverbend",
    role: "farmer" as const,
    full_name: "Demo Producer Delta",
    business_name: "Riverbend Demo Aquafarm",
    phone: "0917-000-0004",
    city: "Butuan",
    address: "Demo Fishery Basin 4, Butuan City",
    bio: "Responsible freshwater aquaculture, pond-raised tilapia, fresh milkfish, and free-range native poultry.",
    is_verified: true,
  },
];

// 2 Fictional Commercial Buyers
const DEMO_BUYERS = [
  {
    clerk_id: "demo_buyer_sunrise_eatery",
    role: "business" as const,
    full_name: "Demo Buyer One",
    business_name: "Sunrise Demo Eatery",
    phone: "0918-000-0001",
    city: "Butuan",
    address: "Commercial District Hub, Butuan City",
    bio: "High-volume city eatery sourcing daily fresh farm produce directly from verified local producers.",
    is_verified: true,
  },
  {
    clerk_id: "demo_buyer_caraga_caterers",
    role: "business" as const,
    full_name: "Demo Buyer Two",
    business_name: "Caraga Table Demo Catering",
    phone: "0918-000-0002",
    city: "Butuan",
    address: "Midtown Catering Commissary, Butuan City",
    bio: "Institutional food service and regional event catering commissary requiring bulk wholesale produce.",
    is_verified: false,
  },
];

// 20 Fictional Products across all 8 Categories
interface SeedProductDef {
  id: string; // Deterministic UUID
  farmer_clerk_id: string;
  category_slug: string;
  name: string;
  description: string;
  price_per_unit: number;
  unit: string;
  quantity_available: number;
  min_order_quantity: number;
  harvest_offset_days: number; // relative to today
  available_offset_days: number;
  slug: string;
  imageUrl: string;
}

const DEMO_PRODUCTS: SeedProductDef[] = [
  // 1. Vegetables (4 items)
  {
    id: "a0000001-0000-0000-0000-000000000001",
    farmer_clerk_id: "demo_farmer_verdant_ridge",
    category_slug: "vegetables",
    slug: "highland-ampalaya",
    name: "Highland Green Ampalaya (Bitter Gourd)",
    description: "Crisp, deeply ridged bitter melon harvested at peak maturity. Ideal for pinakbet and healthy sautéed vegetable dishes.",
    price_per_unit: 75,
    unit: "kg",
    quantity_available: 80,
    min_order_quantity: 5,
    harvest_offset_days: -1,
    available_offset_days: 7,
    imageUrl: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "a0000001-0000-0000-0000-000000000002",
    farmer_clerk_id: "demo_farmer_verdant_ridge",
    category_slug: "vegetables",
    slug: "native-pechay",
    name: "Crisp Native Pechay (Bok Choy)",
    description: "Freshly bundled green leafy pechay, washed and trimmed. Tender white stalks and vibrant green leaves.",
    price_per_unit: 45,
    unit: "kg",
    quantity_available: 120,
    min_order_quantity: 10,
    harvest_offset_days: 0,
    available_offset_days: 5,
    imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "a0000001-0000-0000-0000-000000000003",
    farmer_clerk_id: "demo_farmer_verdant_ridge",
    category_slug: "vegetables",
    slug: "native-eggplants",
    name: "Fresh Native Eggplants (Talong)",
    description: "Firm, glossy purple long eggplants. Consistently graded for restaurant frying, torta, and stews.",
    price_per_unit: 60,
    unit: "kg",
    quantity_available: 100,
    min_order_quantity: 10,
    harvest_offset_days: -2,
    available_offset_days: 6,
    imageUrl: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "a0000001-0000-0000-0000-000000000004",
    farmer_clerk_id: "demo_farmer_verdant_ridge",
    category_slug: "vegetables",
    slug: "pole-sitaw",
    name: "Pole Sitaw (Long Green String Beans)",
    description: "Tender stringless long yard beans bundled in wholesale bunches. Perfect crunch for everyday commercial cooking.",
    price_per_unit: 55,
    unit: "kg",
    quantity_available: 70,
    min_order_quantity: 5,
    harvest_offset_days: -1,
    available_offset_days: 5,
    imageUrl: "https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?w=800&auto=format&fit=crop&q=80",
  },

  // 2. Fruits (3 items)
  {
    id: "a0000001-0000-0000-0000-000000000005",
    farmer_clerk_id: "demo_farmer_golden_harvest",
    category_slug: "fruits",
    slug: "carabao-mangoes",
    name: "Carabao Sweet Mangoes (Grade A)",
    description: "Export-grade sweet yellow mangoes grown in sunny Agusan groves. High brix sweetness with silky fiber-free pulp.",
    price_per_unit: 130,
    unit: "kg",
    quantity_available: 250,
    min_order_quantity: 15,
    harvest_offset_days: -1,
    available_offset_days: 10,
    imageUrl: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "a0000001-0000-0000-0000-000000000006",
    farmer_clerk_id: "demo_farmer_golden_harvest",
    category_slug: "fruits",
    slug: "cavendish-bananas",
    name: "Cavendish Table Bananas",
    description: "Clean green-to-yellow dessert bananas. Uniform sizing and blemish-free skin suited for hotels and bakeries.",
    price_per_unit: 50,
    unit: "kg",
    quantity_available: 180,
    min_order_quantity: 12,
    harvest_offset_days: -2,
    available_offset_days: 8,
    imageUrl: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "a0000001-0000-0000-0000-000000000007",
    farmer_clerk_id: "demo_farmer_golden_harvest",
    category_slug: "fruits",
    slug: "solo-papaya",
    name: "Solo Sweet Papaya",
    description: "Semi-ripe Solo papayas with thick reddish-orange flesh. Naturally sweet, high in vitamin C, and sturdy for transport.",
    price_per_unit: 40,
    unit: "kg",
    quantity_available: 140,
    min_order_quantity: 10,
    harvest_offset_days: -1,
    available_offset_days: 7,
    imageUrl: "https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800&auto=format&fit=crop&q=80",
  },

  // 3. Rice & Grains (3 items)
  {
    id: "a0000001-0000-0000-0000-000000000008",
    farmer_clerk_id: "demo_farmer_agusan_valley",
    category_slug: "rice-grains",
    slug: "dinorado-rice-sack",
    name: "Dinorado Fragrant Rice (25kg Sack)",
    description: "Milled pinkish-white Dinorado grains with signature floral aroma and soft, slightly sticky cooked texture.",
    price_per_unit: 1250,
    unit: "sack",
    quantity_available: 50,
    min_order_quantity: 2,
    harvest_offset_days: -10,
    available_offset_days: 90,
    imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "a0000001-0000-0000-0000-000000000009",
    farmer_clerk_id: "demo_farmer_agusan_valley",
    category_slug: "rice-grains",
    slug: "sinandomeng-white-rice",
    name: "Sinandomeng Polished White Rice",
    description: "Well-milled everyday staple rice. Breads and fluffs up nicely, making it the most economical wholesale choice for dining rooms.",
    price_per_unit: 48,
    unit: "kg",
    quantity_available: 600,
    min_order_quantity: 25,
    harvest_offset_days: -15,
    available_offset_days: 90,
    imageUrl: "https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "a0000001-0000-0000-0000-000000000010",
    farmer_clerk_id: "demo_farmer_agusan_valley",
    category_slug: "rice-grains",
    slug: "yellow-corn-grits",
    name: "Yellow Corn Grits (Wholesale Grain)",
    description: "Coarsely ground whole dried yellow corn. Excellent for blending with rice or for specialty polenta and cornmeal recipes.",
    price_per_unit: 32,
    unit: "kg",
    quantity_available: 400,
    min_order_quantity: 50,
    harvest_offset_days: -20,
    available_offset_days: 60,
    imageUrl: "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=800&auto=format&fit=crop&q=80",
  },

  // 4. Root Crops (3 items)
  {
    id: "a0000001-0000-0000-0000-000000000011",
    farmer_clerk_id: "demo_farmer_agusan_valley",
    category_slug: "root-crops",
    slug: "yellow-camote",
    name: "Yellow Sweet Camote (Sweet Potato)",
    description: "Golden-fleshed nutritious sweet potatoes freshly unearthed from sandy-loam soils. Naturally sweet and fiber-rich.",
    price_per_unit: 42,
    unit: "kg",
    quantity_available: 150,
    min_order_quantity: 10,
    harvest_offset_days: -2,
    available_offset_days: 20,
    imageUrl: "https://images.unsplash.com/photo-1590005354167-6da97870c757?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "a0000001-0000-0000-0000-000000000012",
    farmer_clerk_id: "demo_farmer_agusan_valley",
    category_slug: "root-crops",
    slug: "native-purple-ube",
    name: "Native Purple Ube (Tuber)",
    description: "Authentic deep purple yam roots prized for dessert pastes, halaya, and bakery applications. Highly sought-after seasonal harvest.",
    price_per_unit: 95,
    unit: "kg",
    quantity_available: 90,
    min_order_quantity: 10,
    harvest_offset_days: -3,
    available_offset_days: 14,
    imageUrl: "https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "a0000001-0000-0000-0000-000000000013",
    farmer_clerk_id: "demo_farmer_agusan_valley",
    category_slug: "root-crops",
    slug: "fresh-cassava",
    name: "Fresh Cassava (Kamoteng Kahoy)",
    description: "Thick, starchy edible cassava tubers harvested fresh upon order. Must be cooked before consumption.",
    price_per_unit: 30,
    unit: "kg",
    quantity_available: 200,
    min_order_quantity: 20,
    harvest_offset_days: -1,
    available_offset_days: 10,
    imageUrl: "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=800&auto=format&fit=crop&q=80",
  },

  // 5. Herbs & Spices (3 items)
  {
    id: "a0000001-0000-0000-0000-000000000014",
    farmer_clerk_id: "demo_farmer_golden_harvest",
    category_slug: "herbs-spices",
    slug: "red-native-shallots",
    name: "Red Native Shallots / Onions (Sibuyas)",
    description: "Pungent, dried local red shallots. High concentration of essential aromatics essential for authentic Filipino broths.",
    price_per_unit: 120,
    unit: "kg",
    quantity_available: 85,
    min_order_quantity: 5,
    harvest_offset_days: -5,
    available_offset_days: 45,
    imageUrl: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "a0000001-0000-0000-0000-000000000015",
    farmer_clerk_id: "demo_farmer_golden_harvest",
    category_slug: "herbs-spices",
    slug: "native-white-garlic",
    name: "Native White Garlic (Bawang)",
    description: "Small clove native garlic bulbs packed with intense aroma. Far more fragrant than imported supermarket varieties.",
    price_per_unit: 140,
    unit: "kg",
    quantity_available: 60,
    min_order_quantity: 5,
    harvest_offset_days: -7,
    available_offset_days: 60,
    imageUrl: "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "a0000001-0000-0000-0000-000000000016",
    farmer_clerk_id: "demo_farmer_golden_harvest",
    category_slug: "herbs-spices",
    slug: "fresh-yellow-ginger",
    name: "Fresh Yellow Ginger (Luya)",
    description: "Plump, spicy ginger rhizomes with minimal soil residue. Crisp snap and potent juice for broths, tea, and marinades.",
    price_per_unit: 85,
    unit: "kg",
    quantity_available: 75,
    min_order_quantity: 5,
    harvest_offset_days: -3,
    available_offset_days: 30,
    imageUrl: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=800&auto=format&fit=crop&q=80",
  },

  // 6. Poultry & Eggs (2 items)
  {
    id: "a0000001-0000-0000-0000-000000000017",
    farmer_clerk_id: "demo_farmer_riverbend",
    category_slug: "poultry-eggs",
    slug: "farm-fresh-brown-eggs",
    name: "Farm-Fresh Brown Eggs (Tray of 30)",
    description: "Cleanly candled, large brown eggs from pasture-raised hens. Rich golden yolks with thick whites.",
    price_per_unit: 210,
    unit: "tray",
    quantity_available: 80,
    min_order_quantity: 5,
    harvest_offset_days: 0,
    available_offset_days: 21,
    imageUrl: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "a0000001-0000-0000-0000-000000000018",
    farmer_clerk_id: "demo_farmer_riverbend",
    category_slug: "poultry-eggs",
    slug: "dressed-free-range-chicken",
    name: "Dressed Free-Range Whole Chicken",
    description: "Freshly dressed native chicken with head and feet on upon request. Lean, firm meat with rich natural chicken flavor.",
    price_per_unit: 220,
    unit: "kg",
    quantity_available: 65,
    min_order_quantity: 5,
    harvest_offset_days: 0,
    available_offset_days: 3,
    imageUrl: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=800&auto=format&fit=crop&q=80",
  },

  // 7. Fish & Seafood (2 items)
  {
    id: "a0000001-0000-0000-0000-000000000019",
    farmer_clerk_id: "demo_farmer_riverbend",
    category_slug: "fish-seafood",
    slug: "freshwater-tilapia",
    name: "Live Freshwater Tilapia",
    description: "Pond-harvested clean freshwater tilapia (3-4 pieces per kg). Sweet, firm white meat with zero muddy aftertaste.",
    price_per_unit: 130,
    unit: "kg",
    quantity_available: 110,
    min_order_quantity: 10,
    harvest_offset_days: 0,
    available_offset_days: 2,
    imageUrl: "https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "a0000001-0000-0000-0000-000000000020",
    farmer_clerk_id: "demo_farmer_riverbend",
    category_slug: "fish-seafood",
    slug: "fresh-dagupan-bangus",
    name: "Fresh Harvest Bangus (Milkfish)",
    description: "Premium belly milkfish fresh on ice. Perfect size for sinigang, daing, and rellenong bangus.",
    price_per_unit: 180,
    unit: "kg",
    quantity_available: 95,
    min_order_quantity: 10,
    harvest_offset_days: 0,
    available_offset_days: 3,
    imageUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80",
  },

  // 8. Other (1 item)
  {
    id: "a0000001-0000-0000-0000-000000000021",
    farmer_clerk_id: "demo_farmer_golden_harvest",
    category_slug: "other",
    slug: "pure-wild-honey",
    name: "Agusan Pure Wild Raw Honey (500ml Bottle)",
    description: "Unfiltered, unpasteurized forest honey gathered by indigenous honey hunters in Agusan mountain ranges. Distinct floral notes.",
    price_per_unit: 280,
    unit: "bottle",
    quantity_available: 45,
    min_order_quantity: 3,
    harvest_offset_days: -15,
    available_offset_days: 365,
    imageUrl: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80",
  },
];

// Helper to calculate date offsets
function getDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

async function uploadProductImage(
  farmerClerkId: string,
  slug: string,
  remoteUrl: string
): Promise<string | null> {
  const storagePath = `products/${farmerClerkId}/${slug}.jpg`;
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) {
      console.warn(`[storage] Could not download image for ${slug} (${res.status}). Skipping storage upload.`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error } = await supabase.storage
      .from("product-images")
      .upload(storagePath, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.warn(`[storage] Error uploading ${storagePath}:`, error.message);
      return null;
    }

    return storagePath;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[storage] Exception uploading ${slug}:`, msg);
    return null;
  }
}

async function seed() {
  console.log("🌱 Starting UMA Market demo data seed...");

  // 1. Fetch categories
  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("id, slug, name");

  if (catError || !categories) {
    throw new Error(`Failed to load categories: ${catError?.message}`);
  }

  const categoryMap = new Map<string, string>();
  for (const c of categories as CategoryRecord[]) {
    categoryMap.set(c.slug, c.id);
  }

  // 2. Upsert Profiles (Farmers + Buyers)
  console.log("👤 Upserting demo farmer profiles...");
  for (const farmer of DEMO_FARMERS) {
    const { error } = await supabase
      .from("profiles")
      .upsert(farmer, { onConflict: "clerk_id" });
    if (error) console.error(`Error upserting farmer ${farmer.clerk_id}:`, error.message);
  }

  console.log("🛒 Upserting demo buyer profiles...");
  for (const buyer of DEMO_BUYERS) {
    const { error } = await supabase
      .from("profiles")
      .upsert(buyer, { onConflict: "clerk_id" });
    if (error) console.error(`Error upserting buyer ${buyer.clerk_id}:`, error.message);
  }

  // 3. Upload Images & Upsert Products
  console.log("📦 Processing 21 demo products and storage photography...");
  for (const p of DEMO_PRODUCTS) {
    const categoryId = categoryMap.get(p.category_slug);
    if (!categoryId) {
      console.warn(`No category found for slug: ${p.category_slug}`);
      continue;
    }

    // Attempt upload to Supabase Storage
    const imagePath = await uploadProductImage(p.farmer_clerk_id, p.slug, p.imageUrl);

    const productPayload = {
      id: p.id,
      farmer_clerk_id: p.farmer_clerk_id,
      category_id: categoryId,
      name: p.name,
      description: p.description,
      price_per_unit: p.price_per_unit,
      unit: p.unit,
      quantity_available: p.quantity_available,
      min_order_quantity: p.min_order_quantity,
      image_url: p.imageUrl,
      image_path: imagePath,
      harvest_date: getDateOffset(p.harvest_offset_days),
      available_until: getDateOffset(p.available_offset_days),
      status: "active",
    };

    const { error } = await supabase
      .from("products")
      .upsert(productPayload, { onConflict: "id" });

    if (error) {
      console.error(`Error upserting product ${p.name}:`, error.message);
    } else {
      console.log(`  ✓ ${p.name} (₱${p.price_per_unit}/${p.unit}) -> ${imagePath ? 'Storage CDN' : 'External fallback'}`);
    }
  }

  // 4. Upsert 4 Demo Orders in Varied States
  console.log("📋 Upserting demo orders across varied fulfillment states...");

  const DEMO_ORDERS = [
    {
      id: "b0000001-0000-0000-0000-000000000001",
      business_clerk_id: "demo_buyer_sunrise_eatery",
      farmer_clerk_id: "demo_farmer_verdant_ridge",
      status: "pending",
      fulfillment_type: "seller_delivery",
      delivery_address: "Sunrise Eatery, J.C. Aquino Ave, Butuan City",
      total_amount: 1100.0,
      notes: "Please deliver before 9:00 AM if accepted. Morning prep service.",
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hours ago
      items: [
        {
          id: "c0000001-0000-0000-0000-000000000001",
          product_id: "a0000001-0000-0000-0000-000000000001", // Ampalaya
          product_name: "Highland Green Ampalaya (Bitter Gourd)",
          unit: "kg",
          quantity: 10,
          unit_price: 75.0,
          subtotal: 750.0,
        },
        {
          id: "c0000001-0000-0000-0000-000000000002",
          product_id: "a0000001-0000-0000-0000-000000000004", // Sitaw
          product_name: "Pole Sitaw (Long Green String Beans)",
          unit: "kg",
          quantity: 6.36,
          unit_price: 55.0,
          subtotal: 350.0,
        },
      ],
    },
    {
      id: "b0000001-0000-0000-0000-000000000002",
      business_clerk_id: "demo_buyer_caraga_caterers",
      farmer_clerk_id: "demo_farmer_riverbend",
      status: "preparing",
      fulfillment_type: "pickup",
      pickup_date: getDateOffset(1),
      accepted_at: new Date(Date.now() - 3600000 * 8).toISOString(),
      total_amount: 2350.0,
      notes: "Pick-up via commissary refrigerated van at farm gate station.",
      created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      items: [
        {
          id: "c0000001-0000-0000-0000-000000000003",
          product_id: "a0000001-0000-0000-0000-000000000017", // Eggs
          product_name: "Farm-Fresh Brown Eggs (Tray of 30)",
          unit: "tray",
          quantity: 5,
          unit_price: 210.0,
          subtotal: 1050.0,
        },
        {
          id: "c0000001-0000-0000-0000-000000000004",
          product_id: "a0000001-0000-0000-0000-000000000019", // Tilapia
          product_name: "Live Freshwater Tilapia",
          unit: "kg",
          quantity: 10,
          unit_price: 130.0,
          subtotal: 1300.0,
        },
      ],
    },
    {
      id: "b0000001-0000-0000-0000-000000000003",
      business_clerk_id: "demo_buyer_sunrise_eatery",
      farmer_clerk_id: "demo_farmer_agusan_valley",
      status: "completed",
      fulfillment_type: "seller_delivery",
      delivery_address: "Sunrise Eatery, J.C. Aquino Ave, Butuan City",
      accepted_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      completed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      total_amount: 3700.0,
      notes: "Wholesale grain consignment completed and received.",
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      items: [
        {
          id: "c0000001-0000-0000-0000-000000000005",
          product_id: "a0000001-0000-0000-0000-000000000008", // Dinorado Rice
          product_name: "Dinorado Fragrant Rice (25kg Sack)",
          unit: "sack",
          quantity: 2,
          unit_price: 1250.0,
          subtotal: 2500.0,
        },
        {
          id: "c0000001-0000-0000-0000-000000000006",
          product_id: "a0000001-0000-0000-0000-000000000009", // Sinandomeng
          product_name: "Sinandomeng Polished White Rice",
          unit: "kg",
          quantity: 25,
          unit_price: 48.0,
          subtotal: 1200.0,
        },
      ],
    },
    {
      id: "b0000001-0000-0000-0000-000000000004",
      business_clerk_id: "demo_buyer_caraga_caterers",
      farmer_clerk_id: "demo_farmer_golden_harvest",
      status: "cancelled",
      fulfillment_type: "pickup",
      cancelled_at: new Date(Date.now() - 86400000).toISOString(),
      cancellation_reason: "Buyer requested cancellation",
      total_amount: 1950.0,
      notes: "Cancelled prior to packing due to banquet postponement.",
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      items: [
        {
          id: "c0000001-0000-0000-0000-000000000007",
          product_id: "a0000001-0000-0000-0000-000000000005", // Mangoes
          product_name: "Carabao Sweet Mangoes (Grade A)",
          unit: "kg",
          quantity: 15,
          unit_price: 130.0,
          subtotal: 1950.0,
        },
      ],
    },
  ];

  for (const order of DEMO_ORDERS) {
    const { items, ...orderRecord } = order;

    const { error: oErr } = await supabase
      .from("orders")
      .upsert(orderRecord, { onConflict: "id" });

    if (oErr) {
      console.error(`Error upserting order ${order.id}:`, oErr.message);
      continue;
    }

    for (const item of items) {
      const itemRecord = {
        id: item.id,
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
      };
      const { error: iErr } = await supabase
        .from("order_items")
        .upsert(itemRecord, { onConflict: "id" });
      if (iErr) {
        console.error(`Error upserting order item ${item.product_name}:`, iErr.message);
      }
    }
    console.log(`  ✓ Order #${order.id.slice(0, 8).toUpperCase()} (${order.status}) — ₱${order.total_amount}`);
  }

  console.log("\n✨ Demo data seeding finished successfully!");
}

seed().catch((err) => {
  console.error("Fatal error running seed:", err);
  process.exit(1);
});
