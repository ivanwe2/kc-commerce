import type { CollectionConfig } from 'payload'

import { activeOrAuthenticated, isAdminOrEditor } from '@/access'
import { roundMoney } from '@/lib/money'
import { validatePricingTiers, type PricingTier } from '@/lib/pricing'
import { slugify } from '@/lib/slugify'
import { revalidateProduct, revalidateProductDelete } from './hooks/revalidate'

export const Products: CollectionConfig = {
  slug: 'products',

  access: {
    read: activeOrAuthenticated,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },

  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'sku', 'basePrice', 'stock', 'isActive'],
    listSearchableFields: ['title', 'sku'],
    group: 'Catalogue',
  },

  defaultSort: '-createdAt',

  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
      index: true,
    },
    {
      name: 'shortDescription',
      type: 'textarea',
      localized: true,
      maxLength: 280,
      admin: {
        description: 'One or two lines, shown on product cards and in search results.',
      },
    },
    {
      name: 'description',
      type: 'richText',
      localized: true,
    },

    // --- Identity & pricing -------------------------------------------------
    {
      type: 'row',
      fields: [
        {
          name: 'sku',
          type: 'text',
          required: true,
          unique: true,
          index: true,
        },
        {
          name: 'basePrice',
          type: 'number',
          required: true,
          min: 0,
          admin: {
            description: 'Single-unit price in EUR, e.g. 12.50',
          },
        },
        {
          name: 'unit',
          type: 'select',
          required: true,
          defaultValue: 'piece',
          options: [
            { label: 'Piece', value: 'piece' },
            { label: 'Kilogram', value: 'kg' },
            { label: 'Litre', value: 'l' },
            { label: 'Metre', value: 'm' },
            { label: 'Box', value: 'box' },
            { label: 'Pack', value: 'pack' },
            { label: 'Set', value: 'set' },
          ],
        },
      ],
    },

    {
      name: 'pricingTiers',
      type: 'array',
      label: 'Bulk pricing tiers',
      admin: {
        description:
          'Optional. Cheaper unit prices at higher quantities. Ranges must not overlap, and only the last tier may be left open-ended.',
        initCollapsed: true,
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'minQuantity',
              type: 'number',
              required: true,
              min: 1,
              admin: { description: 'From this quantity' },
            },
            {
              name: 'maxQuantity',
              type: 'number',
              min: 1,
              admin: { description: 'Up to (leave empty for "and above")' },
            },
            {
              name: 'pricePerUnit',
              type: 'number',
              required: true,
              min: 0,
              admin: { description: 'EUR per unit' },
            },
          ],
        },
      ],
    },

    // --- Stock --------------------------------------------------------------
    {
      type: 'row',
      fields: [
        {
          name: 'stock',
          type: 'number',
          required: true,
          defaultValue: 0,
          min: 0,
          index: true,
        },
        {
          name: 'minOrderQuantity',
          type: 'number',
          required: true,
          defaultValue: 1,
          min: 1,
        },
        {
          name: 'lowStockThreshold',
          type: 'number',
          defaultValue: 10,
          min: 0,
          admin: { description: 'Show a "low stock" badge at or below this level.' },
        },
      ],
    },
    {
      name: 'weightGrams',
      type: 'number',
      min: 0,
      admin: { description: 'Shipping weight in grams. Used for courier rate calculation.' },
    },

    // --- Relationships ------------------------------------------------------
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      index: true,
    },
    {
      name: 'images',
      type: 'array',
      maxRows: 10,
      admin: { description: 'The first image is used as the product thumbnail.' },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },

    // --- Sidebar ------------------------------------------------------------
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Auto-generated from the title. Change with care — it is the public URL.',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      index: true,
      admin: { position: 'sidebar', description: 'Visible in the shop.' },
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar', description: 'Show on the homepage.' },
    },

    // --- SEO ----------------------------------------------------------------
    {
      name: 'seo',
      type: 'group',
      admin: { description: 'Optional. Falls back to the title and short description.' },
      fields: [
        { name: 'metaTitle', type: 'text', localized: true },
        { name: 'metaDescription', type: 'textarea', localized: true, maxLength: 320 },
      ],
    },
  ],

  hooks: {
    afterChange: [revalidateProduct],
    afterDelete: [revalidateProductDelete],
    beforeValidate: [
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return data

        // Slug from the English title where available, else Bulgarian. Latin
        // slugs travel better than percent-encoded Cyrillic when shared.
        if (!data.slug) {
          const source =
            typeof data.title === 'string'
              ? data.title
              : ((data.title as Record<string, string> | undefined)?.en ??
                (data.title as Record<string, string> | undefined)?.bg ??
                '')

          if (source) {
            const base = slugify(source)
            // A colliding slug fails the unique index with an opaque database
            // error, so disambiguate here where we can still explain ourselves.
            const existing = await req.payload.find({
              collection: 'products',
              where: { slug: { equals: base } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            const taken = existing.docs.length > 0 && existing.docs[0]?.id !== originalDoc?.id
            data.slug = taken ? `${base}-${Date.now().toString(36)}` : base
          }
        }

        // Money is stored as decimal euros; snap it to whole cents on the way in
        // so no half-cent value can ever reach the database.
        if (typeof data.basePrice === 'number') {
          data.basePrice = roundMoney(data.basePrice)
        }
        if (Array.isArray(data.pricingTiers)) {
          for (const tier of data.pricingTiers as PricingTier[]) {
            if (typeof tier.pricePerUnit === 'number') {
              tier.pricePerUnit = roundMoney(tier.pricePerUnit)
            }
          }
        }

        if (operation === 'create' || operation === 'update') {
          const error = validatePricingTiers(
            data.pricingTiers as PricingTier[] | undefined,
            typeof data.minOrderQuantity === 'number' ? data.minOrderQuantity : 1,
          )
          if (error) throw new Error(error)
        }

        return data
      },
    ],
  },
}
