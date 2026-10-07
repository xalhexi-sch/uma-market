"use client";

import { useState } from "react";
import { moderateProductStatus } from "@/app/(dashboard)/admin/actions";
import { ProductStatusBadge } from "@/components/dashboard/product-status-badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { TableRow, TableCell } from "@/components/ui/table";
import { CURRENCY } from "@/lib/constants";
import type { Product } from "@/lib/types";

interface AdminProductRowProps {
  product: Product;
}

export function AdminProductRow({ product }: AdminProductRowProps) {
  const [status, setStatus] = useState(product.status);
  const [loading, setLoading] = useState(false);

  async function handleToggle(newStatus: "active" | "archived") {
    setLoading(true);
    const res = await moderateProductStatus(product.id, newStatus);
    setLoading(false);
    if (res.success) {
      toast.success(`Product ${newStatus === "archived" ? "archived" : "restored"}.`);
      setStatus(newStatus);
    } else {
      toast.error(res.error ?? "Action failed.");
    }
  }

  const isArchived = status === "archived";

  return (
    <TableRow className="text-sm">
      <TableCell className="font-medium text-foreground">
        <div>
          <p>{product.name}</p>
          <p className="text-xs text-muted-foreground">{product.category?.name ?? "General"}</p>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {product.farmer?.business_name || product.farmer?.full_name || "Farm Producer"}
      </TableCell>
      <TableCell className="tabular-nums">
        {CURRENCY}{Number(product.price_per_unit).toFixed(2)} / {product.unit}
      </TableCell>
      <TableCell className="tabular-nums">
        {product.quantity_available} {product.unit}
      </TableCell>
      <TableCell>
        <ProductStatusBadge status={status} className="text-xs" />
      </TableCell>
      <TableCell className="text-right">
        {isArchived ? (
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => handleToggle("active")}
            className="text-xs h-8"
          >
            {loading ? "Updating..." : "Restore Active"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => handleToggle("archived")}
            className="text-xs h-8 text-destructive hover:text-destructive"
          >
            {loading ? "Updating..." : "Archive"}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
