import type { ComponentProps } from "react";
import {
  RiPlantLine,
  RiAppleLine,
  RiSeedlingLine,
  RiLeafLine,
  RiSparklingLine,
  RiBowlLine,
  RiDropLine,
  RiShoppingBagLine,
} from "@remixicon/react";

interface CategoryIconProps extends ComponentProps<typeof RiPlantLine> {
  slug: string;
}

/**
 * Returns a semantic, category-specific icon for agricultural produce.
 * Falls back gracefully to RiShoppingBagLine for unrecognized categories.
 */
export function CategoryIcon({ slug, ...props }: CategoryIconProps) {
  switch (slug) {
    case "vegetables":
      return <RiPlantLine {...props} />;
    case "fruits":
      return <RiAppleLine {...props} />;
    case "rice-grains":
      return <RiSeedlingLine {...props} />;
    case "root-crops":
      return <RiLeafLine {...props} />;
    case "herbs-spices":
      return <RiSparklingLine {...props} />;
    case "poultry-eggs":
      return <RiBowlLine {...props} />;
    case "fish-seafood":
      return <RiDropLine {...props} />;
    default:
      return <RiShoppingBagLine {...props} />;
  }
}
