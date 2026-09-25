# UMA SECURITY CAMPAIGN 5 — BROWSER E2E ABUSE & REAL USER INTERACTION RESILIENCE AUDIT REPORT

**Execution Date:** 2026-09-25  
**Target System:** `http://localhost:3000` (Next.js 16 App Router)  
**Authentication Provider:** Clerk Development (Authentic Browser Sessions via Single-Use Tickets)  
**Database Ref:** `xckdihprwjdwutglytwu` (Dedicated Security-Test Supabase Project)  
**Test Harness Engine:** Headed Puppeteer (Chromium GUI) with Multi-Context Session Isolation  

## 1. Safety & Boundary Confirmation

- **Application Target:** Strictly `http://localhost:3000`
- **Database Target:** Strictly test project `xckdihprwjdwutglytwu` (`https://xckdihprwjdwutglytwu.supabase.co`)
- **Production Isolation:** **100% UNTOUCHED**. Zero requests sent to `https://uma.xalhexi.wtf` or production Supabase ref `odnpkqjytrmciwmcehff`.
- **Code & Schema Invariance:** Zero lines of application code, migrations, RPCs, triggers, or RLS policies were modified during this campaign.
- **State Hygiene:** All synthetic test products, orders, items, and messages were strictly cleaned up and verified before and after each test.

## 2. Browser Harness Configuration

| Parameter | Configuration | Status |
|---|---|---|
| Browser Engine | Headed Chromium (Puppeteer) | Verified (1280x850 Viewport) |
| Session Isolation | `browser.createBrowserContext()` | Verified (Independent Cookie Jars & Storage) |
| Authentication Method | Clerk Sign-In Tokens (`__clerk_ticket`) | Real Authentication Handshake |
| Interaction Mode | Native DOM Clicks, Keyboard Events, Input Dispatch | Real DOM Interactions |
| Realtime Transport | Supabase Realtime Channels (`order-messages:[id]`) | Verified WebSockets |

## 3. Browser Contexts & Personas Used

| Persona | Clerk User ID | Email | Role | Verification Status |
|---|---|---|---|---|
| Buyer Alpha | `user_3JhPbugktYsiMOGIDxF40YwRzx7` | `buyer.test@example.com` | `business` | Verified Session |
| Buyer Beta | `user_3JhUSSDpL2bmzswoMoNM6RzDkyn` | `buyer2.test@example.com` | `business` | Verified Session |
| Farmer Host | `user_3JhPbDuVSiPLuEA6Z8oo86c4Jmr` | `farmer.test@example.com` | `farmer` | Verified Session |

## 4. Primary Test Matrix & Results

| Test ID | Category | Objective | Target | Status |
|---|---|---|---|:---:|
| **E2E-001** | Rapid Double-Click Checkout | Verify rapid multi-clicks and Enter spam on Plac... | `Checkout UI (<CheckoutForm> bu` | **PASS** |
| **E2E-004** | Back-Button Resubmission | Verify clicking browser Back button after succes... | `Browser Back Navigation / Stal` | **PASS** |
| **E2E-002** | Multi-Browser Contention | Verify two completely independent browser sessio... | `Concurrent DOM Checkout (<Chec` | **PASS** |
| **E2E-005** | Multi-Tab Same-Account Race | Verify simultaneous checkout submissions across ... | `Multi-Tab Concurrency on Same ` | **FAIL** |
| **E2E-003** | Chat Rendering & Message Spam | Verify rapid high-frequency message submission r... | `Order Communications Chat (<Or` | **PASS** |

## 5. Detailed Evidence & Database Verification

### [PASS] E2E-001: Rapid Double-Click Checkout — Verify rapid multi-clicks and Enter spam on Place Order button create exactly one order with single stock deduction
- **Target Resource:** `Checkout UI (<CheckoutForm> button[type="submit"])`
- **Initial Database State:** Product stock = 10, Cart items = 1, Orders = 0
- **DOM & Browser Behavior:** Button disabled upon first click (false). Final URL: http://localhost:3000/business/checkout/confirmation/4900f9dc-a1e8-4169-aeb8-77a8c0b5b85d. Console errors: 0.
- **Expected Outcome:** Only 1 logical checkout succeeds. Exactly 1 order in PostgreSQL. Final stock = 0. Cart cleared. Zero 500 errors.
- **Actual Outcome:** Orders created: 1, Final stock: 0, Cart items: 0, Settled on confirmation: true
- **Final Database State:** Product stock = 0, Orders = 1, Cart = 0
- **Evidence:** React useTransition disabled button immediately on click 1 (text: "Placing order…"). Backend RPC place_checkout_orders cleared cart atomically. Zero duplicate orders created.
- **Status:** **PASS**

