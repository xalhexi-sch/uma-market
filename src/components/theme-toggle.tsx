"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { RiMoonLine, RiSunLine } from "@remixicon/react";

interface ThemeToggleProps {
  /** If the navbar is currently over the dark photo hero before scroll */
  isOverHero?: boolean;
  className?: string;
}

const emptySubscribe = () => () => {};

export function ThemeToggle({ isOverHero = false, className = "" }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Global "D" keyboard shortcut listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key repeats
      if (e.repeat) return;
      // Do not interfere with modifier keys (e.g., Ctrl+D bookmark, Cmd+D)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "d" || e.key === "D") {
        // Do not trigger if typing in inputs, textareas, or contenteditable elements
        const target = e.target as HTMLElement | null;
        if (target && "tagName" in target) {
          const tag = target.tagName?.toLowerCase();
          const isEditable =
            tag === "input" ||
            tag === "textarea" ||
            tag === "select" ||
            Boolean(target.isContentEditable) ||
            Boolean(typeof target.closest === "function" && target.closest("[contenteditable='true']"));

          if (isEditable) return;
        }

        e.preventDefault();
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resolvedTheme, setTheme]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        aria-label="Toggle theme"
        className={`size-8.5 rounded-lg flex items-center justify-center opacity-0 pointer-events-none ${className}`}
      >
        <span className="size-4" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode (D)" : "Switch to dark mode (D)"}
      aria-label={isDark ? "Switch to light mode (shortcut: D)" : "Switch to dark mode (shortcut: D)"}
      className={`group relative inline-flex size-8.5 items-center justify-center rounded-lg border transition-colors ${
        isOverHero
          ? "border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/30"
          : "border-border/70 bg-card text-foreground hover:bg-muted hover:border-border"
      } ${className}`}
    >
      {isDark ? (
        <RiSunLine className="size-4 text-amber-400 transition-transform group-hover:rotate-45" />
      ) : (
        <RiMoonLine
          className={`size-4 transition-transform group-hover:-rotate-12 ${
            isOverHero ? "text-white" : "text-foreground"
          }`}
        />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
