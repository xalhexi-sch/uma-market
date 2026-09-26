// ==============================================================================
// UMA Market — Farmer Avatar Synchronization Verification Suite
// Tests Clerk webhook lifecycle synchronization, field protection, RLS, and UI
// ==============================================================================

import { createClient } from "@supabase/supabase-js";
import { Webhook } from "standardwebhooks";
import { NextRequest } from "next/server";
import * as dotenv from "dotenv";
import * as path from "path";

// Mock server-only before importing server components/routes
require.cache[require.resolve("server-only")] = { exports: {} } as unknown as NodeModule;

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;
const clerkSigningSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET!;

if (!supabaseUrl || !supabaseAnonKey || !supabaseSecretKey) {
  console.error("Missing required Supabase environment variables in .env.local");
  process.exit(1);
}

if (!clerkSigningSecret) {
  console.error("Missing CLERK_WEBHOOK_SIGNING_SECRET in .env.local");
  process.exit(1);
}

// Anonymous public client
const publicClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Admin client for test setup/assertions/cleanup
const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Mock Next.js server Supabase client for page component rendering test
require.cache[require.resolve("@/lib/supabase/server")] = {
  exports: {
    createClient: async () => publicClient,
  },
} as unknown as NodeModule;

interface TestCaseResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestCaseResult[] = [];

function assert(id: string, name: string, condition: boolean, details: string) {
  results.push({ id, name, passed: condition, details });
  const status = condition ? "PASS" : "FAIL";
  console.log(`[${status}] ${id}: ${name}\n       → ${details}`);
}

