import config from '@payload-config'
import { getPayload } from 'payload'

/**
 * Development seed data.
 *
 * Run with: pnpm seed
 *
 * Idempotent — it checks before inserting, so running it twice does not create
 * duplicates. It refuses to run against a database that already has orders,
 * because seed data in a real order book is not something you can cleanly undo.
 *
 * NOTE: this imports '@payload-config' directly rather than going through
 * src/lib/payload.ts. `payload run` already loads the config under that exact
 * specifier; importing it by any other path produces a SECOND module instance,
 * which calls getPlatformProxy again and deadlocks on the local D1 file. The
 * symptom is a script that hangs with no output and exits 0, which is a
 * thoroughly unhelpful thing to debug.
 */

const CATEGORIES = [
  {
    slug: 'cleaning',
    bg: { title: 'Почистващи препарати', description: 'Професионална и битова химия' },
    en: { title: 'Cleaning supplies', description: 'Professional and household chemicals' },
  },
  {
    slug: 'stationery',
    bg: { title: 'Канцеларски материали', description: 'За офиса и училището' },
    en: { title: 'Stationery', description: 'For the office and school' },
  },
  {
    slug: 'tools',
    bg: { title: 'Инструменти', description: 'Ръчни и електрически инструменти' },
    en: { title: 'Tools', description: 'Hand and power tools' },
  },
  {
    slug: 'household',
    bg: { title: 'Домакински стоки', description: 'Всичко за дома' },
    en: { title: 'Household goods', description: 'Everything for the home' },
  },
]

const BRANDS = [
  { slug: 'sano', name: 'Sano', description: { bg: 'Професионална химия', en: 'Professional chemicals' } },
  { slug: 'bosch', name: 'Bosch', description: { bg: 'Инструменти и техника', en: 'Tools and equipment' } },
  { slug: 'maped', name: 'Maped', description: { bg: 'Канцеларски материали', en: 'Stationery' } },
]

const PRODUCTS = [
  {
    sku: 'KC-CLN-001',
    brand: 'sano',
    category: 'cleaning',
    basePrice: 4.5,
    stock: 240,
    unit: 'piece' as const,
    featured: true,
    tiers: [
      { minQuantity: 1, maxQuantity: 9, pricePerUnit: 4.5 },
      { minQuantity: 10, maxQuantity: 49, pricePerUnit: 3.9 },
      { minQuantity: 50, pricePerUnit: 3.2 },
    ],
    bg: { title: 'Универсален почистващ препарат 1л', short: 'Концентрат за всякакви повърхности' },
    en: { title: 'Universal cleaner 1L', short: 'Concentrate for all surfaces' },
  },
  {
    sku: 'KC-CLN-002',
    brand: 'sano',
    category: 'cleaning',
    basePrice: 12.9,
    stock: 60,
    unit: 'box' as const,
    featured: true,
    tiers: [
      { minQuantity: 1, maxQuantity: 4, pricePerUnit: 12.9 },
      { minQuantity: 5, pricePerUnit: 11.5 },
    ],
    bg: { title: 'Микрофибърни кърпи, кутия 50 бр.', short: 'Устойчиви на многократно пране' },
    en: { title: 'Microfibre cloths, box of 50', short: 'Withstand repeated washing' },
  },
  {
    sku: 'KC-STA-001',
    brand: 'maped',
    category: 'stationery',
    basePrice: 8.2,
    stock: 8,
    unit: 'pack' as const,
    featured: true,
    tiers: [
      { minQuantity: 1, maxQuantity: 19, pricePerUnit: 8.2 },
      { minQuantity: 20, pricePerUnit: 6.95 },
    ],
    bg: { title: 'Копирна хартия A4, 500 листа', short: '80 g/m², клас B' },
    en: { title: 'Copy paper A4, 500 sheets', short: '80 g/m², class B' },
  },
  {
    sku: 'KC-STA-002',
    brand: 'maped',
    category: 'stationery',
    basePrice: 1.4,
    stock: 0,
    unit: 'piece' as const,
    featured: false,
    tiers: [],
    bg: { title: 'Химикал син, 0.7 мм', short: 'Плавно писане, дълъг живот' },
    en: { title: 'Ballpoint pen blue, 0.7mm', short: 'Smooth writing, long life' },
  },
  {
    sku: 'KC-TLS-001',
    brand: 'bosch',
    category: 'tools',
    basePrice: 34.9,
    stock: 25,
    unit: 'set' as const,
    featured: true,
    tiers: [
      { minQuantity: 1, maxQuantity: 4, pricePerUnit: 34.9 },
      { minQuantity: 5, pricePerUnit: 31.0 },
    ],
    bg: { title: 'Комплект отвертки, 12 части', short: 'Хромванадиева стомана' },
    en: { title: 'Screwdriver set, 12 pieces', short: 'Chrome vanadium steel' },
  },
  {
    sku: 'KC-HOU-001',
    brand: 'sano',
    category: 'household',
    basePrice: 6.75,
    stock: 120,
    unit: 'piece' as const,
    featured: false,
    tiers: [
      { minQuantity: 1, maxQuantity: 11, pricePerUnit: 6.75 },
      { minQuantity: 12, pricePerUnit: 5.5 },
    ],
    bg: { title: 'Кофа с преса 12л', short: 'Здрава пластмаса, ергономична дръжка' },
    en: { title: 'Mop bucket with wringer 12L', short: 'Durable plastic, ergonomic handle' },
  },
]

