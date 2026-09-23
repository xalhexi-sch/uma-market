"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { RiImageAddLine, RiDeleteBinLine, RiStarFill, RiAddLine } from "@remixicon/react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createProduct, updateProduct, archiveProduct } from "@/app/(dashboard)/farmer/products/actions";
import { useSupabase } from "@/hooks/use-supabase";
import { getProductImageUrl, validateProductImageFile, PRODUCT_IMAGES_BUCKET } from "@/lib/supabase/storage";
import type { Category, Product } from "@/lib/types";
import { PRODUCT_UNITS } from "@/lib/constants";
import { toast } from "@/components/ui/toast";

interface ProductFormProps {
  categories: Category[];
  mode: "create" | "edit";
  product?: Product;
}

interface FormPhoto {
  id?: string;
  file?: File;
  previewUrl: string;
  imagePath?: string;
}

export function ProductForm({ categories, mode, product }: ProductFormProps) {
  const { user } = useUser();
  const supabase = useSupabase();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: product?.name ?? "",
    category_id: product?.category_id ?? "",
    description: product?.description ?? "",
    price_per_unit: product?.price_per_unit ?? 0,
    unit: product?.unit ?? "kg",
    quantity_available: product?.quantity_available ?? 0,
    min_order_quantity: product?.min_order_quantity ?? 1,
    harvest_date: product?.harvest_date ?? "",
    available_until: product?.available_until ?? "",
    status: (product?.status === "active" || product?.status === "draft" ? product.status : "draft") as "active" | "draft",
  });

  const [photos, setPhotos] = useState<FormPhoto[]>(() => {
    if (product?.images && product.images.length > 0) {
      return product.images.map((img) => ({
        id: img.id,
        previewUrl: getProductImageUrl(img.image_path) || "",
        imagePath: img.image_path,
      }));
    }
    const fallbackUrl = getProductImageUrl(product?.image_path, product?.image_url);
    if (fallbackUrl && product?.image_path) {
      return [
        {
          id: "existing-primary",
          previewUrl: fallbackUrl,
          imagePath: product.image_path,
        },
      ];
    }
    return [];
  });

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isArchiving, startArchive] = useTransition();

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validFiles: File[] = [];
    for (const file of files) {
      const validation = validateProductImageFile(file);
      if (!validation.valid) {
        setUploadError(validation.error || "Invalid file format or size.");
        return;
      }
      validFiles.push(file);
    }

    const remainingSlots = 5 - photos.length;
    if (remainingSlots <= 0) {
      setUploadError("You can have a maximum of 5 photos per product.");
      return;
    }

    const filesToAdd = validFiles.slice(0, remainingSlots);
    if (validFiles.length > remainingSlots) {
      setUploadError(`Only ${remainingSlots} photo(s) added. Maximum is 5 photos.`);
    }

    const newPhotos: FormPhoto[] = filesToAdd.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...newPhotos]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSetAsPrimary(index: number) {
    if (index === 0) return;
    setPhotos((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      return [item, ...copy];
    });
  }

  function handleRemovePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUploadError(null);

    startTransition(async () => {
      if (!user?.id) {
        setError("User session not found. Please refresh and try again.");
        return;
      }

      // Upload new files to Supabase Storage
      const uploadedImages: Array<{ id?: string; image_path: string; sort_order: number }> = [];

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        if (photo.file) {
          const ext = photo.file.name.split(".").pop()?.toLowerCase() || "webp";
          const fileId = crypto.randomUUID();
          const objectPath = `products/${user.id}/${fileId}.${ext}`;

          const { error: uploadErr } = await supabase.storage
            .from(PRODUCT_IMAGES_BUCKET)
            .upload(objectPath, photo.file, {
              upsert: true,
              contentType: photo.file.type,
            });

          if (uploadErr) {
            console.error("Storage upload error:", uploadErr.message);
            setError(`Failed to upload photo: ${uploadErr.message}`);
            return;
          }

          uploadedImages.push({
            image_path: objectPath,
            sort_order: i,
          });
        } else if (photo.imagePath) {
          uploadedImages.push({
            id: photo.id,
            image_path: photo.imagePath,
            sort_order: i,
          });
        }
      }

      const primaryPath = uploadedImages.length > 0 ? uploadedImages[0].image_path : null;

      const data = {
        ...form,
        price_per_unit: Number(form.price_per_unit),
        quantity_available: Number(form.quantity_available),
        min_order_quantity: Number(form.min_order_quantity),
        image_path: primaryPath,
        images: uploadedImages,
      };

      const result =
        mode === "create"
          ? await createProduct(data)
          : await updateProduct(product!.id, data);

      if (result.success) {
        toast.success(mode === "create" ? "Product created successfully." : "Product updated successfully.");
        router.push("/farmer/products");
      } else {
        toast.error(result.error ?? "Something went wrong.");
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleArchive() {
    if (!product) return;
    startArchive(async () => {
      const result = await archiveProduct(product.id);
      if (result.success) {
        toast.success("Product archived.");
        router.push("/farmer/products");
      } else {
        toast.error(result.error ?? "Could not archive.");
        setError(result.error ?? "Could not archive.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* Product Information */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Product Information
        </h2>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Product Name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Fresh Tomatoes"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            value={form.category_id}
            onChange={(e) => set("category_id", e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Describe the product, growing conditions, quality, etc."
            rows={3}
            className="resize-none"
          />
        </div>
      </section>

      {/* Produce Photography */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Produce Photography
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add up to 5 photos showing produce grade, harvest condition, and packaging. The first photo is your primary listing image.
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {photos.length} / 5 photos
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {photos.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 p-8 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3 group-hover:scale-105 transition-transform">
                <RiImageAddLine className="size-6" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Click to upload produce photos
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPEG, PNG, or WebP up to 5MB (up to 5 photos)
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Primary Photo Showcase Card */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border-2 border-primary/40 bg-card p-4 shadow-2xs">
                <div className="flex items-center gap-4">
                  <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photos[0].previewUrl}
                      alt="Primary produce preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        <RiStarFill className="size-3" />
                        Primary Photo
                      </span>
                    </div>
                    <p className="text-xs font-medium text-foreground">
                      {photos[0].file ? photos[0].file.name : "Cover photo for listings"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Displayed on marketplace cards, cart, and search results
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemovePhoto(0)}
                  className="text-xs text-destructive hover:text-destructive shrink-0"
                >
                  <RiDeleteBinLine className="size-3.5 mr-1" />
                  Remove
                </Button>
              </div>

              {/* Secondary Photos Grid */}
              {photos.length > 1 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Additional Photos ({photos.length - 1})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {photos.slice(1).map((photo, index) => {
                      const actualIndex = index + 1;
                      return (
                        <div
                          key={photo.id || photo.previewUrl}
                          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5 shadow-2xs"
                        >
                          <div className="relative aspect-square w-full overflow-hidden rounded-md border border-border bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.previewUrl}
                              alt={`Secondary preview ${actualIndex}`}
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute top-1.5 left-1.5 rounded-full bg-background/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Photo {actualIndex + 1}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/60">
                            <button
                              type="button"
                              onClick={() => handleSetAsPrimary(actualIndex)}
                              className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                            >
                              Set as Primary
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(actualIndex)}
                              className="text-[11px] font-medium text-destructive hover:underline cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add More Photos Button (up to 5) */}
              {photos.length < 5 && (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs"
                  >
                    <RiAddLine className="size-3.5 mr-1" />
                    Add photos ({5 - photos.length} remaining)
                  </Button>
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFilesSelected}
            className="hidden"
          />

          {uploadError && (
            <p className="text-xs font-medium text-destructive">
              {uploadError}
            </p>
          )}
        </div>
      </section>

      {/* Supply */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Supply &amp; Pricing
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="price">Price (₱)</Label>
            <Input
              id="price"
              type="number"
              min={0.01}
              step={0.01}
              value={form.price_per_unit}
              onChange={(e) => set("price_per_unit", Number(e.target.value))}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unit">Unit</Label>
            <select
              id="unit"
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {PRODUCT_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qty">Available Quantity</Label>
            <Input
              id="qty"
              type="number"
              min={0}
              step={0.5}
              value={form.quantity_available}
              onChange={(e) => set("quantity_available", Number(e.target.value))}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="min-order">Minimum Order</Label>
            <Input
              id="min-order"
              type="number"
              min={0.5}
              step={0.5}
              value={form.min_order_quantity}
              onChange={(e) => set("min_order_quantity", Number(e.target.value))}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="harvest-date">
              Harvest Date <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="harvest-date"
              type="date"
              value={form.harvest_date}
              onChange={(e) => set("harvest_date", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="avail-until">
              Available Until <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="avail-until"
              type="date"
              value={form.available_until}
              onChange={(e) => set("available_until", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Publishing */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Publishing
        </h2>

        <div className="flex flex-col gap-2">
          {(["active", "draft"] as const).map((s) => (
            <label key={s} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="status"
                value={s}
                checked={form.status === s}
                onChange={() => set("status", s)}
                className="mt-0.5 text-primary"
              />
              <div>
                <p className="text-sm font-medium text-foreground capitalize">{s}</p>
                <p className="text-xs text-muted-foreground">
                  {s === "active"
                    ? "Visible to businesses and available for ordering."
                    : "Saved but not visible to buyers yet."}
                </p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? mode === "create" ? "Creating…" : "Saving…"
            : mode === "create" ? "Create Product" : "Save Changes"}
        </Button>

        {mode === "edit" && product?.status !== "archived" && (
          <Button
            type="button"
            variant="outline"
            onClick={handleArchive}
            disabled={isArchiving}
            className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
          >
            {isArchiving ? "Archiving…" : "Archive Product"}
          </Button>
        )}
      </div>
    </form>
  );
}
