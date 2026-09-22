# UMA Market Decisions

## Authentication
Clerk is the authentication provider.

## Database
Supabase PostgreSQL.

## Authorization
Resource-level authorization + Supabase RLS.
proxy.ts does not contain role authorization.

## Roles
Farmer / Business / Admin.

## Fulfillment
Pickup / Seller Delivery.

## Orders
One order per farmer when cart contains products from multiple farmers.

## Payments
Not in MVP.

## Courier system
Not in MVP.

## Product images
Supabase Storage later.