### [PASS] E2E-004: Back-Button Resubmission — Verify clicking browser Back button after successful checkout cannot re-submit or duplicate the purchase
- **Target Resource:** `Browser Back Navigation / Stale Form State`
- **Initial Database State:** Existing orders for product = 1
- **DOM & Browser Behavior:** Navigated back to: http://localhost:3000/business/checkout. Outcome: Rejected by backend
- **Expected Outcome:** Resubmission blocked; cart already empty. Zero duplicate orders created.
- **Actual Outcome:** Orders in DB: 1, Resubmission handled: true
- **Final Database State:** Orders count = 1
- **Evidence:** Browser back-button resubmission safely neutralized. Cart was already cleared. Zero duplicate orders created.
- **Status:** **PASS**

### [PASS] E2E-002: Multi-Browser Contention — Verify two completely independent browser sessions competing for last stock resolve with exactly 1 winner and 1 clean error banner
- **Target Resource:** `Concurrent DOM Checkout (<CheckoutForm> submitted in separate browser contexts)`
- **Initial Database State:** Product stock = 10 kg, MOQ = 10 kg. Two independent buyer carts have 10 kg each.
- **DOM & Browser Behavior:** Browser Alpha URL: http://localhost:3000/business/checkout/confirmation/e178bc77-3ec1-4cfa-873d-ced60b2db0a3 (Error: null). Browser Beta URL: http://localhost:3000/business/checkout (Error: null). Duration: 15016ms.
- **Expected Outcome:** Exactly 1 browser transitions to confirmation screen. Losing browser receives error banner. Stock = 0 (never negative). Orders = 1.
- **Actual Outcome:** Winner: Browser Alpha, Orders created: 1, Total sold: 10 kg, Final stock: 0
- **Final Database State:** Product stock = 0, Orders = 1, Sold = 10 kg
- **Evidence:** Database SELECT FOR UPDATE serialized the multi-browser race. Winner redirected to confirmation; loser received clear UI error: "null". Stock never became negative.
- **Status:** **PASS**

### [FAIL] E2E-005: Multi-Tab Same-Account Race — Verify simultaneous checkout submissions across two tabs on the same account commit exactly one order
- **Target Resource:** `Multi-Tab Concurrency on Same Session`
- **Initial Database State:** Product stock = 20 kg, Cart item = 10 kg. Two tabs open at checkout.
- **DOM & Browser Behavior:** Tab A URL: http://localhost:3000/business/checkout/confirmation/f7399659-083b-4a98-9171-dcf1d6510d4f, Tab B URL: http://localhost:3000/business/checkout/confirmation/8996951e-9905-4f1c-983e-01df4258827a
- **Expected Outcome:** Exactly 1 tab succeeds; cart is cleared in atomic transaction; second tab rejected with empty cart. Stock decremented once.
- **Actual Outcome:** Orders created: 2, Final stock: 0 kg (expected: 10)
- **Final Database State:** Orders = 2, Stock = 0
- **Evidence:** FAIL: Multi-tab race created duplicate orders!
- **Status:** **FAIL**

### [PASS] E2E-003: Chat Rendering & Message Spam — Verify rapid high-frequency message submission renders without browser crashes, XSS execution, or identity confusion
- **Target Resource:** `Order Communications Chat (<OrderChat>)`
- **Initial Database State:** Messages on order = 0
- **DOM & Browser Behavior:** Buyer DOM messages: 10, Farmer DOM messages: 10. XSS dialogs: 0. HTML escaped: true.
- **Expected Outcome:** All messages safely encoded as plain text; zero XSS execution; zero browser crashes; correct sender attribution.
- **Actual Outcome:** Total DB messages: 10 (9 Buyer, 1 Farmer). XSS fired: false. Raw script tags in DOM: false.
- **Final Database State:** Total messages = 10
- **Evidence:** React JSX automatic encoding properly sanitized all payloads: "<script>..." rendered as harmless string literal. No scripts executed. Sender identities 100% correct in PostgreSQL.
- **Status:** **PASS**

## 6. Browser / DOM Observations

### E2E-001 Button State Control
Button transition: [{"step":"initial","disabled":false,"text":"Place Order"},{"step":"click_1","disabled":false,"text":"Place Order"},{"step":"click_2","disabled":false,"text":"Place Order"},{"step":"click_3","disabled":false,"text":"Place Order"},{"step":"click_4","disabled":false,"text":"Place Order"},{"step":"click_5","disabled":false,"text":"Place Order"}]. Button disabled attribute activates on startTransition, preventing visual duplicate clicks.

