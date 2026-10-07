import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RiArrowLeftLine, RiBuildingLine, RiMapPinLine, RiPhoneLine } from "@remixicon/react";
import { Empty, EmptyHeader, EmptyTitle, EmptyMedia } from "@/components/ui/empty";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { getAdminProfiles } from "@/lib/supabase/queries/admin";
import { AdminVerifyButton } from "@/components/dashboard/admin-verify-button";
import { AdminAccountStatusButton } from "@/components/dashboard/admin-account-status-button";
import type { UserRole } from "@/lib/constants";

export const metadata = {
  title: "Commercial Buyers — UMA Market Admin",
  description: "Directory of commercial restaurants, hotels, and caterers on UMA Market.",
};

export default async function AdminBusinessesPage() {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;

  if (role !== "admin") {
    if (role === "farmer" || role === "business") redirect("/dashboard");
    redirect("/onboarding");
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
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business / Establishment</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Representative</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verification</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {businesses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <RiBuildingLine className="size-4" />
                      </EmptyMedia>
                      <EmptyTitle>No commercial buyers registered yet.</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              businesses.map((biz) => (
                <TableRow key={biz.clerk_id} className="border-b border-border transition-colors hover:bg-muted/20 text-sm">
                  <TableCell className="py-3 px-4 font-medium text-foreground">
                    {biz.business_name || "Food Business"}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-muted-foreground">
                    {biz.full_name || "—"}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <RiMapPinLine className="size-3.5 text-muted-foreground" />
                      <span>{biz.city || "Butuan City"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-4 text-muted-foreground">
                    {biz.phone ? (
                      <div className="flex items-center gap-1">
                        <RiPhoneLine className="size-3.5 text-muted-foreground" />
                        <span>{biz.phone}</span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <AdminVerifyButton clerkId={biz.clerk_id} isVerified={biz.is_verified} />
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <AdminAccountStatusButton clerkId={biz.clerk_id} status={biz.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
