import type { ReactNode } from "react";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  /** Optional trailing action (e.g. a "View all" link). */
  action?: ReactNode;
  id?: string;
}

/** Eyebrow + title + description used by every public landing section. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  id,
}: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          {eyebrow}
        </p>
        <h2
          id={id}
          className="mt-3 text-2xl font-bold tracking-tight text-foreground text-balance sm:text-3xl lg:text-4xl"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
