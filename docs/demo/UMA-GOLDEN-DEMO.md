# UMA Market — Golden Demo Guide

This document outlines the standard, repeatable **Golden Demo** scenario for **UMA Market** (`https://uma.xalhexi.wtf` / `http://localhost:3000`). It is designed for live presentations, evaluations, and stakeholder walkthroughs.

> **CRITICAL PRODUCTION WARNING**  
> Development and Production share the active Supabase PostgreSQL database (`odnpkqjytrmciwmcehff.supabase.co`).  
> Strictly use the designated demo personas and demo product listed below. Never modify or delete real pilot accounts or pilot products.

---

## 1. Demo Personas & Roles

*Passwords and credentials are managed securely outside the repository. Presenters must obtain credentials through official project channels.*

| Persona / Role | Email | Display Name & Business Profile | Location & Verification |
| :--- | :--- | :--- | :--- |
| **Commercial Buyer** | `buyer.test@example.com` | **Maria Santos**<br>*Balanghai Bistro* | Butuan City Commercial Hub |
| **Agricultural Producer** | `farmer.test@example.com` | **Juan Dela Cruz**<br>*Green Valley Organic Farm* | Ampayon, Butuan City<br>**✓ Verified Producer** |
| **Platform Administrator** | `admin.test@example.com` | **UMA Platform Administrator**<br>*UMA Market Admin* | Butuan City Regional Hub |

---

## 2. Selected Demo Product

* **Product Name:** Ampayon Fresh Red Tomatoes
* **Product ID:** `03f88c0d-30c2-4be8-b45b-22c545fecf07`
* **Category:** Vegetables
* **Fulfilling Producer:** Juan Dela Cruz / *Green Valley Organic Farm* (`farmer.test@example.com`)
* **Farm-Gate Price:** `₱65.00 / kg`
* **Minimum Order Quantity (MOQ):** `2 kg`
* **Available Stock:** `200 kg` (ample buffer for rehearsal runs)
* **Demo Order Target:** `2 kg` (`₱130.00` total)

---

## 3. Step-by-Step Golden Demo Path

### Part 1: Buyer Discovery & Wholesale Order Placement

#### Step 1: Discover Produce on the Marketplace
1. Navigate to the Public Marketplace at `/products` (or `/business/products` if logged in).
2. Filter by category: click the **Vegetables** pill, or type `"Tomato"` into the search box.
3. Locate **Ampayon Fresh Red Tomatoes** by *Green Valley Organic Farm*.
4. **Expected Result:** The product card displays a photo, `₱65 / kg`, `Min. order: 2 kg`, stock status, and the green `✓ Verified Producer` badge for the grower.

#### Step 2: Inspect Product Details
1. Click the product card to navigate to `/products/03f88c0d-30c2-4be8-b45b-22c545fecf07`.
2. Notice the producer disclosure: *Green Valley Organic Farm*, Ampayon, Butuan City.
3. In the quantity input, observe that the initial minimum quantity is set to **`2`**.
4. **Expected Result:** The order summary reflects `2 kg × ₱65.00 = ₱130.00`.

#### Step 3: Add to Cart
1. Click **Add to Cart**.
2. If not already authenticated, the system prompts for sign-in. Sign in as:
   * **Account:** `buyer.test@example.com`
3. Click the Cart icon in the header navigation or go to `/business/cart`.
4. **Expected Result:** The cart displays 1 item: *Ampayon Fresh Red Tomatoes* (2 kg, ₱130.00) grouped under *Green Valley Organic Farm*.

#### Step 4: Checkout & Order Placement
1. On the cart page, click **Proceed to Checkout** (`/business/checkout`).
2. Select fulfillment method:
   * Choose **Seller Delivery** (or *Farm Pickup*).
   * Confirm the pre-filled delivery address for *Balanghai Bistro* in Butuan City.
   * *(Optional)* Add a delivery note (e.g., *"Please deliver morning service before 10 AM"*).
