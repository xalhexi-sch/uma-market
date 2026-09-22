import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RiArrowLeftLine, RiBuildingLine, RiMapPinLine, RiPhoneLine } from "@remixicon/react";
import { getAdminProfiles } from "@/lib/supabase/queries/admin";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/lib/constants";

export const metadata = {
  title: "Commercial Buyers — UMA Market Admin",
  description: "Directory of commercial restaurants, hotels, and caterers on UMA Market.",
};

export default async function AdminBusinessesPage() {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;

  if (role !== "admin") {
    redirect(role === "farmer" ? "/farmer" : role === "business" ? "/business" : "/onboarding");
  }

  const businesses = await getAdminProfiles("business");

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-6xl">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <RiArrowLeftLine className="size-3.5" />
          Back to Overview
        </Link>
        <div className="flex items-center gap-2">
          <RiBuildingLine className="size-6 text-blue-600" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Commercial Buyers
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Verified food businesses, restaurants, hotels, canteens, and catering services procuring local produce.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">Business / Establishment</th>
                <th className="py-3 px-4">Representative</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {businesses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No commercial buyers registered yet.
                  </td>
                </tr>
              ) : (
                businesses.map((biz) => (
                  <tr key={biz.clerk_id} className="border-b border-border transition-colors hover:bg-muted/20 text-sm">
                    <td className="py-3 px-4 font-medium text-foreground">
                      {biz.business_name || "Food Business"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {biz.full_name || "—"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <RiMapPinLine className="size-3.5 text-muted-foreground" />
                        <span>{biz.city || "Butuan City"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {biz.phone ? (
                        <div className="flex items-center gap-1">
                          <RiPhoneLine className="size-3.5 text-muted-foreground" />
                          <span>{biz.phone}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/30">
                        Verified Buyer
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
