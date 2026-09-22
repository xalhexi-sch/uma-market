"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createProduct, updateProduct, archiveProduct } from "@/app/(dashboard)/farmer/products/actions";
import type { Category, Product } from "@/lib/types";
import { PRODUCT_UNITS } from "@/lib/constants";

interface ProductFormProps {
  categories: Category[];
  mode: "create" | "edit";
  product?: Product;
}

export function ProductForm({ categories, mode, product }: ProductFormProps) {
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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isArchiving, startArchive] = useTransition();
  const router = useRouter();

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const data = {
        ...form,
        price_per_unit: Number(form.price_per_unit),
        quantity_available: Number(form.quantity_available),
        min_order_quantity: Number(form.min_order_quantity),
      };

      const result =
        mode === "create"
          ? await createProduct(data)
          : await updateProduct(product!.id, data);

      if (result.success) {
        router.push("/farmer/products");
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleArchive() {
    if (!product) return;
    startArchive(async () => {
      const result = await archiveProduct(product.id);
      if (result.success) {
        router.push("/farmer/products");
      } else {
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

      {/* Supply */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Supply &amp; Pricing
        </h2>

        <div className="grid grid-cols-2 gap-4">
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
