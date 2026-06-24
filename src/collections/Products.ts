import type { CollectionConfig } from 'payload'
import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { authenticated } from '../access/authenticated'

const slugify = (str: string): string =>
  str
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()

export const Products: CollectionConfig = {
  slug: 'products',
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'sku', 'basePrice', 'stock', 'isActive'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
      },
      hooks: {
        beforeValidate: [
          ({ siblingData, operation, value }) => {
            if (operation === 'create' || !value) {
              const title = siblingData.title?.en || siblingData.title?.bg || ''
              return slugify(title)
            }
            return value
          },
        ],
      },
    },
    {
      name: 'shortDescription',
      type: 'textarea',
      localized: true,
      admin: {
        description: 'Max 280 characters',
      },
    },
    {
      name: 'description',
      type: 'richText',
      localized: true,
      editor: lexicalEditor({
        features: ({ rootFeatures }) => [
          ...rootFeatures,
          HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
          BlocksFeature({ blocks: [] }),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
          HorizontalRuleFeature(),
        ],
      }),
    },
    {
      type: 'row',
      fields: [
        {
          name: 'sku',
          type: 'text',
          required: true,
          unique: true,
          admin: {
            position: 'sidebar',
          },
        },
        {
          name: 'basePrice',
          type: 'number',
          required: true,
          min: 0,
          admin: {
            position: 'sidebar',
            description: 'Default single-unit price (€)',
          },
        },
        {
          name: 'unit',
          type: 'select',
          required: true,
          defaultValue: 'piece',
          options: [
            { label: 'Piece', value: 'piece' },
            { label: 'Kilogram (kg)', value: 'kg' },
            { label: 'Gram (g)', value: 'g' },
            { label: 'Liter (l)', value: 'l' },
            { label: 'Milliliter (ml)', value: 'ml' },
            { label: 'Box', value: 'box' },
            { label: 'Pack', value: 'pack' },
            { label: 'Set', value: 'set' },
            { label: 'Pair', value: 'pair' },
            { label: 'Roll', value: 'roll' },
            { label: 'Meter (m)', value: 'm' },
          ],
          admin: {
            position: 'sidebar',
          },
        },
      ],
    },
    {
      name: 'pricingTiers',
      type: 'array',
      label: 'Bulk Pricing Tiers',
      admin: {
        description: 'Define quantity ranges and discounted prices. Leave empty to use basePrice only.',
      },
      fields: [
        {
          name: 'minQuantity',
          type: 'number',
          required: true,
          min: 1,
          admin: {
            description: 'Minimum quantity for this tier',
          },
        },
        {
          name: 'maxQuantity',
          type: 'number',
          admin: {
            description: 'Maximum quantity (leave empty for no upper limit)',
          },
        },
        {
          name: 'pricePerUnit',
          type: 'number',
          required: true,
          min: 0,
          admin: {
            description: 'Price per unit at this quantity',
          },
        },
      ],
    },
    {
      name: 'minOrderQuantity',
      type: 'number',
      required: true,
      min: 1,
      defaultValue: 1,
      admin: {
        position: 'sidebar',
        description: 'Minimum quantity a customer must order',
      },
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'images',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      maxRows: 10,
      required: true,
    },
    {
      name: 'stock',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        description: 'Current stock quantity',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'seo',
      type: 'group',
      localized: true,
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          localized: true,
          admin: {
            description: 'Max 60 characters',
          },
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          localized: true,
          admin: {
            description: 'Max 160 characters',
          },
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      // Auto-disable when stock reaches 0
      ({ operation, data, originalDoc }) => {
        if (operation === 'update' && data.stock === 0 && originalDoc?.stock !== 0) {
          data.isActive = false
        }
        // Ensure pricingTiers has at least one entry matching minOrderQuantity
        if (!data.pricingTiers || data.pricingTiers.length === 0) {
          data.pricingTiers = [{
            minQuantity: data.minOrderQuantity || 1,
            maxQuantity: null,
            pricePerUnit: data.basePrice,
          }]
        } else {
          // Fix first tier minQuantity
          if (data.pricingTiers[0].minQuantity !== (data.minOrderQuantity || 1)) {
            data.pricingTiers[0].minQuantity = data.minOrderQuantity || 1
          }
          // Fix overlapping tiers
          for (let i = 1; i < data.pricingTiers.length; i++) {
            const prevMax = data.pricingTiers[i - 1].maxQuantity ?? Infinity
            if (data.pricingTiers[i].minQuantity <= prevMax) {
              data.pricingTiers[i].minQuantity = prevMax + 1
            }
          }
        }
        return data
      },
    ],
  },
}
