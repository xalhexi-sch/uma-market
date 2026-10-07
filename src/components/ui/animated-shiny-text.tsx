import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type FC,
} from "react";
import { cn } from "@/lib/utils";

export interface AnimatedShinyTextProps extends ComponentPropsWithoutRef<"span"> {
  shimmerWidth?: number;
}

export const AnimatedShinyText: FC<AnimatedShinyTextProps> = ({
  children,
  className,
  shimmerWidth = 100,
  ...props
}) => {
  return (
    <span
      style={
        {
          "--shiny-width": `${shimmerWidth}px`,
        } as CSSProperties
      }
      className={cn(
        "inline-flex text-muted-foreground",
        "animate-shiny-text bg-clip-text bg-no-repeat",
        "bg-[length:var(--shiny-width)_100%] bg-[position:0_0]",
        "bg-gradient-to-r from-transparent via-foreground to-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};
