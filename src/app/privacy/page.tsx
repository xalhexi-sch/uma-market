import type { Metadata } from "next";
import Link from "next/link";
import {
  RiShieldCheckLine,
  RiArrowLeftLine,
  RiLockLine,
  RiInformationLine,
  RiDatabase2Line,
  RiUserSharedLine,
  RiMailLine,
} from "@remixicon/react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Privacy Notice — ${APP_NAME}`,
  description:
    "Information regarding data handling, counterparty visibility, and infrastructure processors for the UMA Market agricultural procurement pilot in Butuan City.",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketplaceHeader activeRoute="privacy" />

      <main className="flex-1">
        {/* Editorial Header */}
        <section className="border-b border-border/60 bg-muted/20 py-12 sm:py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <RiArrowLeftLine className="size-3.5" />
              Back to Marketplace
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Trust &amp; Governance
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground">
                Last updated: September 2026
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Privacy Notice
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              This notice outlines what information is collected, why it is processed, and how data is handled across the UMA Market agricultural procurement platform in Butuan City.
            </p>
          </div>
        </section>

        {/* Content Body */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-12">
            {/* Pilot Disclaimer Box */}
            <div className="rounded-xl border border-border/80 bg-muted/30 p-5 text-sm sm:text-base leading-relaxed text-muted-foreground">
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <RiInformationLine className="size-4" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    Academic &amp; Pilot Research Scope
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                    {APP_NAME} operates as an active pilot and academic capstone project connecting agricultural producers in Butuan City with local commercial food buyers. The platform is designed around strict data minimization and purposeful trade operations rather than commercial advertising. It is not an enterprise commercial entity with formal third-party regulatory compliance certifications.
                  </p>
                </div>
              </div>
            </div>

            {/* 1. Information We Collect */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">01.</span>
                Information Processed on UMA Market
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                UMA Market processes only the categories of information strictly necessary to facilitate verified wholesale transactions, establish counterparty trust, and coordinate delivery or pickup:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <RiLockLine className="size-4 text-primary" />
                    Account &amp; Authentication
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    User identity is managed via Clerk. We process your email address, securely hashed credentials, Google OAuth profile identifiers (if used for sign-in), and role assignment (Farmer, Commercial Buyer, or Administrator).
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <RiUserSharedLine className="size-4 text-primary" />
                    Participant Profiles
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    <strong>For Farmers:</strong> Full name, farm or cooperative business name, contact phone number, physical farm location, city, growing description, and optional profile photo.<br />
                    <strong>For Buyers:</strong> Contact representative name, registered food business name, contact phone number, commercial delivery address, and city.
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <RiDatabase2Line className="size-4 text-primary" />
                    Produce Listings &amp; Media
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Crop varieties, category classification, unit pricing (₱ per kg, bundle, sack, etc.), available batch quantities, minimum order quantities (MOQs), harvest dates, and produce photographs uploaded by growers.
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <RiShieldCheckLine className="size-4 text-primary" />
                    Orders &amp; Communications
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Order items, pricing snapshots, fulfillment method (Farm Pickup or Seller Delivery), pickup schedule, delivery instructions, cancellation reasons, and order-threaded chat messages between counterparties.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. What We Do NOT Collect */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">02.</span>
                What We Do Not Collect
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                To maintain a safe and transparent marketplace, UMA deliberately limits data collection:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground pl-2">
                <li><strong>No Online Payment Data:</strong> UMA Market does not process credit cards, e-wallet credentials, or bank account numbers. Financial settlement is performed directly between buyer and grower upon fulfillment.</li>
                <li><strong>No Non-Essential Tracking Cookies:</strong> UMA Market does not deploy advertising trackers, behavioral marketing cookies, or third-party profiling scripts. The platform utilizes only strictly necessary authentication and session cookies operated by Clerk to securely authenticate participants and manage active sessions.</li>
                <li><strong>No Automated Location Tracking:</strong> We do not collect background GPS coordinates or automated device tracking data.</li>
              </ul>
            </div>

            {/* 3. Purpose of Processing */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">03.</span>
                How Information Is Used
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                Data collected on the platform is utilized strictly for marketplace functionality:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground pl-2">
                <li>Authorizing role-based access across Buyer, Farmer, and Admin interfaces.</li>
                <li>Enabling commercial buyers to browse live Butuan harvests and place wholesale orders.</li>
                <li>Enabling farmers to receive committed orders, manage harvest inventory, and coordinate delivery.</li>
                <li>Displaying the <strong>✓ Verified Producer</strong> trust badge after administrative validation.</li>
                <li>Transmitting necessary logistical information (such as delivery address or pickup notes) to the fulfilling counterparty.</li>
                <li>Preserving an auditable order log for platform moderation and dispute investigation.</li>
              </ul>
            </div>

            {/* 4. Counterparty Visibility & Data Sharing */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">04.</span>
                Counterparty Visibility &amp; Data Sharing
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                UMA Market is a direct trade facilitator. When you place or accept an order:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground pl-2">
                <li><strong>Public Marketplace:</strong> Anyone browsing the marketplace can view active produce listings, unit prices, available volumes, and the producer&apos;s business name, city, and verified badge. Personal telephone numbers and physical farm street addresses are <em>never</em> published to anonymous visitors.</li>
                <li><strong>Confirmed Order Counterparties:</strong> Once an order is submitted, the fulfilling farmer receives the buyer&apos;s business name, contact person, phone number, and delivery address. The buyer receives the farmer&apos;s contact phone number and pickup location notes for direct coordination.</li>
                <li><strong>No Commercial Sale of Data:</strong> We never sell, rent, or monetize participant information with third-party brokers or advertisers.</li>
              </ul>
            </div>

            {/* 5. Infrastructure & Sub-Processors */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">05.</span>
                Technical Infrastructure &amp; Processors
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                The platform relies on the following infrastructure providers to host and secure application data:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="font-semibold text-foreground text-sm">Clerk Inc.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Authentication provider. Manages user identities, secure passwords, session tokens, and account authentication.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="font-semibold text-foreground text-sm">Supabase Inc.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Database and storage provider. Hosts our PostgreSQL database, executes Row-Level Security policies, and stores produce images.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="font-semibold text-foreground text-sm">Vercel Inc.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Application hosting and edge compute provider. Serves Next.js server components and user interfaces.
                  </p>
                </div>
              </div>
            </div>

            {/* 6. Security & Access Safeguards */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">06.</span>
                Security &amp; Access Controls
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                Application data is protected through database-level access controls:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground pl-2">
                <li><strong>Row-Level Security (RLS):</strong> PostgreSQL security policies enforce that buyers can only view their own cart, orders, and messages. Farmers can only view orders and messages directed to their farm.</li>
                <li><strong>Role Route Guards:</strong> Dashboard pages enforce strict session validation and redirect unauthorized cross-role attempts.</li>
                <li><strong>Atomic Transactions:</strong> Order placements and inventory changes execute in single atomic database routines, preventing inventory inconsistencies.</li>
              </ul>
            </div>

            {/* 7. User Choices & Data Inquiries */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">07.</span>
                User Controls &amp; Inquiries
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                Registered participants maintain control over their profile data:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground pl-2">
                <li>You may review and update your contact person, business name, phone number, and address at any time in your profile settings.</li>
                <li>Growers can archive or edit their produce listings at any time through the product management dashboard.</li>
                <li>To request account deletion or inquire about data stored during this pilot phase, contact the project operators below.</li>
              </ul>

              <div className="mt-6 rounded-xl border border-border/80 bg-muted/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                    <RiMailLine className="size-4 text-primary" />
                    Data Inquiries &amp; Pilot Contact
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    For questions regarding your data or this policy notice:
                  </p>
                </div>
                <div className="text-xs font-mono bg-card px-3 py-1.5 rounded-md border border-border text-foreground">
                  contact:{" "}
                  <a
                    href="mailto:michael.banas@urios.edu.ph"
                    className="underline decoration-border underline-offset-2 transition-colors hover:text-primary hover:decoration-primary"
                  >
                    michael.banas@urios.edu.ph
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketplaceFooter />
    </div>
  );
}
