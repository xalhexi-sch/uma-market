"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiUserLine,
  RiBuildingLine,
  RiPhoneLine,
  RiMapPinLine,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
} from "@remixicon/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { updateProfile } from "@/app/(dashboard)/profile/actions";
import type { Profile } from "@/lib/types";

interface ProfileFormProps {
  profile: Profile | null;
  role: "farmer" | "business" | "admin";
}

export function ProfileForm({ profile, role }: ProfileFormProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [businessName, setBusinessName] = useState(profile?.business_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [city, setCity] = useState(profile?.city ?? "Butuan City");
  const [bio, setBio] = useState(profile?.bio ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isFarmer = role === "farmer";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await updateProfile({
      full_name: fullName,
      business_name: businessName,
      phone,
      city,
      bio,
    });

    setSaving(false);

    if (!res.success) {
      setError(res.error ?? "Failed to save profile.");
      toast.error(res.error ?? "Failed to save profile.");
    } else {
      setSuccess(true);
      toast.success("Profile updated successfully.");
      router.refresh();
      setTimeout(() => setSuccess(false), 4000);
    }
  }

  return (
    <Card className="max-w-2xl border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-foreground">
              {isFarmer ? "Farm & Producer Profile" : "Business Buyer Profile"}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              {isFarmer
                ? "Manage your farm identity, contact details, and location for commercial buyers."
                : "Manage your business details, contact information, and delivery location."}
            </CardDescription>
          </div>
          <Badge variant="outline" className="capitalize text-xs font-medium px-2.5 py-1">
            {role}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <RiErrorWarningLine className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
              <RiCheckboxCircleLine className="size-4 shrink-0" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm font-medium">
              Contact Person Full Name
            </Label>
            <div className="relative">
              <RiUserLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessName" className="text-sm font-medium">
              {isFarmer ? "Farm / Producer Name" : "Business / Restaurant Name"}
            </Label>
            <div className="relative">
              <RiBuildingLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={isFarmer ? "e.g. Green Valley Farm Ampayon" : "e.g. Balanghai Bistro"}
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                Contact Phone Number
              </Label>
              <div className="relative">
                <RiPhoneLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+63 917 123 4567"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="city" className="text-sm font-medium">
                City / Location
              </Label>
              <div className="relative">
                <RiMapPinLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Butuan City"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio" className="text-sm font-medium">
              {isFarmer ? "Farm Description & Harvest Specialties" : "About Your Establishment"}
            </Label>
            <Textarea
              id="bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={
                isFarmer
                  ? "Describe your farm location in Butuan, organic or conventional practices, and primary crops..."
                  : "Tell local farmers about your restaurant, daily produce requirements, or kitchen focus..."
              }
              className="resize-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving Changes..." : "Save Profile"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
