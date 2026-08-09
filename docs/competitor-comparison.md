# Comparison against fishingzone.bg

**Date:** 2026-08-09
**Why this site:** a real Bulgarian speciality retailer with a deep technical
catalogue, so it exercises the parts of e-commerce a feature checklist misses.

---

## Where we are ahead

| | Us | fishingzone.bg |
|---|---|---|
| **Stock visibility** | In stock / low stock / out of stock, on cards and detail | Not shown on listings at all |
| **Bulk/tiered pricing** | Quantity tiers with live unit price and next-tier prompts | None — single price per item |
| **30-day reference price** | Computed from a price-history ledger; the struck-through figure is the legally required one | Shows a discount %; the reference basis is not evident |
| **Order tracking without an account** | Order number + email, enumeration-safe | Requires login |
| **Accessibility** | Skip link, keyboard-reachable scroll rows, native dialogs, alt text enforced by lint | Not evidently considered |
| **Inventory integrity** | Atomic stock, movement ledger, reconciles to the balance | Unknown, but stock is not surfaced |

## Where they are ahead — real gaps

### 1. Product variants ("Варианти") — the biggest gap
Every rod has lengths, weights, and actions. They model one product with
selectable variants; we model one SKU per product, which for a catalogue like
this would mean either a dozen near-duplicate listings or losing the
distinction entirely.

**This is the single largest structural difference**, and it affects the data
model rather than the UI, so it is best done before the catalogue is loaded.

### 2. Dual currency EUR / BGN
They display `139.90 € / 273.62 лв.` throughout. Bulgaria adopted the euro on
2026-01-01 and dual display is the transition-period norm — this is the second
time it has come up, and a real competitor doing it is good evidence it is
expected rather than optional.

`formatPrice()` is already the single place this would go.

### 3. Attribute-based faceted filtering
They filter by size, model, number of sections, tip type, target species and
casting weight — attributes of the product, not just category and brand. We
filter by category, brand, price, stock, sale and featured, which is the right
foundation but stops at the point their catalogue gets useful.

Needs a product-attributes model first; the filter UI already supports
multi-select and would extend naturally.

### 4. Smaller, cheap to close
- **"Нов продукт" badge** and a "Ново" nav entry — derivable from `createdAt`
- **Per-page selector** (24 / 36 / 48 / 96)
- **Price range slider** instead of two numeric inputs
- **Sort by best-selling** — needs order-line aggregation
- **Wishlist** with a header count ("Любими")
- **Phone number and opening hours in the header** — a trust signal we lack
- **Storefront login UI** — the `Customers` collection exists; nothing surfaces it

---

## What I would do next, in order

1. **Product variants** — structural, and cheapest before the catalogue exists
2. **Dual currency** — small, and evidently expected in this market
3. **Product attributes + faceted filters** — the payoff scales with catalogue size
4. **New badge, per-page selector, header contact details** — an afternoon each
5. **Wishlist and customer account UI** — genuine value, no urgency

Deliberately *not* recommending: loyalty points, comparison tables, or
best-selling sort. All three need traffic and order history to be worth
anything, and none of it exists yet.
