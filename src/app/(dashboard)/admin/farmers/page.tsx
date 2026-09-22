import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RiArrowLeftLine, RiPlantLine, RiMapPinLine, RiPhoneLine } from "@remixicon/react";
import { getAdminProfiles } from "@/lib/supabase/queries/admin";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/lib/constants";

export const metadata = {
  title: "Registered Farmers — UMA Market Admin",
  description: "Directory of local agricultural producers registered in Butuan.",
};

export default async function AdminFarmersPage() {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;

  if (role !== "admin") {
    redirect(role === "farmer" ? "/farmer" : role === "business" ? "/business" : "/onboarding");
  }

  const farmers = await getAdminProfiles("farmer");

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
          <RiPlantLine className="size-6 text-emerald-600" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Registered Farmers
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Agricultural producers, smallholder growers, and farm cooperatives supplying UMA Market.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">Farm / Producer</th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {farmers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No farmers registered yet.
                  </td>
                </tr>
              ) : (
                farmers.map((farmer) => (
                  <tr key={farmer.clerk_id} className="border-b border-border transition-colors hover:bg-muted/20 text-sm">
                    <td className="py-3 px-4 font-medium text-foreground">
                      {farmer.business_name || "Farm Producer"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {farmer.full_name || "—"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <RiMapPinLine className="size-3.5 text-muted-foreground" />
                        <span>{farmer.city || "Butuan City"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {farmer.phone ? (
                        <div className="flex items-center gap-1">
                          <RiPhoneLine className="size-3.5 text-muted-foreground" />
                          <span>{farmer.phone}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                        Active Producer
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