async function seed() {
  const payload = await getPayload({ config })

  const existingOrders = await payload.count({ collection: 'orders' })
  if (existingOrders.totalDocs > 0) {
    throw new Error(
      `Refusing to seed: this database already has ${existingOrders.totalDocs} order(s). ` +
        `Seed data belongs in development only.`,
    )
  }

  const brandIds = new Map<string, number>()

  for (const brand of BRANDS) {
    const existing = await payload.find({
      collection: 'brands',
      where: { slug: { equals: brand.slug } },
      limit: 1,
      depth: 0,
    })

    if (existing.docs[0]) {
      brandIds.set(brand.slug, existing.docs[0].id)
      continue
    }

    const created = await payload.create({
      collection: 'brands',
      locale: 'bg',
      data: { name: brand.name, slug: brand.slug, description: brand.description.bg, isActive: true },
    })
    await payload.update({
      collection: 'brands',
      id: created.id,
      locale: 'en',
      data: { description: brand.description.en },
    })
    brandIds.set(brand.slug, created.id)
  }

  const categoryIds = new Map<string, number>()

  for (const category of CATEGORIES) {
    const existing = await payload.find({
      collection: 'categories',
      where: { slug: { equals: category.slug } },
      limit: 1,
      depth: 0,
    })

    if (existing.docs[0]) {
      categoryIds.set(category.slug, existing.docs[0].id)
      continue
    }

    // Create in the default locale, then patch the English translation. Payload
    // writes one locale per operation.
    const created = await payload.create({
      collection: 'categories',
      locale: 'bg',
      data: {
        title: category.bg.title,
        description: category.bg.description,
        slug: category.slug,
        isActive: true,
      },
    })

    await payload.update({
      collection: 'categories',
      id: created.id,
      locale: 'en',
      data: { title: category.en.title, description: category.en.description },
    })

    categoryIds.set(category.slug, created.id)
  }

  for (const product of PRODUCTS) {
    const existing = await payload.find({
      collection: 'products',
      where: { sku: { equals: product.sku } },
      limit: 1,
      depth: 0,
    })

    if (existing.docs[0]) continue

    const created = await payload.create({
      collection: 'products',
      locale: 'bg',
      data: {
        title: product.bg.title,
        shortDescription: product.bg.short,
        sku: product.sku,
        basePrice: product.basePrice,
        stock: product.stock,
        unit: product.unit,
        minOrderQuantity: 1,
        lowStockThreshold: 10,
        isActive: true,
        isFeatured: product.featured,
        category: categoryIds.get(product.category),
        brand: brandIds.get(product.brand),
        pricingTiers: product.tiers,
      },
    })

    await payload.update({
      collection: 'products',
      id: created.id,
      locale: 'en',
      data: { title: product.en.title, shortDescription: product.en.short },
    })
  }

  await payload.updateGlobal({
    slug: 'settings',
    locale: 'bg',
    data: {
      siteName: 'KC Trading',
      heroHeading: 'Качествени стоки на едро и дребно',
      heroSubheading: 'Доставка с Еконт и Спиди в цялата страна. Плащане при получаване.',
      // Placeholders — the real values must come from the stakeholder before
      // launch. They are legally required on every page.
      companyName: 'КС Трейдинг ЕООД',
      registrationNumber: '000000000',
      registeredAddress: 'гр. София, ул. Примерна 1',
    },
  })

  await payload.updateGlobal({
    slug: 'settings',
    locale: 'en',
    data: {
      heroHeading: 'Quality goods, retail and wholesale',
      heroSubheading: 'Delivered nationwide by Econt and Speedy. Pay on delivery.',
      registeredAddress: 'Sofia, 1 Primerna St.',
    },
  })

  // eslint-disable-next-line no-console -- this is a CLI script; output is the point.
  console.log(
    `Seeded ${BRANDS.length} brands, ${CATEGORIES.length} categories and ${PRODUCTS.length} products, plus site settings.`,
  )
}

/**
 * Top-level await, not `seed().then(...)`.
 *
 * Wrangler's platform proxy resolves through handles that do not keep Node's
 * event loop alive. With a floating promise the process simply exits — status
 * 0, no output, nothing written — before Payload has even finished
 * initialising. Top-level await keeps module evaluation pending until the work
 * is genuinely done.
 */
try {
  await seed()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
