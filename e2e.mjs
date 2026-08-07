/**
 * End-to-end verification of the whole storefront and admin.
 *
 * A script rather than a test framework, on purpose: the project deliberately
 * carries no test suite (velocity over coverage), and adding vitest/playwright
 * config back would contradict that decision. This drives the real app against a
 * real database and reports what actually happened.
 *
 * Run:  pnpm dev   (in another shell)
 *       node e2e.mjs
 */
import { chromium } from '@playwright/test'

const B = process.env.E2E_BASE ?? 'http://localhost:3000'
const SHOTS = 'docs/screenshots'

const results = []
const check = (name, passed, detail = '') => {
  results.push({ name, passed, detail })
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
}
const section = (title) => console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`)

const browser = await chromium.launch()
const ctx = await browser.newContext({ locale: 'bg-BG', viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()

const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) pageErrors.push(m.text())
})

const text = async (sel = 'main') => (await page.locator(sel).innerText()).replace(/\s+/g, ' ')
const goto = async (path) => {
  await page.goto(B + path, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1400)
}

// ─────────────────────────────────────────────── 1. Availability
section('Availability')
for (const path of [
  '/', '/en', '/products', '/categories', '/brands', '/cart', '/checkout',
  '/orders', '/terms', '/privacy', '/cookies', '/withdrawal', '/contact', '/about',
  '/admin', '/api/health', '/robots.txt', '/sitemap.xml',
]) {
  const res = await page.request.get(B + path)
  check(`GET ${path}`, res.status() === 200, `${res.status()}`)
}

const health = await (await page.request.get(`${B}/api/health`)).json()
check('Health reports database ok', health.database === 'ok', `latency ${health.latencyMs}ms`)

// ─────────────────────────────────────────────── 2. i18n
section('Internationalisation')

/**
 * A FRESH context, deliberately.
 *
 * The availability loop above requested /en, and `page.request` shares the
 * context's cookie jar — so next-intl had already stored NEXT_LOCALE=en and was
 * correctly redirecting / to /en. The first version of this section asserted
 * "/ is always Bulgarian" and failed against correct behaviour. A returning
 * visitor's language preference is a feature, so it is now asserted explicitly
 * rather than accidentally destroyed.
 */
const freshCtx = await browser.newContext({ locale: 'bg-BG', viewport: { width: 1440, height: 1000 } })
const fresh = await freshCtx.newPage()
await fresh.goto(`${B}/`, { waitUntil: 'domcontentloaded' })
await fresh.waitForTimeout(1400)
check('Fresh visitor gets BG at / (unprefixed default)', (await fresh.locator('html').getAttribute('lang')) === 'bg')
await fresh.getByRole('button', { name: 'Приемам' }).click().catch(() => {})
await fresh.waitForTimeout(700)
check('Cookie consent dismisses', (await fresh.getByRole('dialog').count()) === 0)
await fresh.goto(`${B}/en`, { waitUntil: 'domcontentloaded' })
await fresh.waitForTimeout(1200)
check('EN at /en', (await fresh.locator('html').getAttribute('lang')) === 'en')
await fresh.goto(`${B}/`, { waitUntil: 'domcontentloaded' })
await fresh.waitForTimeout(1200)
check(
  'Returning visitor keeps their chosen language',
  fresh.url().endsWith('/en') && (await fresh.locator('html').getAttribute('lang')) === 'en',
  fresh.url(),
)
await freshCtx.close()

const bgRedirect = await page.request.get(`${B}/bg`, { maxRedirects: 0 })
check('/bg redirects to /', bgRedirect.status() === 307)

// Dismiss consent in the main context for the remaining sections.
await goto('/')
await page.getByRole('button', { name: /Приемам|Accept/ }).click().catch(() => {})
await page.waitForTimeout(600)

// ─────────────────────────────────────────────── 3. Catalogue
section('Catalogue, filtering and search')
await goto('/products')
const total = await text('h1')
check('Product listing renders', total.includes('('), total)
await goto('/products?inStock=1')
check('In-stock filter', (await text('h1')).includes('(5)'), await text('h1'))
await goto('/products?category=cleaning')
check('Category filter', (await text('h1')).includes('(2)'), await text('h1'))
await goto('/products?brand=bosch')
check('Brand filter', (await text('h1')).includes('(1)'), await text('h1'))
await goto('/products?onSale=1')
check('On-sale filter', (await text('h1')).includes('(1)'), await text('h1'))
await goto('/products?q=cleaner')
check('FTS search (EN, cross-locale)', (await text('h1')).includes('(1)'), await text('h1'))
await goto('/products?q=%D0%BF%D0%BE%D1%87%D0%B8%D1%81%D1%82')
check('FTS search (BG prefix)', (await text('h1')).includes('(1)'), await text('h1'))
await goto('/products?q=zzzznomatch')
check('No-match returns zero, not everything', (await text('h1')).includes('(0)'))
await goto('/products?min=5&max=20')
check('Price range filter', (await text('h1')).includes('('), await text('h1'))

await goto('/products')
const box = page.locator('input[role="combobox"]').first()
await box.fill('почист')
await page.waitForTimeout(1600)
check('Search autocomplete returns hits', (await page.locator('[role="option"]').count()) > 0)
await box.press('ArrowDown')
await page.waitForTimeout(300)
check('Autocomplete keyboard selection', (await page.locator('[role="option"][aria-selected="true"]').count()) === 1)

// ─────────────────────────────────────────────── 4. Pricing & discounts
section('Pricing, bulk tiers and discounts')
await goto('/products/universalen-pochistvasht-preparat-1l')
check('Tier table renders', (await page.locator('table tbody tr').count()) === 3)
const priceEl = page.locator('span').filter({ hasText: /^× .* за брой$/ }).first()
const prices = {}
for (const q of ['1', '10', '50']) {
  await page.locator('#quantity').fill(q)
  await page.waitForTimeout(400)
  prices[q] = (await priceEl.textContent())?.trim()
}
check('Unit price falls at tier 10', prices['1'] !== prices['10'], `${prices['1']} → ${prices['10']}`)
check('Unit price falls again at tier 50', prices['10'] !== prices['50'], `→ ${prices['50']}`)
await page.locator('#quantity').fill('10')
await page.waitForTimeout(400)
check('Active tier row highlighted', (await page.locator('tr[aria-current="true"]').count()) === 1)
const detail = await text()
check('Sale price shown', detail.includes('3,60'))
check('30-day reference struck through', (await page.locator('s').count()) > 0, await page.locator('s').first().textContent())
await goto('/products?onSale=1')
check('Reference price on listing cards', (await page.locator('s').count()) > 0)
check('Discount badge on cards', (await text()).includes('−'))

// ─────────────────────────────────────────────── 5. Merchandising
section('Merchandising')
await goto('/')
const home = await text()
check('Scheduled banner renders', home.includes('Есенна промоция'))
check('Sale section on homepage', home.includes('Промоции'))
check('Categories section', home.includes('Категории'))
check('Trust signals', home.includes('Наложен платеж'))
await goto('/brands/sano')
check('Brand page lists its products', (await text('h1')).includes('Sano'))

// ─────────────────────────────────────────────── 6. Cart
section('Cart')
await goto('/products')
await page.locator('article button', { hasText: 'Добави в количката' }).first().click()
await page.waitForTimeout(1200)
check('Quick add does not navigate', page.url().endsWith('/products'))
const badge = await page.locator('header span').filter({ hasText: /^\d+$/ }).first().textContent().catch(() => null)
check('Cart badge updates', Boolean(badge), `count=${badge}`)
await goto('/cart')
check('Cart lists the item', (await page.locator('main li').count()) >= 1)
await page.locator('main button[aria-label="+"]').first().click()
await page.waitForTimeout(800)
check('Cart quantity increments', (await page.locator('main input[type=number]').first().inputValue()) !== '1')

await goto('/products/komplekt-otvertki-12-chasti')
await page.getByRole('button', { name: 'Добави в количката' }).click()
await page.waitForTimeout(800)
await goto('/cart')
check('Multiple products in cart', (await page.locator('main li').count()) >= 2)

// ─────────────────────────────────────────────── 7. Checkout
section('Checkout and orders')
await goto('/checkout')
await page.getByRole('button', { name: /Поръчай/ }).click()
await page.waitForTimeout(900)
check('Empty checkout rejected', !page.url().includes('confirmation'))

await page.fill('#firstName', 'Мария')
await page.fill('#lastName', 'Иванова')
await page.fill('#email', 'maria.ivanova@example.com')
await page.fill('#phone', '123')
await page.check('input[name="acceptedTerms"]')
await page.check('input[name="acceptedPrivacy"]')
await page.check('input[name="acceptedWithdrawal"]')
await page.fill('#officeCode', 'Офис Люлин 42')
await page.getByRole('button', { name: /Поръчай/ }).click()
await page.waitForTimeout(1600)
check('Invalid phone rejected server-side', (await text()).includes('валиден телефонен'))

await page.getByRole('radio', { name: /Еконт — до адрес/ }).check()
await page.waitForTimeout(500)
check('Address fields appear for to-address', await page.locator('#street').isVisible())
await page.getByRole('radio', { name: /Еконт — до офис/ }).check()
await page.waitForTimeout(500)
await page.fill('#officeCode', 'Офис Люлин 42')
await page.fill('#phone', '+359 88 555 1234')
await page.fill('#coupon', 'SPRING10')
await page.getByRole('button', { name: /Поръчай/ }).click()
await page.waitForURL('**/confirmation**', { timeout: 25000 }).catch(() => {})

const placed = page.url().includes('confirmation')
const orderNumber = placed ? (await page.locator('text=/KC-\\d{4}-\\d{5}/').first().textContent())?.trim() : null
check('ORDER PLACED END TO END', placed, orderNumber ?? (await text()).slice(0, 80))
await page.screenshot({ path: `${SHOTS}/50-e2e-confirmation.png`, fullPage: true })

await goto('/cart')
check('Cart cleared after order', (await text()).includes('празна'))

// ─────────────────────────────────────────────── 8. Order tracking
section('Order tracking')
await goto('/orders')
await page.fill('#lookup-order', orderNumber ?? 'KC-2026-00001')
await page.fill('#lookup-email', 'maria.ivanova@example.com')
await page.getByRole('button', { name: /Провери/ }).click()
await page.waitForTimeout(2000)
check('Order lookup with correct email', (await text()).includes(orderNumber ?? ''), orderNumber ?? '')
await page.screenshot({ path: `${SHOTS}/51-e2e-order-tracking.png`, fullPage: true })

await goto('/orders')
await page.fill('#lookup-order', orderNumber ?? 'KC-2026-00001')
await page.fill('#lookup-email', 'attacker@example.com')
await page.getByRole('button', { name: /Провери/ }).click()
await page.waitForTimeout(2000)
const wrongEmail = await text()
check('Wrong email is refused (no enumeration)', !wrongEmail.includes('Общо') && wrongEmail.includes('Не е намерена'))

// ─────────────────────────────────────────────── 9. Legal
section('Legal compliance')
for (const [path, needle] of [
  ['/terms', 'Общи условия'],
  ['/privacy', 'поверителност'],
  ['/cookies', 'бисквитки'],
  ['/withdrawal', 'отказ'],
]) {
  await goto(path)
  check(`${path} renders`, (await text('h1')).toLowerCase().includes(needle.toLowerCase()))
}
await goto('/withdrawal')
check('Electronic withdrawal form present (EU 2023/2673)', await page.locator('#orderNumber').isVisible())
await goto('/cookies')
const cookiePolicy = await text()
check('Cookie policy lists each cookie', ['NEXT_LOCALE', 'kc-cookie-consent', 'payload-token'].every((c) => cookiePolicy.includes(c)))
const footer = await text('footer')
check('Trader info in footer (Electronic Commerce Act)', footer.includes('ЕИК'))

// ─────────────────────────────────────────────── 10. Security headers
section('Security')
const res = await page.request.get(B + '/')
const h = res.headers()
check('CSP present on storefront', Boolean(h['content-security-policy']))
check('X-Frame-Options DENY', h['x-frame-options'] === 'DENY')
check('X-Content-Type-Options nosniff', h['x-content-type-options'] === 'nosniff')
check('Referrer-Policy set', Boolean(h['referrer-policy']))
const adminRes = await page.request.get(B + '/admin')
check('Admin exempt from storefront CSP', !adminRes.headers()['content-security-policy'])
const invoiceRes = await page.request.get(`${B}/api/invoice/${orderNumber ?? 'KC-2026-00001'}`)
check('Invoice requires staff auth', invoiceRes.status() === 401, `${invoiceRes.status()}`)
const exportRes = await page.request.get(`${B}/api/export/products`)
check('CSV export requires staff auth', exportRes.status() === 401, `${exportRes.status()}`)
const ordersApi = await page.request.get(`${B}/api/orders`)
check('Orders API not publicly readable', ordersApi.status() === 403 || ordersApi.status() === 401, `${ordersApi.status()}`)
const couponsApi = await page.request.get(`${B}/api/coupons`)
check('Coupons API not publicly readable', couponsApi.status() === 403 || couponsApi.status() === 401, `${couponsApi.status()}`)

// ─────────────────────────────────────────────── 11. SEO
section('SEO')
const sitemap = await (await page.request.get(`${B}/sitemap.xml`)).text()
check('Sitemap contains products', sitemap.includes('/products/'))
check('Sitemap has hreflang alternates', sitemap.includes('hreflang="en"'))
const robots = await (await page.request.get(`${B}/robots.txt`)).text()
check('robots.txt disallows /admin', robots.includes('Disallow: /admin'))
check('robots.txt references sitemap', robots.includes('sitemap.xml'))
await goto('/products/universalen-pochistvasht-preparat-1l')
const ld = await page.locator('script[type="application/ld+json"]').first().textContent()
check('Product JSON-LD present', Boolean(ld && JSON.parse(ld)['@type'] === 'Product'))

// ─────────────────────────────────────────────── 12. Mobile & a11y
section('Mobile and accessibility')
const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'bg-BG' })
const m = await mobile.newPage()
await m.goto(B, { waitUntil: 'domcontentloaded' })
await m.getByRole('button', { name: 'Приемам' }).click().catch(() => {})
await m.waitForTimeout(1400)
check('No horizontal overflow at 375px', !(await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)))
await m.getByRole('button', { name: 'Отвори менюто' }).click()
await m.waitForTimeout(600)
check('Mobile nav drawer opens', await m.locator('dialog nav').isVisible())
await m.keyboard.press('Escape')
await m.waitForTimeout(400)
check('Drawer closes on Escape (native dialog)', !(await m.locator('dialog nav').isVisible().catch(() => false)))
await m.screenshot({ path: `${SHOTS}/52-e2e-mobile.png`, fullPage: true })
await mobile.close()

await goto('/')
const skip = await page.locator('a[href="#main"]').count()
check('Skip-to-content link present', skip > 0)
const imgsWithoutAlt = await page.locator('img:not([alt])').count()
check('All images have alt attributes', imgsWithoutAlt === 0, `${imgsWithoutAlt} missing`)

// ─────────────────────────────────────────────── Summary
section('Summary')
check('No browser console or page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed)
console.log(`\n${passed}/${results.length} checks passed`)
if (failed.length) {
  console.log('\nFAILURES:')
  failed.forEach((f) => console.log(`  · ${f.name}  ${f.detail}`))
}

await browser.close()
process.exit(failed.length === 0 ? 0 : 1)