3. Review payment terms: Cash on Delivery / Direct counterparty settlement.
4. Click **Place Order**.
5. **Expected Result:** The order is atomically submitted and redirects to the Order Confirmation page (`/business/checkout/confirmation/[orderId]`) displaying a green confirmation banner and order summary.

---

### Part 2: Farmer Order Intake & Fulfillment Progression

#### Step 5: Farmer Sign-In & Intake
1. Open a private/incognito browser window (or switch profiles) and navigate to `/sign-in`.
2. Sign in as the producer:
   * **Account:** `farmer.test@example.com`
3. Navigate to **Incoming Orders** at `/farmer/orders`.
4. **Expected Result:** A new order appears with status badge **Pending**, customer *Balanghai Bistro*, item *Ampayon Fresh Red Tomatoes (2 kg)*, and total `₱130.00`.

#### Step 6: Accept Order
1. Click the order row to open `/farmer/orders/[id]`.
2. Review the order items, buyer contact details, and fulfillment choice.
3. Click the **Accept Order** button in the *Update Status* panel.
4. **Expected Result:** Status badge immediately transitions from `Pending` to **`Accepted`**. A success toast confirms *"Order status updated."*

#### Step 7: Progress to Preparing
1. In the *Update Status* panel, click **Mark as Preparing**.
2. **Expected Result:** Order status updates to **`Preparing`**.

#### Step 8: Mark Ready & Complete Fulfillment
* **If Seller Delivery was chosen:**
  1. Click **Out for Delivery**. Status updates to **`For Delivery`**.
  2. Click **Mark as Delivered**. Status updates to **`Completed`**.
* **If Farm Pickup was chosen:**
  1. Click **Mark as Ready**. Status updates to **`Ready`**.
  2. Click **Mark Completed (Pickup)**. Status updates to **`Completed`**.
* **Expected Result:** The order reaches the terminal milestone **`Completed`**. The inventory remains accurately reconciled.

---

### Part 3: Buyer Order Timeline & Live Tracking

#### Step 9: Verify Buyer Order Timeline
1. Switch back to the Buyer session (`buyer.test@example.com`).
2. Navigate to **My Orders** at `/business/orders` and click the demo order.
3. Inspect the order status timeline:
   * Mobile: Vertical stepped timeline.
   * Desktop: Horizontal timeline.
4. **Expected Result:** All milestone circles (*Placed → Accepted → Preparing → For Delivery → Completed*) display green completed checkmarks, confirming end-to-end order status visibility.

---

## 4. Rehearsal & Fast Reset Procedure

To practice this demo repeatedly without polluting the marketplace:

### Reset Option A (In-App Cancellation Reversal)
1. When rehearsing, the farmer or buyer can stop at `Pending` or `Accepted` and click **Decline / Cancel Order**.
2. Select a cancellation reason (e.g., *"Buyer requested cancellation"*).
3. The platform's atomic database trigger automatically restitutes the 2 kg of tomatoes back to the available catalog stock.

### Reset Option B (Leave Completed for Historical Showcase)
* Completed orders do not need manual deletion. Because `Ampayon Fresh Red Tomatoes` has 200 kg of stock, performing several 2 kg rehearsal runs consumes negligible inventory and leaves clean historical orders visible in both dashboards.

---

## 5. "Do Not Touch" Production-Sensitive Areas

To preserve database integrity and ensure production stability:

1. **DO NOT Touch Real Pilot Accounts:**
   * Never modify profiles, products, or orders associated with `michael.banas@urios.edu.ph` or actual local cooperative producers.
2. **DO NOT Run Blanket Deletions:**
   * Never execute `DELETE FROM orders` or truncate database tables.
3. **DO NOT Alter Other Product MOQs or Stock:**
   * Keep wholesale MOQs on grains (e.g., Dinorado Rice sacks) and livestock intact so the commercial catalog remains realistic.
4. **DO NOT Expose Auth Secrets:**
   * Never commit passwords, session tokens, or API keys into documentation or version control.
