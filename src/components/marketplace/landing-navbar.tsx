"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { RiArrowRightLine, RiMenuLine } from "@remixicon/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { APP_NAME } from "@/lib/constants";

interface LandingNavbarProps {
  isAuthenticated: boolean;
  dashboardHref: string;
}

export function LandingNavbar({ isAuthenticated, dashboardHref }: LandingNavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 20);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Market", href: "/products" },
    { label: "How it works", href: "/#how" },
    { label: "For growers", href: "/#growers" },
  ];

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 w-full z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-background/95 backdrop-blur-md border-b border-border/60 shadow-xs py-3"
            : "bg-transparent border-b border-transparent py-4 sm:py-5"
        }`}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo — Always perfectly visible in both transparent and solid states */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/brand/icon/uma-icon-512.png"
              alt="UMA Market"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg shadow-xs shrink-0 transition-transform group-hover:scale-105"
              priority
            />
            <span
              className={`text-base font-bold tracking-tight transition-colors duration-200 ${
                isScrolled
                  ? "text-foreground"
                  : "text-white drop-shadow-xs"
              }`}
            >
              {APP_NAME}
            </span>
          </Link>

          {/* Center Nav: Market, How it works, For growers */}
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  isScrolled
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-white/85 hover:text-white drop-shadow-xs"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right CTAs */}
          <div className="hidden items-center gap-4 sm:flex">
            {/* Secondary: I'm a grower */}
            <Link
              href="/#growers"
              className={`text-sm font-medium transition-colors ${
                isScrolled
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-white/85 hover:text-white drop-shadow-xs"
              }`}
            >
              I&apos;m a grower
            </Link>

            {/* Primary Action: Explore the market */}
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
            >
              Explore the market
              <RiArrowRightLine className="size-3.5" />
            </Link>

            {/* Auth State */}
            {isAuthenticated ? (
              <div className="flex items-center gap-3 pl-1 border-l border-border/40">
                <Link
                  href={dashboardHref}
                  className={`text-sm font-medium transition-colors ${
                    isScrolled
                      ? "text-foreground hover:text-primary"
                      : "text-white hover:text-emerald-300 drop-shadow-xs"
                  }`}
                >
                  Dashboard
                </Link>
                <UserButton />
              </div>
            ) : (
              <Link
                href="/sign-in"
                className={`text-sm font-medium transition-colors ${
                  isScrolled
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-white/85 hover:text-white drop-shadow-xs"
                }`}
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile Navigation Trigger */}
          <div className="flex items-center gap-2 sm:hidden">
            {isAuthenticated && <UserButton />}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
                isScrolled
                  ? "border-border text-foreground hover:bg-muted/50"
                  : "border-white/30 text-white bg-black/20 backdrop-blur-xs hover:bg-black/30"
              }`}
              aria-label="Open navigation menu"
            >
              <RiMenuLine className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[300px] p-0 flex flex-col justify-between">
          <div className="p-6">
            <SheetHeader className="flex flex-row items-center justify-between pb-6 border-b border-border/60">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5"
              >
                <Image
                  src="/brand/icon/uma-icon-512.png"
                  alt="UMA Market"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-lg shadow-xs shrink-0"
                />
                <SheetTitle className="text-base font-bold tracking-tight text-foreground">
                  {APP_NAME}
                </SheetTitle>
              </Link>
            </SheetHeader>

            {/* Mobile Nav Links */}
            <nav className="mt-6 flex flex-col gap-2">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/#growers"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              >
                I&apos;m a grower
              </Link>
            </nav>
          </div>

          {/* Mobile Footer CTAs */}
          <div className="p-6 border-t border-border/60 flex flex-col gap-3">
            {/* Primary Action */}
            <Link
              href="/products"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
            >
              Explore the market
              <RiArrowRightLine className="size-4" />
            </Link>

            {/* Auth States */}
            {isAuthenticated ? (
              <Link
                href={dashboardHref}
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center rounded-md border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                href="/sign-in"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center rounded-md border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
