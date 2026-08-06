# UI screenshots

Captured by driving the running app with Playwright on 2026-08-07, against the
seeded development catalogue (4 categories, 6 products). No product images have
been uploaded yet, which is why image areas render as light placeholders.

| File | What it shows |
|---|---|
| `01-homepage-cookie-banner` | Cookie consent on first visit |
| `02-homepage-full` | Homepage — hero, featured grid, categories, trust signals, footer |
| `03-homepage-english` | Same page at `/en` |
| `04-products-listing` | Catalogue with filter sidebar |
| `05-products-filtered` | Category filter applied |
| `06-categories` / `07-category-detail` | Category index and detail |
| `08-product-detail` | Product page with bulk-pricing table |
| `09-product-tier-active` | Quantity stepper with live unit price |
| `29-tier-highlight-fixed` | Active tier row highlighted (bug fixed) |
| `10-added-to-cart` | Cart badge after adding |
| `11-cart` / `12-cart-multiple` | Cart with one and two lines |
| `13-checkout` | Checkout form and order summary |
| `14-checkout-filled` | Completed form |
| `15-checkout-validation` | Server-side validation error |
| `16-order-confirmation` | Confirmation for order KC-2026-00001 |
| `17-legal-withdrawal` | Withdrawal page with the EU-mandated electronic form |
| `18-contact` | Contact page |
| `19-mobile-homepage`, `20-mobile-nav`, `21-mobile-product` | 375px viewport |
| `22-admin-login` … `28-admin-settings` | Payload admin |

Regenerate by starting `pnpm dev` and re-running the QA script.