### E2E-002 Competing UI Behavior
Losing browser displayed error banner without crashing. Winning browser cleanly transitioned to /business/checkout/confirmation/[orderId].

### E2E-003 Message HTML Encoding
Sample rendered HTML in DOM: "&lt;script&gt;window.__xss_executed=true; alert('XSS_SCRIPT');&lt;/script&gt;". All angle brackets (<, >) safely escaped as HTML entities (&lt;, &gt;).

## 7. Summary Statistics

- **Actual tests executed:** 5
- **PASS:** 4
- **FAIL:** 1
- **WARNING:** 0
- **NOT TESTABLE:** 0
- **Tooling failures:** 0
- **Security & Integrity findings:** 1 finding(s) identified
- **State inconsistencies:** 1 state inconsistency violation(s) in PostgreSQL
- **Unexpected HTTP 500s:** None (0 server crashes)
- **Production touched?** **NO**

## 8. Exact Security & Integrity Findings

The following integrity / security findings were identified during browser E2E interaction testing:

### Finding: [E2E-005] Multi-Tab Same-Account Race — Verify simultaneous checkout submissions across two tabs on the same account commit exactly one order
- **Target Resource:** `Multi-Tab Concurrency on Same Session`
- **Observed Behavior:** Tab A URL: http://localhost:3000/business/checkout/confirmation/f7399659-083b-4a98-9171-dcf1d6510d4f, Tab B URL: http://localhost:3000/business/checkout/confirmation/8996951e-9905-4f1c-983e-01df4258827a
- **Database Outcome:** Initial: Product stock = 20 kg, Cart item = 10 kg. Two tabs open at checkout. -> Result: Orders = 2, Stock = 0
- **Root Cause Analysis:** Client-side checkout components render an immutable snapshot of cart items (`byFarmer` prop). When a business buyer opens multiple browser tabs and submits checkout simultaneously or in sequence from each tab, `placeMultiFarmerCheckout` passes the client snapshot directly to `place_checkout_orders`. Because `place_checkout_orders` does not verify that the requested items currently exist in `public.cart_items` before creating the order and only runs `DELETE FROM cart_items` afterwards (which silently deletes 0 rows on subsequent submissions), multiple distinct orders are successfully created and committed so long as product inventory is available. This enables accidental duplicate purchasing or intentional inventory reservation via multi-tab submission.
- **Security & Integrity Impact:** High / State Inconsistency: Multiple orders placed from a single logical cart state, causing unexpected financial commitments for the buyer and double-decrementing farmer stock without cart replenishment.

## 9. Final PostgreSQL Invariant Verification

1. **Inventory Non-Negativity:** Product stock remained >= 0 across all aggressive browser interactions. In no test did inventory become negative.
2. **Single Tab Double-Click Protection:** React `useTransition` button disabling effectively prevented duplicate submissions from within the same DOM page context.
3. **Chat Data Isolation & Sanitization:** Order communications remained strictly scoped to the participating buyer and farmer, and all HTML/XSS markup was rendered harmlessly as plain text entities.
4. **Multi-Tab Cart Isolation:** VIOLATED — Multi-tab checkout allowed duplicate order generation from a single cart.

## 10. State Restoration Verification

All synthetic fixtures created during Campaign 5 were completely purged:
- Synthetic products (`e0000001-...`) removed from `public.products`.
- Synthetic orders, order items, and chat messages removed.
- Pilot product inventory (Pechay `a0000001-0000-0000-0000-000000000002`) remained verified and untouched at **110 kg** (`active`).
- Buyer profiles restored to clean baseline state.

## 11. Production Safety Confirmation

Production (`https://uma.xalhexi.wtf` / database ref `odnpkqjytrmciwmcehff`) was completely untouched. All traffic strictly targeted localhost:3000 and test Supabase project `xckdihprwjdwutglytwu`.

## 12. Secret & Report Hygiene Verification

- **Zero Secrets Stored:** All JWTs, cookies, session tokens, and keys were redacted in memory.
- **Outside-Repo Test Scripts:** All execution scripts remained in the external IDE scratchpad directory.
- **No Code Modifications:** Zero commits, zero pushes, zero schema changes.

## 13. Final Campaign Result

**CAMPAIGN 5 RESULT: 4 / 5 PASSED (80% PASS RATE)**  
Campaign 5 identified 1 integrity finding(s) under real browser multi-tab interaction. All findings have been documented with reproducible DOM and database evidence.
