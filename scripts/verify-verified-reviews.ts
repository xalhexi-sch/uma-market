// =============================================================================
// UMA Market — Verified Reviews & Reputation V1 Verification Suite
//
// Runs only against the dedicated security-test Supabase project. It uses real
// Clerk development sessions for RLS assertions and cleans every fixture in
// finally{}. No secrets or tokens are printed.
// =============================================================================

import { createClerkClient } from "@clerk/backend";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.security-test.local") });

const SECURITY_TEST_REF = "xckdihprwjdwutglytwu";
const PROD_REF = "odnpkqjytrmciwmcehff";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const clerkSecretKey = process.env.CLERK_SECRET_KEY ?? "";
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

if (!supabaseUrl || !supabaseUrl.includes(SECURITY_TEST_REF) || supabaseUrl.includes(PROD_REF)) {
  console.error(`FATAL: Must only target security-test project ${SECURITY_TEST_REF}.`);
  process.exit(2);
}
if (!anonKey || !secretKey || !clerkSecretKey || !clerkPublishableKey) {
  console.error("FATAL: Missing required security-test Supabase or Clerk variables.");
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: clerkSecretKey, publishableKey: clerkPublishableKey });
const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

const BUYER_A = "user_3JhPbugktYsiMOGIDxF40YwRzx7";
const BUYER_B = "user_3JhUSSDpL2bmzswoMoNM6RzDkyn";
const FARMER_A = "user_3JhPbDuVSiPLuEA6Z8oo86c4Jmr";
const FARMER_B = "user_3JhUSQewYXAYXR80cEFQNwGvsZs";
const PREFIX = "f1000001-0000-0000-0000-";
const IDS = {
  completedOrder: `${PREFIX}000000000001`,
  pendingOrder: `${PREFIX}000000000002`,
  cancelledOrder: `${PREFIX}000000000003`,
  unrelatedOrder: `${PREFIX}000000000004`,
  forgedOrder: `${PREFIX}000000000005`,
  productA: `${PREFIX}000000000101`,
  productB: `${PREFIX}000000000102`,
  checkoutProduct: `${PREFIX}000000000103`,
  completedItem: `${PREFIX}000000000201`,
  unrelatedItem: `${PREFIX}000000000202`,
};

const sessions: string[] = [];
let passed = 0;
let failed = 0;
let checkoutOrderId: string | null = null;

function assert(id: string, description: string, condition: boolean, details = "") {
  if (condition) passed++;
  else failed++;
  console.log(`${condition ? "PASS" : "FAIL"} [${id}] ${description}${details ? ` — ${details}` : ""}`);
}

