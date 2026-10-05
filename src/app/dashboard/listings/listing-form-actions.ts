import type { ProductFormActions } from "@/components/dashboard/product-form";
import { archiveListing, createListing, updateListing } from "./actions";

/** V4 server actions handed to the shared ProductForm on /dashboard/listings pages. */
export const LISTING_FORM_ACTIONS: ProductFormActions = {
  create: createListing,
  update: updateListing,
  archive: archiveListing,
};
