import type { Metadata } from "next";
import Link from "next/link";
import {
  RiArrowLeftLine,
  RiInformationLine,
  RiStore2Line,
  RiPlantLine,
  RiTruckLine,
  RiMailLine,
} from "@remixicon/react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Terms of Service — ${APP_NAME}`,
  description:
    "Operating rules, counterparty commitments, fulfillment guidelines, and platform limitations for participants in the UMA Market agricultural procurement pilot in Butuan City.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketplaceHeader activeRoute="terms" />

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
                Platform Policy &amp; Agreement
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground">
                Last updated: September 2026
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Terms of Service
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Operating rules, transaction commitments, and fulfillment responsibilities for agricultural growers and commercial buyers using {APP_NAME} in Butuan City.
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
                    Direct Marketplace Facilitation Scope
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                    {APP_NAME} is an agricultural procurement platform designed to facilitate direct discovery, structured ordering, and fulfillment communication between local producers and commercial food buyers. {APP_NAME} is not an intermediary produce reseller, trucking broker, or online payment gateway.
                  </p>
                </div>
              </div>
            </div>

            {/* 1. Platform Purpose & Scope */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">01.</span>
                Platform Nature &amp; Scope
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                {APP_NAME} provides software infrastructure to connect two primary commercial groups in Butuan City and surrounding agricultural areas:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <RiPlantLine className="size-4 text-primary" />
                    For Local Producers (Farmers)
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Legitimate agricultural growers and cooperatives listing harvested or upcoming produce at direct farm-gate prices, setting batch quantities, and managing wholesale fulfillment directly with local businesses.
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <RiStore2Line className="size-4 text-primary" />
                    For Commercial Buyers
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Registered food businesses, restaurants, school canteens, catering services, hotels, and retail grocers sourcing authentic local produce with clear availability and direct communication.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Account Eligibility & Verification */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">02.</span>
                Account Eligibility &amp; Verification
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                To maintain marketplace integrity:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground pl-2">
                <li>Participants must register with authentic contact details, including a valid business or farm name, contact phone number, and physical operating location in or near Butuan City.</li>
                <li>Accounts select an unchangeable primary operating role (Farmer or Commercial Buyer) upon onboarding to maintain role-separated workflows and data integrity.</li>
                <li>Growers who complete administrative inspection are granted the <strong>✓ Verified Producer</strong> trust badge. Verification represents administrative confirmation of producer identity and location; it does not constitute an endorsement or warranty of individual harvest batches.</li>
              </ul>
            </div>

            {/* 3. Produce Listings & Pricing */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">03.</span>
                Listings, Pricing &amp; Inventory Accuracy
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                Producers are solely responsible for the information published in their produce listings:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground pl-2">
                <li><strong>Farm-Gate Pricing:</strong> Prices displayed are set independently by the grower per unit (₱ per kg, bundle, sack, etc.). UMA does not dictate prices or add unannounced buyer commissions.</li>
                <li><strong>Accurate Stock &amp; MOQs:</strong> Listings must represent actual available harvest volumes. Growers set minimum order quantities (MOQs) to ensure commercial viability.</li>
                <li><strong>Listing Moderation:</strong> Platform administrators reserve the authority to archive or suspend listings that contain inaccurate pricing, fictitious inventory, or inappropriate imagery.</li>
              </ul>
            </div>

            {/* 4. Ordering & Wholesale Commitments */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">04.</span>
                Orders &amp; Wholesale Commitments
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                When a commercial buyer submits an order through UMA Market:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground pl-2">
                <li>Placing an order constitutes a commercial commitment to purchase the requested produce from the designated grower under the stated terms.</li>
                <li>If a shopping cart contains produce from multiple growers, the checkout process atomically splits the transaction into separate orders for each independent farm.</li>
                <li>Each order creates an independent contract between the buyer and that specific grower. A delay or cancellation with one grower does not affect orders placed with other growers.</li>
              </ul>
            </div>

            {/* 5. Fulfillment & Direct Logistics */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">05.</span>
                Fulfillment Methods &amp; Logistics
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                UMA Market supports two explicit fulfillment methods selected at checkout:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                    <RiPlantLine className="size-4 text-primary" />
                    Farm Pickup
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    The buyer is responsible for collecting the order directly from the producer&apos;s farm or designated aggregation site at the agreed pickup date and time.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                    <RiTruckLine className="size-4 text-primary" />
                    Seller Delivery
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    The fulfilling producer coordinates commercial transport directly to the buyer&apos;s registered commercial establishment in Butuan City.
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                UMA does not manage courier fleets, live GPS drivers, or shipping insurance. Delivery timing, vehicle coordination, and access notes must be communicated directly between counterparties via the in-app chat.
              </p>
            </div>

            {/* 6. Payment & Financial Settlement */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">06.</span>
                Financial Settlement
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                In this pilot version of UMA Market:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground pl-2">
                <li><strong>Direct Counterparty Settlement:</strong> UMA Market does not process digital payments, hold escrow funds, or collect transaction fees.</li>
                <li><strong>Direct Settlement Arrangements (No UMA Payment Processing):</strong> Payment methods—including Cash on Delivery (COD), direct bank transfer, or commercial invoice terms—are direct settlement arrangements agreed upon and executed solely between the commercial buyer and the agricultural producer. UMA Market does not process payments, handle or hold transaction funds, act as a billing intermediary, or provide payment collection services.</li>
                <li><strong>Pricing Accuracy:</strong> Buyers are expected to pay the farm-gate unit prices confirmed at the time of order placement. Growers may not alter unit prices after an order has been accepted.</li>
              </ul>
            </div>

            {/* 7. Status Progression & Cancellations */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">07.</span>
                Status Progression &amp; Cancellations
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                Orders advance through structured milestones: <em>Pending → Accepted → Preparing → Ready → (For Delivery) → Completed</em>.
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground pl-2">
                <li><strong>Buyer Cancellation:</strong> Buyers may self-cancel an order strictly while its status remains <strong>Pending</strong>. Once a grower accepts an order and begins harvest preparation, cancellation requires direct counterparty agreement.</li>
                <li><strong>Farmer Cancellation:</strong> A grower may decline or cancel an order prior to completion due to sudden weather events, crop damage, or unforeseen supply constraints, provided they state a clear cancellation reason.</li>
                <li><strong>Automatic Inventory Restitution:</strong> Whenever an order is cancelled in the system, reserved produce volume is automatically returned to the grower&apos;s available catalog stock.</li>
              </ul>
            </div>

            {/* 8. Acceptable Use & Messaging */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">08.</span>
                Communications &amp; Acceptable Use
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                The order communications tool is provided exclusively for trade coordination:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground pl-2">
                <li>Participants must communicate professionally regarding order details, specifications, packaging, delivery updates, and pickup schedules.</li>
                <li>Spamming, harassment, abusive language, fraudulent representations, and off-platform solicitation designed to circumvent marketplace commitments are grounds for immediate account suspension.</li>
              </ul>
            </div>

            {/* 9. Limitations & Disclaimers */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">09.</span>
                Platform Role &amp; Disclaimers
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                {APP_NAME} is offered as a localized agricultural pilot on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground pl-2">
                <li><strong>Agricultural Unpredictability:</strong> Weather events, seasonal pest pressures, and harvest variances can affect produce quality and yield. UMA is not liable for crop failure or force majeure events.</li>
                <li><strong>Counterparty Performance:</strong> While UMA provides trust verification tools, UMA does not guarantee the solvency of buyers or the commercial performance of growers. Counterparties enter wholesale agreements at their own commercial discretion.</li>
              </ul>
            </div>

            {/* 10. Modifications & Contact */}
            <div className="border-t border-border/60 pt-8 space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                <span className="text-primary font-mono text-lg">10.</span>
                Modifications &amp; Contact Information
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                These terms may be updated as the pilot evolves based on field feedback from Butuan farmers and commercial buyers. Continued use of the platform constitutes acceptance of updated terms.
              </p>

              <div className="mt-6 rounded-xl border border-border/80 bg-muted/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                    <RiMailLine className="size-4 text-primary" />
                    Pilot Policy &amp; Terms Inquiries
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    For questions regarding these terms or pilot operations:
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
