import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WebhookEvent } from "@clerk/nextjs/server";

/**
 * Clerk Webhook Handler
 *
 * Handles lifecycle events:
 * - user.created: Creates stub profile if role is provided in publicMetadata.
 * - user.updated: Logs event. Never overwrites UMA-managed profile data.
 *   Acts as resilience fallback: creates stub profile if missing.
 * - user.deleted: Archives products for farmers (status = archived).
 *   Preserves profile row for order history and audit integrity.
 *
 * Security:
 * - Verified cryptographically using verifyWebhook(req) from @clerk/nextjs/webhooks.
 * - Requires CLERK_WEBHOOK_SIGNING_SECRET in production.
 */
export async function POST(req: NextRequest) {
  let evt: WebhookEvent;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("[webhooks/clerk] Verification failed:", err);
    return new NextResponse("Webhook verification failed", { status: 400 });
  }

  const supabase = createAdminClient();

  switch (evt.type) {
    case "user.created": {
      const { id, public_metadata, image_url, has_image } = evt.data;
      const role = public_metadata?.role as string | undefined;
      const avatarUrl = has_image && image_url ? image_url : null;

      // Only upsert profile stub if role is known and valid.
      // If role is not yet selected, the user will complete onboarding at /onboarding.
      if (role && ["farmer", "business", "admin"].includes(role)) {
        const { error } = await supabase
          .from("profiles")
          .upsert(
            {
              clerk_id: id,
              role,
              city: "Butuan",
              is_verified: false,
              avatar_url: avatarUrl,
            },
            { onConflict: "clerk_id", ignoreDuplicates: true }
          );

        if (error) {
          console.error("[webhooks/clerk] user.created upsert error:", error.message);
        } else {
          console.log(`[webhooks/clerk] user.created stub created for ${id} (${role})`);
        }
      } else {
        console.log(`[webhooks/clerk] user.created for ${id} without role metadata — deferred to onboarding.`);
      }
      break;
    }

    case "user.updated": {
      // Per DECISIONS.md: UMA owns its profile fields (full_name, business_name, phone, city, bio).
      // These must never be overwritten from Clerk events.
      // However, if the profile row is missing (e.g. onboarding network hiccup)
      // and public_metadata.role exists, create the stub as fallback.
      const { id, public_metadata, image_url, has_image } = evt.data;
      const role = public_metadata?.role as string | undefined;
      const avatarUrl = has_image && image_url ? image_url : null;

      if (role && ["farmer", "business", "admin"].includes(role)) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("clerk_id", id)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabase
            .from("profiles")
            .insert({
              clerk_id: id,
              role,
              city: "Butuan",
              is_verified: false,
              avatar_url: avatarUrl,
            });
          if (error) {
            console.error("[webhooks/clerk] user.updated fallback insert error:", error.message);
          } else {
            console.log(`[webhooks/clerk] user.updated: restored missing profile row for ${id}.`);
          }
        } else {
          // Synchronize avatar_url: supports adding, changing, or removing (null) image
          const { error: avatarError } = await supabase
            .from("profiles")
            .update({ avatar_url: avatarUrl })
            .eq("clerk_id", id);

          if (avatarError) {
            console.error("[webhooks/clerk] user.updated avatar_url sync error:", avatarError.message);
          } else {
            console.log(`[webhooks/clerk] user.updated: synchronized avatar_url for ${id}`);
          }
        }
      } else {
        // If profile exists, still sync avatar_url even if public_metadata.role was omitted in event
        const { error: avatarError } = await supabase
          .from("profiles")
          .update({ avatar_url: avatarUrl })
          .eq("clerk_id", id);

        if (avatarError) {
          console.error("[webhooks/clerk] user.updated avatar_url sync error:", avatarError.message);
        }
      }

      const isBannedOrLocked = Boolean(
        (evt.data as { banned?: boolean; locked?: boolean }).banned ||
        (evt.data as { banned?: boolean; locked?: boolean }).locked
      );
      if (isBannedOrLocked) {
        await supabase
          .from("profiles")
          .update({ status: "suspended" })
          .eq("clerk_id", id);
        console.log(`[webhooks/clerk] user.updated: set profile status to suspended for ${id}`);
      }
      break;
    }

    case "user.deleted": {
      const { id } = evt.data;
      if (id) {
        // Mark profile as revoked immediately so any remaining JWT is blocked
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ status: "revoked" })
          .eq("clerk_id", id);

        if (profileError) {
          console.error("[webhooks/clerk] user.deleted error updating profile status:", profileError.message);
        } else {
          console.log(`[webhooks/clerk] user.deleted: profile status set to revoked for user ${id}.`);
        }

        // Archive all products owned by that farmer so they are no longer discoverable.
        // We leave the profile row intact to protect past order history and receipts.
        const { error } = await supabase
          .from("products")
          .update({ status: "archived" })
          .eq("farmer_clerk_id", id);

        if (error) {
          console.error("[webhooks/clerk] user.deleted error archiving products:", error.message);
        } else {
          console.log(`[webhooks/clerk] user.deleted: archived products for farmer ${id}.`);
        }
      }
      break;
    }

    // Explicit Session Revocation / Termination events (SEC-AUTH-001)
    case "session.revoked":
    case "session.ended":
    case "session.removed": {
      const userId = (evt.data as { user_id?: string }).user_id;
      if (userId) {
        const { error } = await supabase
          .from("profiles")
          .update({ status: "revoked" })
          .eq("clerk_id", userId);

        if (error) {
          console.error(`[webhooks/clerk] ${evt.type} error updating profile status:`, error.message);
        } else {
          console.log(`[webhooks/clerk] ${evt.type}: set profile status to revoked for user ${userId}.`);
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
