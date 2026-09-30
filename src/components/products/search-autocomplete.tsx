"use client";

import { useState, useEffect, useRef, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  RiSearchLine,
  RiCloseCircleLine,
  RiLoader4Line,
  RiPlantLine,
  RiArrowRightLine,
} from "@remixicon/react";
import { Input } from "@/components/ui/input";
import { ProductImage } from "@/components/ui/product-image";
import { CURRENCY } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type {
  SearchSuggestionItem,
  SearchSuggestionCategory,
  SearchSuggestionsResponse,
} from "@/app/api/search/suggestions/route";

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (query: string) => void;
  onClear: () => void;
  basePath: "/products" | "/business/products";
  variant?: "marketplace" | "business";
  placeholder?: string;
  className?: string;
  isSearchingContext?: boolean;
}

export function SearchAutocomplete({
  value,
  onChange,
  onSubmit,
  onClear,
  basePath,
  variant = "marketplace",
  placeholder,
  className,
  isSearchingContext = false,
}: SearchAutocompleteProps) {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestionItem[]>([]);
  const [categories, setCategories] = useState<SearchSuggestionCategory[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  // Debounced API request
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      return;
    }

    const abortController = new AbortController();

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(trimmed)}`,
          { signal: abortController.signal }
        );
        if (!res.ok) throw new Error("Search suggestions failed");
        const data: SearchSuggestionsResponse = await res.json();
        setSuggestions(data.suggestions || []);
        setCategories(data.categories || []);
        setIsOpen(true);
        setHighlightedIndex(-1);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Autocomplete fetch error:", err);
        }
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isInputShort = value.trim().length < 2;
  const activeSuggestions = isInputShort ? [] : suggestions;
  const activeCategories = isInputShort ? [] : categories;
  const showDropdown = isOpen && !isInputShort;
  const totalItems = activeSuggestions.length + activeCategories.length;

  const navigateToSuggestion = (item: SearchSuggestionItem) => {
    setIsOpen(false);
    const targetHref =
      variant === "business"
        ? `/business/products/${item.id}`
        : `/products/${item.id}`;
    router.push(targetHref);
  };

  const navigateToCategory = (cat: SearchSuggestionCategory) => {
    setIsOpen(false);
    router.push(`${basePath}?category=${encodeURIComponent(cat.slug)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (e.key === "Enter") {
        e.preventDefault();
        onSubmit(value);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (totalItems === 0) return;
      setHighlightedIndex((prev) => (prev + 1 >= totalItems ? 0 : prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (totalItems === 0) return;
      setHighlightedIndex((prev) => (prev - 1 < 0 ? totalItems - 1 : prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < activeSuggestions.length) {
        navigateToSuggestion(activeSuggestions[highlightedIndex]);
      } else if (
        highlightedIndex >= activeSuggestions.length &&
        highlightedIndex < totalItems
      ) {
        const catIndex = highlightedIndex - activeSuggestions.length;
        navigateToCategory(activeCategories[catIndex]);
      } else {
        setIsOpen(false);
        onSubmit(value);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const activeDescendantId =
    highlightedIndex >= 0 ? `suggestion-item-${highlightedIndex}` : undefined;

  return (
    <div ref={containerRef} className={cn("relative flex-1", className)}>
      {/* Search Input Box */}
      <div className="relative w-full">
        {isLoading || isSearchingContext ? (
          <RiLoader4Line className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-primary animate-spin pointer-events-none" />
        ) : (
          <RiSearchLine className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        )}
        <Input
          ref={inputRef}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendantId}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen && e.target.value.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (value.trim().length >= 2 && (suggestions.length > 0 || categories.length > 0)) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            placeholder ||
            (variant === "marketplace"
              ? "Search produce, varieties, or farm names…"
              : "Search products or farmers…")
          }
          className={cn(
            "pl-10 pr-9 bg-background text-sm shadow-xs transition-colors",
            variant === "marketplace" ? "h-11" : "h-9"
          )}
          aria-label="Search produce"
        />

        {value && (
          <button
            type="button"
            onClick={() => {
              onClear();
              setIsOpen(false);
              setSuggestions([]);
              setCategories([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-0.5 rounded-sm"
            aria-label="Clear search text"
          >
            <RiCloseCircleLine className="size-4" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown Popover */}
      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {/* Produce Suggestions */}
          {activeSuggestions.length > 0 && (
            <div className="p-1.5 space-y-0.5">
              <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Produce Matches
              </div>
              {activeSuggestions.map((item, idx) => {
                const isHighlighted = highlightedIndex === idx;
                const targetHref =
                  variant === "business"
                    ? `/business/products/${item.id}`
                    : `/products/${item.id}`;

                return (
                  <Link
                    key={item.id}
                    id={`suggestion-item-${idx}`}
                    role="option"
                    aria-selected={isHighlighted}
                    href={targetHref}
                    onClick={() => setIsOpen(false)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors cursor-pointer group",
                      isHighlighted
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted/50 text-foreground"
                    )}
                  >
                    {/* Produce Thumbnail */}
                    <div className="relative size-10 rounded-md overflow-hidden bg-muted shrink-0 border border-border/60">
                      <ProductImage
                        src={item.image_url}
                        alt={item.name}
                        sizes="40px"
                        className="object-cover"
                      />
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium text-foreground truncate text-xs sm:text-sm group-hover:text-primary transition-colors">
                          {item.name}
                        </p>
                        <p className="font-bold text-foreground text-xs sm:text-sm shrink-0 tabular-nums">
                          {CURRENCY}
                          {item.price_per_unit.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                          <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                            /{item.unit}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="truncate">{item.farmer_name}</span>
                        {item.min_order_quantity > 0 && (
                          <>
                            <span>·</span>
                            <span className="shrink-0">
                              MOQ: {item.min_order_quantity} {item.unit}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Category Chips / Quick Jump */}
          {activeCategories.length > 0 && (
            <div className="border-t border-border/60 p-2 bg-muted/20">
              <div className="px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Categories
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeCategories.map((cat, catIdx) => {
                  const globalIdx = activeSuggestions.length + catIdx;
                  const isHighlighted = highlightedIndex === globalIdx;

                  return (
                    <Link
                      key={cat.slug}
                      id={`suggestion-item-${globalIdx}`}
                      role="option"
                      aria-selected={isHighlighted}
                      href={`${basePath}?category=${encodeURIComponent(cat.slug)}`}
                      onClick={() => setIsOpen(false)}
                      onMouseEnter={() => setHighlightedIndex(globalIdx)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                        isHighlighted
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:border-primary/50"
                      )}
                    >
                      <RiPlantLine className="size-3 text-primary" />
                      <span>{cat.name}</span>
                      <RiArrowRightLine className="size-3 opacity-60" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && activeSuggestions.length === 0 && activeCategories.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-xs font-medium text-foreground">
                No matching produce found
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Press <span className="font-semibold text-foreground">Enter</span> to run a full catalog fuzzy search
              </p>
            </div>
          )}

          {/* Footer query submit CTA */}
          <div className="border-t border-border/60 px-3 py-2 bg-muted/40 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Press <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">↵ Enter</kbd> for all results
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onSubmit(value);
              }}
              className="font-medium text-primary hover:underline cursor-pointer"
            >
              Search &quot;{value.trim()}&quot; →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
