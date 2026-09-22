# UMA Market — Current State

Updated: 2026-09-23

## Current Slice
Slice 2 — Business Purchase Journey + Farmer Support

## Completed
- Slice 1 foundation
- Clerk authentication
- Clerk session claims
- Supabase third-party auth
- Supabase schema
- RLS
- Landing page
- Role-based dashboards

## Current Work
Business product browsing → product detail → cart → checkout → orders

## Stack
- Next.js 16
- TypeScript
- Tailwind v4
- shadcn/ui
- Clerk
- Supabase
- PostgreSQL

## Roles
- farmer
- business
- admin

## Fulfillment
- pickup
- seller_delivery

## Important Auth Claims
- role = authenticated
- user_role = farmer/business/admin

## Current Database
profiles
categories
products
cart_items
orders
order_items
messages

## Do Not
- don't add courier role
- don't add GPS logistics
- don't replace Clerk
- don't replace Supabase
- don't put RBAC in proxy.ts