import Link from "next/link";
import { RiArrowRightLine, RiCheckboxCircleFill, RiMapPinLine } from "@remixicon/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PublicFarmerProfile } from "@/lib/supabase/queries/public-profiles";
import { routes } from "@/platform/routes";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return (parts[0] || "PR").slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ProducerCard({ producer }: { producer: PublicFarmerProfile }) {
  const name = producer.business_name || producer.full_name || "Local Producer";

  return (
    <Link
      href={routes.producer(producer.clerk_id)}
      aria-label={`View ${name} producer profile`}
      className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-2xs transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-4">
        <Avatar className="size-14 shrink-0 border border-border/70">
          {producer.avatar_url && <AvatarImage src={producer.avatar_url} alt={name} />}
          <AvatarFallback className="bg-primary/10 font-semibold text-primary">
            {initials(name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="truncate font-semibold text-foreground transition-colors group-hover:text-primary">
              {name}
            </h2>
            {producer.is_verified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <RiCheckboxCircleFill className="size-3.5" aria-hidden="true" />
                Verified
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <RiMapPinLine className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            {producer.city || "Butuan City"}, Philippines
          </p>
        </div>
      </div>

      <p className="mt-4 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
        {producer.bio || "A local agricultural producer sharing fresh harvests with UMA buyers."}
      </p>

      <span className="mt-5 inline-flex items-center gap-1.5 border-t border-border/60 pt-3 text-sm font-medium text-primary">
        View producer profile
        <RiArrowRightLine className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
