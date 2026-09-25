"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import type { ProductSort } from "@/lib/supabase/queries/products";

interface ProductSearchContextValue {
  basePath: string;
  variant: "marketplace" | "business";
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
  liveProducts: Product[] | null;
  liveTotalCount: number | null;
  hasSearched: boolean;
  clearSearch: () => void;
  commitSearch: (queryToCommit?: string) => void;
  activeCategory: string;
  activeSort: ProductSort;
  inStockOnly: boolean;
}

const ProductSearchContext = createContext<ProductSearchContextValue | null>(null);

export interface ProductSearchProviderProps {
  children: ReactNode;
  basePath: "/products" | "/business/products";
  variant?: "marketplace" | "business";
  initialSearch?: string;
  initialCategory?: string;
  initialSort?: ProductSort;
  initialInStockOnly?: boolean;
}

export function ProductSearchProvider({
  children,
  basePath,
  variant = "marketplace",
  initialSearch = "",
  initialCategory = "",
  initialSort = "newest",
  initialInStockOnly = true,
}: ProductSearchProviderProps) {
  const router = useRouter();

  const [searchQuery, setSearchQueryState] = useState(initialSearch);
  const [isSearching, setIsSearching] = useState(false);
  const [liveProducts, setLiveProducts] = useState<Product[] | null>(null);
  const [liveTotalCount, setLiveTotalCount] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // References for debounce, aborting, and racing-response protection
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestIdRef = useRef<number>(0);

  // Adjust state during render when props change externally (e.g. navigation, pill click, apply)
  const [prevProps, setPrevProps] = useState({
    initialSearch,
    initialCategory,
    initialSort,
    initialInStockOnly,
  });

  if (
    prevProps.initialSearch !== initialSearch ||
    prevProps.initialCategory !== initialCategory ||
    prevProps.initialSort !== initialSort ||
    prevProps.initialInStockOnly !== initialInStockOnly
  ) {
    setPrevProps({
      initialSearch,
      initialCategory,
      initialSort,
      initialInStockOnly,
    });
    setSearchQueryState(initialSearch);
    setLiveProducts(null);
    setLiveTotalCount(null);
    setHasSearched(false);
    setIsSearching(false);
  }

  // Clean up timers & abort controller on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const executeSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim();

      // If empty query, restore default catalog
      if (!trimmed) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        lastRequestIdRef.current += 1;
        setIsSearching(false);
        setLiveProducts(null);
        setLiveTotalCount(null);
        setHasSearched(false);

        // Update URL state
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          params.delete("q");
          if (params.get("sort") === "relevance") {
            params.delete("sort");
          }
          const qs = params.toString();
          window.history.replaceState(null, "", `${basePath}${qs ? `?${qs}` : ""}`);
        }
        return;
      }

      // Abort previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Monotonic request ID guard to prevent stale responses from overwriting newer ones
      const requestId = ++lastRequestIdRef.current;
      setIsSearching(true);

      try {
        const queryParams = new URLSearchParams();
        queryParams.set("q", trimmed);
        if (initialCategory) queryParams.set("category", initialCategory);
        if (initialSort && initialSort !== "newest") queryParams.set("sort", initialSort);
        if (!initialInStockOnly) queryParams.set("in_stock", "false");

        // Update URL to remain authoritative without full-page re-render
        if (typeof window !== "undefined") {
          const browserParams = new URLSearchParams(window.location.search);
          browserParams.set("q", trimmed);
          browserParams.delete("page");
          const qs = browserParams.toString();
          window.history.replaceState(null, "", `${basePath}${qs ? `?${qs}` : ""}`);
        }

        const response = await fetch(`/api/products/search?${queryParams.toString()}`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Search request failed with status: ${response.status}`);
        }

        const data = await response.json();

        // Stale response guard: check if this is still the most recent request
        if (requestId === lastRequestIdRef.current) {
          setLiveProducts(data.products || []);
          setLiveTotalCount(data.totalCount ?? (data.products ? data.products.length : 0));
          setHasSearched(true);
          setIsSearching(false);
        }
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") {
          // Expected cancellation: newer query supersedes this request
          return;
        }
        if (requestId === lastRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    },
    [basePath, initialCategory, initialSort, initialInStockOnly]
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      setSearchQueryState(query);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce: 250ms
      debounceTimerRef.current = setTimeout(() => {
        executeSearch(query);
      }, 250);
    },
    [executeSearch]
  );

  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    lastRequestIdRef.current += 1;
    setSearchQueryState("");
    setIsSearching(false);
    setLiveProducts(null);
    setLiveTotalCount(null);
    setHasSearched(false);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("q");
      params.delete("page");
      if (params.get("sort") === "relevance") {
        params.delete("sort");
      }
      const qs = params.toString();
      window.history.replaceState(null, "", `${basePath}${qs ? `?${qs}` : ""}`);
    }
  }, [basePath]);

  const commitSearch = useCallback(
    (queryToCommit?: string) => {
      const q = queryToCommit !== undefined ? queryToCommit : searchQuery;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Immediately execute search
      executeSearch(q);

      // Commit to browser history
      const params = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();

      if (q.trim()) {
        params.set("q", q.trim());
      } else {
        params.delete("q");
        if (params.get("sort") === "relevance") params.delete("sort");
      }
      if (initialCategory && !params.has("category")) {
        params.set("category", initialCategory);
      }
      params.delete("page");
      const qs = params.toString();
      router.push(`${basePath}${qs ? `?${qs}` : ""}`);
    },
    [basePath, executeSearch, initialCategory, router, searchQuery]
  );

  return (
    <ProductSearchContext.Provider
      value={{
        basePath,
        variant,
        searchQuery,
        setSearchQuery,
        isSearching,
        liveProducts,
        liveTotalCount,
        hasSearched,
        clearSearch,
        commitSearch,
        activeCategory: initialCategory,
        activeSort: initialSort,
        inStockOnly: initialInStockOnly,
      }}
    >
      {children}
    </ProductSearchContext.Provider>
  );
}

export function useProductSearchOptional(): ProductSearchContextValue | null {
  return useContext(ProductSearchContext);
}

export function useProductSearch(): ProductSearchContextValue {
  const context = useContext(ProductSearchContext);
  if (!context) {
    throw new Error("useProductSearch must be used within a ProductSearchProvider");
  }
  return context;
}