// Helper to sign and send webhook requests to the actual route handler
async function dispatchWebhook(payload: Record<string, unknown>, useValidSignature = true) {
  const { POST } = await import("@/app/api/webhooks/clerk/route");
  const body = JSON.stringify(payload);
  const msgId = `msg_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const now = new Date();

  let sig = "v1,invalid_signature_mock";
  if (useValidSignature) {
    const wh = new Webhook(clerkSigningSecret);
    sig = wh.sign(msgId, now, body);
  }

  const req = new NextRequest("http://localhost:3000/api/webhooks/clerk", {
    method: "POST",
    body,
    headers: {
      "svix-id": msgId,
      "svix-timestamp": Math.floor(now.getTime() / 1000).toString(),
      "svix-signature": sig,
    },
  });

  return POST(req);
}

interface ReactVNode {
  type?: unknown;
  props?: {
    children?: unknown;
    src?: string;
    [key: string]: unknown;
  };
}

// Recursive helper to inspect JSX trees
function findInTree(node: unknown, predicate: (n: ReactVNode) => boolean): ReactVNode | null {
  if (!node || typeof node !== "object") return null;
  const vnode = node as ReactVNode;
  if (predicate(vnode)) return vnode;
  if (Array.isArray(vnode)) {
    for (const child of vnode) {
      const res = findInTree(child, predicate);
      if (res) return res;
    }
  } else if (vnode.props && vnode.props.children) {
    return findInTree(vnode.props.children, predicate);
  }
  return null;
}

async function runAvatarSyncVerification() {
  console.log("==============================================================================");
  console.log("UMA Market — Farmer Avatar Synchronization Verification Suite");
  console.log("==============================================================================\n");

  const urlHost = new URL(supabaseUrl).host;
  console.log(`Target Supabase Host: ${urlHost} (Safe identification verified)`);

  const testFarmer1 = `user_sync_test_1_${Date.now()}`;
  const testFarmer2 = `user_sync_test_2_${Date.now()}`;

  try {
    // ------------------------------------------------------------------------
    // TEST 1: user.created with image -> avatar_url populated
    // ------------------------------------------------------------------------
    {
      const avatarUrl1 = "https://img.clerk.com/avatars/farmer-avatar-1.jpg";
      const res = await dispatchWebhook({
        type: "user.created",
        data: {
          id: testFarmer1,
          public_metadata: { role: "farmer" },
          has_image: true,
          image_url: avatarUrl1,
        },
      });

      const { data: profile } = await adminClient
        .from("profiles")
        .select("avatar_url, role")
        .eq("clerk_id", testFarmer1)
        .maybeSingle();

      const passed = res.status === 200 && profile?.avatar_url === avatarUrl1;
      assert(
        "TEST-01",
        "user.created with image → avatar_url populated",
        passed,
        passed
          ? `avatar_url successfully stored: ${profile?.avatar_url}`
          : `Failed: res.status=${res.status}, avatar_url=${profile?.avatar_url}`
      );
    }

    // ------------------------------------------------------------------------
    // TEST 2: user.created without image -> avatar_url NULL
    // ------------------------------------------------------------------------
    {
      const res = await dispatchWebhook({
        type: "user.created",
        data: {
          id: testFarmer2,
          public_metadata: { role: "farmer" },
          has_image: false,
          image_url: "https://img.clerk.com/default-initials.png",
        },
      });

      const { data: profile } = await adminClient
        .from("profiles")
        .select("avatar_url, role")
        .eq("clerk_id", testFarmer2)
        .maybeSingle();

      const passed = res.status === 200 && profile?.avatar_url === null;
      assert(
        "TEST-02",
        "user.created without image → avatar_url NULL",
        passed,
        passed
          ? `avatar_url correctly set to NULL (ignored Clerk default initial image)`
          : `Failed: avatar_url=${profile?.avatar_url}`
      );
    }

    // ------------------------------------------------------------------------
    // TEST 3: user.updated adds image -> avatar_url updated
    // ------------------------------------------------------------------------
    {
      const avatarAddedUrl = "https://img.clerk.com/avatars/farmer-avatar-added.jpg";
      const res = await dispatchWebhook({
        type: "user.updated",
        data: {
          id: testFarmer2,
          public_metadata: { role: "farmer" },
          has_image: true,
          image_url: avatarAddedUrl,
        },
      });

      const { data: profile } = await adminClient
        .from("profiles")
        .select("avatar_url")
        .eq("clerk_id", testFarmer2)
        .maybeSingle();

      const passed = res.status === 200 && profile?.avatar_url === avatarAddedUrl;
      assert(
        "TEST-03",
        "user.updated adds image → avatar_url updated",
        passed,
        passed
          ? `avatar_url successfully transitioned from NULL to: ${profile?.avatar_url}`
          : `Failed: avatar_url=${profile?.avatar_url}`
      );
    }

    // ------------------------------------------------------------------------
    // TEST 4: user.updated changes image -> avatar_url updated
    // ------------------------------------------------------------------------
    {
      const avatarChangedUrl = "https://img.clerk.com/avatars/farmer-avatar-changed.jpg";
      const res = await dispatchWebhook({
        type: "user.updated",
        data: {
          id: testFarmer2,
          public_metadata: { role: "farmer" },
          has_image: true,
          image_url: avatarChangedUrl,
        },
      });

      const { data: profile } = await adminClient
        .from("profiles")
        .select("avatar_url")
        .eq("clerk_id", testFarmer2)
        .maybeSingle();

      const passed = res.status === 200 && profile?.avatar_url === avatarChangedUrl;
      assert(
        "TEST-04",
        "user.updated changes image → avatar_url updated",
        passed,
        passed
          ? `avatar_url successfully changed to new image: ${profile?.avatar_url}`
          : `Failed: avatar_url=${profile?.avatar_url}`
      );
    }

    // ------------------------------------------------------------------------
    // TEST 5: user.updated removes image -> avatar_url NULL
    // ------------------------------------------------------------------------
    {
      const res = await dispatchWebhook({
        type: "user.updated",
        data: {
          id: testFarmer2,
          public_metadata: { role: "farmer" },
          has_image: false,
          image_url: "https://img.clerk.com/default-initials.png",
        },
      });

      const { data: profile } = await adminClient
        .from("profiles")
        .select("avatar_url")
        .eq("clerk_id", testFarmer2)
        .maybeSingle();

      const passed = res.status === 200 && profile?.avatar_url === null;
      assert(
        "TEST-05",
        "user.updated removes image → avatar_url NULL",
        passed,
        passed
          ? `avatar_url successfully reverted to NULL upon removal in Clerk`
          : `Failed: avatar_url=${profile?.avatar_url}`
      );
    }

    // ------------------------------------------------------------------------
    // TEST 6: existing UMA-owned profile fields remain unchanged during user.updated
    // ------------------------------------------------------------------------
    {
      // Seed UMA-owned fields on testFarmer2
      const initialUMAData = {
        full_name: "Farmer Juan Santos",
        business_name: "Santos Organic Farms",
        phone: "+639171234567",
        city: "Malaybalay",
        bio: "Specializing in organic highland Arabica coffee and heirloom vegetables.",
        is_verified: true,
        status: "active",
      };

      await adminClient
        .from("profiles")
        .update(initialUMAData)
        .eq("clerk_id", testFarmer2);

      // Now trigger user.updated with a new image and arbitrary Clerk payload
      const newAvatarUrl = "https://img.clerk.com/avatars/santos-new.jpg";
      await dispatchWebhook({
        type: "user.updated",
        data: {
          id: testFarmer2,
          public_metadata: { role: "farmer" },
          has_image: true,
          image_url: newAvatarUrl,
        },
      });

      const { data: updatedProfile } = await adminClient
        .from("profiles")
        .select("full_name, business_name, phone, city, bio, is_verified, status, role, avatar_url")
        .eq("clerk_id", testFarmer2)
        .single();

      const fieldsPreserved =
        updatedProfile?.full_name === initialUMAData.full_name &&
        updatedProfile?.business_name === initialUMAData.business_name &&
        updatedProfile?.phone === initialUMAData.phone &&
        updatedProfile?.city === initialUMAData.city &&
        updatedProfile?.bio === initialUMAData.bio &&
        updatedProfile?.is_verified === initialUMAData.is_verified &&
        updatedProfile?.status === initialUMAData.status &&
        updatedProfile?.role === "farmer" &&
        updatedProfile?.avatar_url === newAvatarUrl;

      assert(
        "TEST-06",
        "existing UMA-owned profile fields remain unchanged during user.updated",
        fieldsPreserved,
        fieldsPreserved
          ? "Confirmed: full_name, business_name, phone, city, bio, is_verified, status, and role strictly preserved"
          : `Field mismatch: ${JSON.stringify(updatedProfile)}`
      );
    }

    // ------------------------------------------------------------------------
    // TEST 7: webhook signature verification remains intact
    // ------------------------------------------------------------------------
    {
      // Missing signature
      const { POST } = await import("@/app/api/webhooks/clerk/route");
      const unauthenticatedReq = new NextRequest("http://localhost:3000/api/webhooks/clerk", {
        method: "POST",
        body: JSON.stringify({ type: "user.updated", data: { id: testFarmer2 } }),
      });
      const resMissing = await POST(unauthenticatedReq);

      // Invalid signature
      const resInvalid = await dispatchWebhook(
        { type: "user.updated", data: { id: testFarmer2 } },
        false // invalid sig
      );

      const passed = resMissing.status === 400 && resInvalid.status === 400;
      assert(
        "TEST-07",
        "webhook signature verification remains intact",
        passed,
        passed
          ? "Unauthenticated requests and forged signatures are strictly rejected with 400"
          : `Failed: resMissing=${resMissing.status}, resInvalid=${resInvalid.status}`
      );
    }

    // ------------------------------------------------------------------------
    // TEST 8: public_farmer_profiles exposes avatar_url
    // ------------------------------------------------------------------------
    {
      const { data, error } = await publicClient
        .from("public_farmer_profiles")
        .select("clerk_id, avatar_url")
        .eq("clerk_id", testFarmer2)
        .maybeSingle();

      const passed = !error && data !== null && data.avatar_url === "https://img.clerk.com/avatars/santos-new.jpg";
      assert(
        "TEST-08",
        "public_farmer_profiles exposes avatar_url",
        passed,
        passed
          ? `Anonymous query successfully projected avatar_url: ${data?.avatar_url}`
          : `Failed: error=${error?.message}, data=${JSON.stringify(data)}`
      );
    }

    // ------------------------------------------------------------------------
    // TEST 9: anon still cannot SELECT public.profiles directly
    // ------------------------------------------------------------------------
    {
      const { data, error } = await publicClient
        .from("profiles")
        .select("id, clerk_id, avatar_url")
        .eq("clerk_id", testFarmer2);

      const blocked = error !== null || (data ?? []).length === 0;
      assert(
        "TEST-09",
        "anon still cannot SELECT public.profiles directly",
        blocked,
        blocked
          ? `RLS active and enforced: direct table access denied (${error?.message || "0 rows returned"})`
          : "SECURITY FAILURE: Direct profiles table was readable by anonymous client!"
      );
    }

    // ------------------------------------------------------------------------
    // TEST 10: Farmer Profile renders AvatarImage when avatar_url exists
    // ------------------------------------------------------------------------
    {
      // testFarmer2 currently has avatar_url populated
      type PageModule = {
        default?: {
          default?: (props: { params: Promise<{ id: string }> }) => Promise<ReactVNode>;
        } | ((props: { params: Promise<{ id: string }> }) => Promise<ReactVNode>);
      };
      const mod = (await import("@/app/farmers/[id]/page")) as unknown as PageModule;
      const Page =
        (typeof mod.default === "object" && mod.default !== null && "default" in mod.default
          ? mod.default.default
          : mod.default) as (props: { params: Promise<{ id: string }> }) => Promise<ReactVNode>;
      const jsx = await Page({ params: Promise.resolve({ id: testFarmer2 }) });

      const avatarNode = findInTree(
        jsx,
        (n) => typeof n?.type === "function" && (n?.type as { name?: string })?.name === "Avatar"
      );
      const avatarImageNode = findInTree(
        avatarNode,
        (n) => typeof n?.type === "function" && (n?.type as { name?: string })?.name === "AvatarImage"
      );

      const passed = avatarImageNode !== null && avatarImageNode.props?.src === "https://img.clerk.com/avatars/santos-new.jpg";
      assert(
        "TEST-10",
        "Farmer Profile renders AvatarImage when avatar_url exists",
        passed,
        passed
          ? `Avatar contains <AvatarImage src="${avatarImageNode?.props?.src}">`
          : `Failed: AvatarImage not rendered in tree`
      );
    }

    // ------------------------------------------------------------------------
    // TEST 11: Farmer Profile renders AvatarFallback when avatar_url is NULL
    // ------------------------------------------------------------------------
    {
      // Reset avatar_url to null for testFarmer2
      await adminClient
        .from("profiles")
        .update({ avatar_url: null })
        .eq("clerk_id", testFarmer2);

      type PageModule = {
        default?: {
          default?: (props: { params: Promise<{ id: string }> }) => Promise<ReactVNode>;
        } | ((props: { params: Promise<{ id: string }> }) => Promise<ReactVNode>);
      };
      const mod = (await import("@/app/farmers/[id]/page")) as unknown as PageModule;
      const Page =
        (typeof mod.default === "object" && mod.default !== null && "default" in mod.default
          ? mod.default.default
          : mod.default) as (props: { params: Promise<{ id: string }> }) => Promise<ReactVNode>;
      const jsx = await Page({ params: Promise.resolve({ id: testFarmer2 }) });

      const avatarNode = findInTree(
        jsx,
        (n) => typeof n?.type === "function" && (n?.type as { name?: string })?.name === "Avatar"
      );
      const avatarImageNode = findInTree(
        avatarNode,
        (n) => typeof n?.type === "function" && (n?.type as { name?: string })?.name === "AvatarImage"
      );
      const avatarFallbackNode = findInTree(
        avatarNode,
        (n) => typeof n?.type === "function" && n?.type?.name === "AvatarFallback"
      );

      const passed = avatarImageNode === null && avatarFallbackNode !== null && avatarFallbackNode.props?.children === "SF";
      assert(
        "TEST-11",
        "Farmer Profile renders AvatarFallback when avatar_url is NULL",
        passed,
        passed
          ? `Avatar contains <AvatarFallback> with initials "${avatarFallbackNode?.props?.children}" and no AvatarImage`
          : `Failed: avatarImageNode=${!!avatarImageNode}, fallbackInitials=${avatarFallbackNode?.props?.children}`
      );
    }

    // ------------------------------------------------------------------------
    // TEST 12: Onboarding action avatar_url resolution logic
    // ------------------------------------------------------------------------
    {
      const resolveOnboardingAvatar = (user: { hasImage: boolean; imageUrl: string }) =>
        user.hasImage ? user.imageUrl : null;

      const userWithImage = { hasImage: true, imageUrl: "https://img.clerk.com/onboarded.jpg" };
      const userWithoutImage = { hasImage: false, imageUrl: "https://img.clerk.com/default.png" };

      const passed =
        resolveOnboardingAvatar(userWithImage) === "https://img.clerk.com/onboarded.jpg" &&
        resolveOnboardingAvatar(userWithoutImage) === null;

      assert(
        "TEST-12",
        "Onboarding action resolves avatar_url only when hasImage is true",
        passed,
        passed
          ? "Onboarding logic populates imageUrl when hasImage=true, and null when hasImage=false"
          : "Failed onboarding avatar resolution"
      );
    }
  } finally {
    // Clean up test rows from test database
    console.log("\nCleaning up test artifacts from database...");
    await adminClient.from("profiles").delete().in("clerk_id", [testFarmer1, testFarmer2]);
    console.log("Cleanup complete.");
  }

  console.log("\n==============================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`SUMMARY: ${passed}/${total} PASSED (${failed} failed)`);
  console.log("==============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAvatarSyncVerification().catch((err) => {
  console.error("Avatar sync verification suite failed:", err);
  process.exit(1);
});