async function authenticatedClient(userId: string): Promise<SupabaseClient> {
  const session = await clerk.sessions.createSession({ userId });
  sessions.push(session.id);
  const token = await clerk.sessions.getToken(session.id);
  return createClient(supabaseUrl, anonKey, {
    accessToken: async () => token.jwt,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function cleanup() {
  const orderIds = [IDS.completedOrder, IDS.pendingOrder, IDS.cancelledOrder, IDS.unrelatedOrder, IDS.forgedOrder, checkoutOrderId].filter(
    (id): id is string => Boolean(id),
  );
  const sellerDelete = await admin.from("seller_reviews").delete().in("order_id", orderIds);
  if (sellerDelete.error) throw new Error(`Cleanup seller reviews failed: ${sellerDelete.error.message}`);
  const productDelete = await admin.from("product_reviews").delete().in("order_id", orderIds);
  if (productDelete.error) throw new Error(`Cleanup product reviews failed: ${productDelete.error.message}`);
  const orderDelete = await admin.from("orders").delete().in("id", orderIds);
  if (orderDelete.error) throw new Error(`Cleanup orders failed: ${orderDelete.error.message}`);
  const productDeleteResult = await admin.from("products").delete().in("id", [IDS.productA, IDS.productB]);
  if (productDeleteResult.error) throw new Error(`Cleanup products failed: ${productDeleteResult.error.message}`);
  const checkoutCartDelete = await admin.from("cart_items").delete()
    .eq("business_clerk_id", BUYER_A).eq("product_id", IDS.checkoutProduct);
  if (checkoutCartDelete.error) throw new Error(`Cleanup checkout cart failed: ${checkoutCartDelete.error.message}`);
  const checkoutProductDelete = await admin.from("products").delete().eq("id", IDS.checkoutProduct);
  if (checkoutProductDelete.error) throw new Error(`Cleanup checkout product failed: ${checkoutProductDelete.error.message}`);
  const { data: remainingProducts, error: remainingProductsError } = await admin
    .from("products").select("id").in("id", [IDS.productA, IDS.productB, IDS.checkoutProduct]);
  if (remainingProductsError) throw new Error(`Cleanup product verification failed: ${remainingProductsError.message}`);
  if ((remainingProducts ?? []).length > 0) throw new Error("Cleanup left review checkout products behind.");
  const { data: remainingCart, error: remainingCartError } = await admin
    .from("cart_items").select("id").eq("business_clerk_id", BUYER_A).eq("product_id", IDS.checkoutProduct);
  if (remainingCartError) throw new Error(`Cleanup cart verification failed: ${remainingCartError.message}`);
  if ((remainingCart ?? []).length > 0) throw new Error("Cleanup left checkout cart fixtures behind.");
  const { data: remainingOrders, error: remainingOrdersError } = await admin
    .from("orders").select("id").in("id", orderIds);
  if (remainingOrdersError) throw new Error(`Cleanup verification failed: ${remainingOrdersError.message}`);
  if ((remainingOrders ?? []).length > 0) throw new Error("Cleanup left review fixture orders behind.");
  for (const sessionId of sessions) {
    await clerk.sessions.revokeSession(sessionId);
  }
  sessions.length = 0;
}

async function run() {
  try {
    await cleanup();

    const { data: category } = await admin.from("categories").select("id").eq("slug", "vegetables").single();
    if (!category) throw new Error("Vegetables category fixture is missing.");

    const productsInsert = await admin.from("products").insert([
      { id: IDS.productA, farmer_clerk_id: FARMER_A, category_id: category.id, name: "Review Fixture A", price_per_unit: 10, unit: "kg", quantity_available: 100, min_order_quantity: 1, status: "active" },
      { id: IDS.productB, farmer_clerk_id: FARMER_B, category_id: category.id, name: "Review Fixture B", price_per_unit: 12, unit: "kg", quantity_available: 100, min_order_quantity: 1, status: "active" },
      { id: IDS.checkoutProduct, farmer_clerk_id: FARMER_A, category_id: category.id, name: "Checkout Fixture", price_per_unit: 9, unit: "kg", quantity_available: 7, min_order_quantity: 1, status: "active" },
    ]);
    if (productsInsert.error) throw new Error(`Product fixture setup failed: ${productsInsert.error.message}`);

    const ordersInsert = await admin.from("orders").insert([
      { id: IDS.completedOrder, business_clerk_id: BUYER_A, farmer_clerk_id: FARMER_A, status: "completed", fulfillment_type: "pickup", total_amount: 10 },
      { id: IDS.pendingOrder, business_clerk_id: BUYER_A, farmer_clerk_id: FARMER_A, status: "pending", fulfillment_type: "pickup", total_amount: 10 },
      { id: IDS.cancelledOrder, business_clerk_id: BUYER_A, farmer_clerk_id: FARMER_A, status: "cancelled", fulfillment_type: "pickup", total_amount: 10 },
      { id: IDS.unrelatedOrder, business_clerk_id: BUYER_B, farmer_clerk_id: FARMER_B, status: "completed", fulfillment_type: "pickup", total_amount: 12 },
    ]);
    if (ordersInsert.error) throw new Error(`Order fixture setup failed: ${ordersInsert.error.message}`);
    const itemsInsert = await admin.from("order_items").insert([
      { id: IDS.completedItem, order_id: IDS.completedOrder, product_id: IDS.productA, quantity: 1, unit_price: 10, product_name: "Review Fixture A", unit: "kg" },
      { id: IDS.unrelatedItem, order_id: IDS.unrelatedOrder, product_id: IDS.productB, quantity: 1, unit_price: 12, product_name: "Review Fixture B", unit: "kg" },
    ]);
    if (itemsInsert.error) throw new Error(`Order-item fixture setup failed: ${itemsInsert.error.message}`);

    const buyerA = await authenticatedClient(BUYER_A);
    const buyerB = await authenticatedClient(BUYER_B);
    const farmerA = await authenticatedClient(FARMER_A);

    // 1–2. Happy paths.
    const sellerInsert = await buyerA.from("seller_reviews").insert({
      order_id: IDS.completedOrder, reviewer_clerk_id: BUYER_A, target_farmer_clerk_id: FARMER_A, rating: 5, comment: "Reliable fixture seller",
    }).select("id").single();
    assert("REV-01", "completed buyer creates seller review", !sellerInsert.error, sellerInsert.error?.message);

    const productInsert = await buyerA.from("product_reviews").insert({
      order_id: IDS.completedOrder, order_item_id: IDS.completedItem, reviewer_clerk_id: BUYER_A, product_id: IDS.productA, rating: 4, comment: "Fresh fixture produce",
    });
    assert("REV-02", "completed buyer creates product review", !productInsert.error, productInsert.error?.message);

    // 3–4. State restrictions.
    const pending = await buyerA.from("seller_reviews").insert({ order_id: IDS.pendingOrder, reviewer_clerk_id: BUYER_A, target_farmer_clerk_id: FARMER_A, rating: 5 });
    assert("REV-03", "pending order cannot be reviewed", Boolean(pending.error));
    const cancelled = await buyerA.from("seller_reviews").insert({ order_id: IDS.cancelledOrder, reviewer_clerk_id: BUYER_A, target_farmer_clerk_id: FARMER_A, rating: 5 });
    assert("REV-04", "cancelled order cannot be reviewed", Boolean(cancelled.error));

    // 5–7. Tenant and relationship restrictions.
    const unrelated = await buyerB.from("seller_reviews").insert({ order_id: IDS.completedOrder, reviewer_clerk_id: BUYER_B, target_farmer_clerk_id: FARMER_A, rating: 5 });
    assert("REV-05", "unrelated buyer cannot review another buyer order", Boolean(unrelated.error));
    const wrongProduct = await buyerA.from("product_reviews").insert({ order_id: IDS.completedOrder, order_item_id: IDS.completedItem, reviewer_clerk_id: BUYER_A, product_id: IDS.productB, rating: 5 });
    assert("REV-06", "buyer cannot review product absent from order item", Boolean(wrongProduct.error));
    const wrongFarmer = await buyerA.from("seller_reviews").insert({ order_id: IDS.completedOrder, reviewer_clerk_id: BUYER_A, target_farmer_clerk_id: FARMER_B, rating: 5 });
    assert("REV-07", "buyer cannot review unrelated farmer", Boolean(wrongFarmer.error));

    // 8–10. Database constraints.
    const duplicateSeller = await buyerA.from("seller_reviews").insert({ order_id: IDS.completedOrder, reviewer_clerk_id: BUYER_A, target_farmer_clerk_id: FARMER_A, rating: 4 });
    assert("REV-08", "duplicate seller review is rejected", Boolean(duplicateSeller.error));
    const duplicateProduct = await buyerA.from("product_reviews").insert({ order_id: IDS.completedOrder, order_item_id: IDS.completedItem, reviewer_clerk_id: BUYER_A, product_id: IDS.productA, rating: 3 });
    assert("REV-09", "duplicate product review is rejected", Boolean(duplicateProduct.error));
    const invalidRating = await buyerA.from("seller_reviews").insert({ order_id: IDS.completedOrder, reviewer_clerk_id: BUYER_A, target_farmer_clerk_id: FARMER_A, rating: 6 });
    assert("REV-10", "rating outside 1–5 is rejected", Boolean(invalidRating.error));

    // 11. Unauthenticated write.
    const unauthenticated = await anon.from("seller_reviews").insert({ order_id: IDS.completedOrder, reviewer_clerk_id: BUYER_A, target_farmer_clerk_id: FARMER_A, rating: 5 });
    assert("REV-11", "unauthenticated review write is rejected", Boolean(unauthenticated.error));

    // 12–15. Public verified reads, aggregates, and no leakage.
    const { data: publicSeller } = await anon.from("seller_reviews").select("id, rating, comment, created_at").eq("order_id", IDS.completedOrder);
    const { data: publicProduct } = await anon.from("product_reviews").select("id, rating, comment, created_at").eq("product_id", IDS.productA);
    const { data: sellerSummary } = await anon.rpc("get_seller_review_summary", { p_farmer_clerk_id: FARMER_A });
    const { data: productSummary } = await anon.rpc("get_product_review_summary", { p_product_id: IDS.productA });
    assert("REV-12", "verified seller review reads publicly", publicSeller?.length === 1 && publicSeller[0].rating === 5);
    assert("REV-13", "seller aggregate rating/count is correct", sellerSummary?.average_rating === 5 && Number(sellerSummary?.review_count) === 1);
    assert("REV-14", "product aggregate rating/count is correct", productSummary?.average_rating === 4 && Number(productSummary?.review_count) === 1 && publicProduct?.length === 1);
    const { data: leaked } = await anon.from("seller_reviews").select("id").eq("order_id", IDS.pendingOrder);
    assert("REV-15", "unrelated or non-completed review data does not leak", (leaked ?? []).length === 0);

    // 16–22. Final authorization and input-hardening checks.
    const forged = await buyerA.from("orders").insert({
      id: IDS.forgedOrder, business_clerk_id: BUYER_A, farmer_clerk_id: FARMER_A,
      status: "completed", fulfillment_type: "pickup", total_amount: 10,
    });
    assert("REV-16", "ordinary client cannot create a forged completed order", Boolean(forged.error));

    const otherUpdate = await buyerB.from("seller_reviews").update({ rating: 1 })
      .eq("id", sellerInsert.data?.id).select("id").maybeSingle();
    assert("REV-17", "reviewer cannot update someone else's review", Boolean(otherUpdate.error) || otherUpdate.data === null);
    const otherDelete = await buyerB.from("seller_reviews").delete()
      .eq("id", sellerInsert.data?.id).select("id");
    assert("REV-18", "reviewer cannot delete someone else's review", Boolean(otherDelete.error) || (otherDelete.data ?? []).length === 0);

    const farmerWrite = await farmerA.from("seller_reviews").insert({
      order_id: IDS.completedOrder, reviewer_clerk_id: FARMER_A, target_farmer_clerk_id: FARMER_A, rating: 5,
    });
    assert("REV-19", "direct farmer-role review write is rejected", Boolean(farmerWrite.error));

    const selfReview = await farmerA.from("seller_reviews").insert({
      order_id: IDS.completedOrder, reviewer_clerk_id: FARMER_A, target_farmer_clerk_id: FARMER_A, rating: 5,
    });
    assert("REV-20", "seller self-review is rejected", Boolean(selfReview.error));

    const longComment = await buyerA.from("seller_reviews").insert({
      order_id: IDS.unrelatedOrder, reviewer_clerk_id: BUYER_A, target_farmer_clerk_id: FARMER_B,
      rating: 5, comment: "x".repeat(1001),
    });
    assert("REV-21", "comment over 1000 characters is rejected", Boolean(longComment.error));

    const malformed = await buyerA.from("seller_reviews").insert({
      order_id: IDS.completedOrder, reviewer_clerk_id: BUYER_A, target_farmer_clerk_id: FARMER_A,
      rating: null as never,
    });
    assert("REV-22", "malformed review input is rejected", Boolean(malformed.error));

    // 23. Legitimate checkout path remains usable after the direct-order hardening.
    const { data: businessProfile, error: businessProfileError } = await admin
      .from("profiles").select("role, status").eq("clerk_id", BUYER_A).single();
    const { data: farmerProfile, error: farmerProfileError } = await admin
      .from("profiles").select("role, status").eq("clerk_id", FARMER_A).single();
    if (businessProfileError || farmerProfileError) {
      throw new Error(`Checkout profile fixture verification failed: ${businessProfileError?.message ?? farmerProfileError?.message}`);
    }
    if (businessProfile.role !== "business" || businessProfile.status !== "active"
      || farmerProfile.role !== "farmer" || farmerProfile.status !== "active") {
      throw new Error("Checkout fixture profiles are not active business/farmer accounts.");
    }

    const cartInsert = await buyerA.from("cart_items").insert({
      business_clerk_id: BUYER_A, product_id: IDS.checkoutProduct, quantity: 2,
    });
    if (cartInsert.error) throw new Error(`Checkout cart fixture setup failed: ${cartInsert.error.message}`);

    const checkout = await buyerA.rpc("place_checkout_orders", {
      p_orders: [{
        farmer_clerk_id: FARMER_A,
        fulfillment_type: "seller_delivery",
        delivery_address: "Checkout fixture address",
        notes: "Checkout fixture",
        pickup_date: null,
        items: [{ product_id: IDS.checkoutProduct, quantity: 2 }],
      }],
    });
    checkoutOrderId = (checkout.data as { order_ids?: string[] } | null)?.order_ids?.[0] ?? null;

    let checkoutValid = !checkout.error && Boolean(checkoutOrderId);
    let checkoutDetails = checkout.error?.message ?? "";
    if (checkoutValid && checkoutOrderId) {
      const { data: order, error: orderError } = await admin.from("orders")
        .select("id, business_clerk_id, farmer_clerk_id, status, total_amount")
        .eq("id", checkoutOrderId).single();
      const { data: orderItems, error: orderItemsError } = await admin.from("order_items")
        .select("order_id, product_id, quantity, unit_price")
        .eq("order_id", checkoutOrderId);
      const { data: product, error: productError } = await admin.from("products")
        .select("quantity_available").eq("id", IDS.checkoutProduct).single();
      const { data: remainingCart, error: cartError } = await admin.from("cart_items")
        .select("id").eq("business_clerk_id", BUYER_A).eq("product_id", IDS.checkoutProduct);
      checkoutValid = Boolean(
        !orderError && !orderItemsError && !productError && !cartError
        && order?.status === "pending"
        && order.business_clerk_id === BUYER_A
        && order.farmer_clerk_id === FARMER_A
        && Number(order.total_amount) === 18
        && orderItems?.length === 1
        && orderItems[0].order_id === checkoutOrderId
        && orderItems[0].product_id === IDS.checkoutProduct
        && Number(orderItems[0].quantity) === 2
        && Number(orderItems[0].unit_price) === 9
        && product?.quantity_available === 5
        && (remainingCart ?? []).length === 0
      );
      checkoutDetails = orderError?.message ?? orderItemsError?.message ?? productError?.message ?? cartError?.message ?? "";
    }
    assert("REV-23", "legitimate checkout RPC still creates a valid order", checkoutValid, checkoutDetails);
  } finally {
    await cleanup();
  }

  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error("FATAL: review verification failed.", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
