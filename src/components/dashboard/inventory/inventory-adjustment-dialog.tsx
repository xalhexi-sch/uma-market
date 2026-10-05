"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiAddLine, RiScales3Line, RiStackLine, RiSubtractLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { adjustInventory } from "@/app/dashboard/inventory/actions";
import { formatQuantity, type InventoryAction } from "@/lib/inventory";
import type { InventoryAdjustmentInput } from "@/lib/validation";
import { cn } from "@/lib/utils";

const ACTIONS: Record<
  InventoryAction,
  { label: string; hint: string; quantityLabel: string; placeholder: string; Icon: typeof RiAddLine }
> = {
  RECEIVED: {
    label: "Add stock",
    hint: "A harvest or delivery came in",
    quantityLabel: "Quantity received",
    placeholder: "e.g. Morning harvest, field 2",
    Icon: RiAddLine,
  },
  SPOILAGE: {
    label: "Record loss",
    hint: "Spoiled, damaged, or lost",
    quantityLabel: "Quantity lost",
    placeholder: "e.g. Bruised in transit",
    Icon: RiSubtractLine,
  },
  ADJUSTMENT: {
    label: "Correct count",
    hint: "Set stock to what you counted",
    quantityLabel: "Counted stock",
    placeholder: "e.g. Weekly stock count",
    Icon: RiScales3Line,
  },
};

const ACTION_ORDER: InventoryAction[] = ["RECEIVED", "SPOILAGE", "ADJUSTMENT"];

interface InventoryAdjustmentDialogProps {
  productId: string;
  name: string;
  unit: string;
  /** Balance as last rendered by the server; a count correction is applied only if it still matches. */
  quantityAvailable: number;
  defaultAction?: InventoryAction;
  triggerVariant?: "default" | "outline";
}

export function InventoryAdjustmentDialog({
  productId,
  name,
  unit,
  quantityAvailable,
  defaultAction = "RECEIVED",
  triggerVariant = "outline",
}: InventoryAdjustmentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<InventoryAction>(defaultAction);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const config = ACTIONS[action];
  const amount = Number(quantity);
  const hasAmount = quantity.trim() !== "" && Number.isFinite(amount) && amount >= 0;
  const projected = !hasAmount
    ? null
    : action === "RECEIVED"
      ? quantityAvailable + amount
      : action === "SPOILAGE"
        ? quantityAvailable - amount
        : amount;
  const exceedsStock = action === "SPOILAGE" && hasAmount && amount > quantityAvailable;
  const inputId = `stock-quantity-${productId}`;
  const reasonId = `stock-reason-${productId}`;
  const errorId = `stock-error-${productId}`;

  function reset() {
    setAction(defaultAction);
    setQuantity("");
    setReason("");
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) return;
    setOpen(nextOpen);
    if (!nextOpen) reset();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!hasAmount) {
      setError("Enter a quantity.");
      return;
    }

    const payload: InventoryAdjustmentInput =
      action === "ADJUSTMENT"
        ? { type: action, productId, quantity: amount, expectedQuantity: quantityAvailable, reason }
        : { type: action, productId, quantity: amount, reason };

    startTransition(async () => {
      const result = await adjustInventory(payload);
      if (result.success) {
        toast.success(`${name}: ${formatQuantity(result.data.quantityAvailable)} ${unit} on hand.`);
        setOpen(false);
        reset();
        return;
      }
      setError(result.error);
      // Someone else changed this stock; load the current balance before a retry.
      if (result.code === "CONFLICT") router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant={triggerVariant}
            size="sm"
            className="h-9 sm:h-7"
            aria-label={`Update stock for ${name}`}
            data-testid="update-stock-trigger"
          />
        }
      >
        <RiStackLine aria-hidden="true" />
        Update stock
      </DialogTrigger>

      <DialogContent className="sm:max-w-md" data-testid="inventory-adjustment-dialog">
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Update stock</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{name}</span> ·{" "}
              <span data-testid="dialog-on-hand">
                {formatQuantity(quantityAvailable)} {unit}
              </span>{" "}
              on hand
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={action}
            onValueChange={(value) => {
              setAction(value as InventoryAction);
              setError(null);
            }}
            aria-label="What happened?"
            className="gap-1.5"
          >
            {ACTION_ORDER.map((key) => {
              const option = ACTIONS[key];
              const optionId = `stock-action-${productId}-${key}`;
              return (
                <Label
                  key={key}
                  htmlFor={optionId}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 font-normal",
                    action === key ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  )}
                >
                  <RadioGroupItem value={key} id={optionId} />
                  <option.Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </Label>
              );
            })}
          </RadioGroup>

          <div className="grid gap-1.5">
            <Label htmlFor={inputId}>
              {config.quantityLabel} ({unit})
            </Label>
            <Input
              id={inputId}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-invalid={Boolean(error) || exceedsStock}
              aria-describedby={error ? errorId : undefined}
              autoFocus
              required
            />
            <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
              {projected === null ? (
                "Stock after this change appears here."
              ) : exceedsStock ? (
                <span className="text-destructive">
                  Only {formatQuantity(quantityAvailable)} {unit} on hand.
                </span>
              ) : (
                <>
                  {formatQuantity(quantityAvailable)} → <span className="font-semibold text-foreground">{formatQuantity(projected)} {unit}</span>
                </>
              )}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={reasonId}>
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={reasonId}
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder={config.placeholder}
            />
          </div>

          {error && (
            <p
              id={errorId}
              role="alert"
              data-testid="inventory-adjustment-error"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || exceedsStock} data-testid="inventory-adjustment-submit">
              {isPending && <Spinner className="motion-reduce:animate-none" />}
              {isPending ? "Saving…" : config.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
