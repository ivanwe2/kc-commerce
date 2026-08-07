import type { CollectionConfig } from 'payload'

import { isAdminOrEditor } from '@/access'

/**
 * Discount codes.
 *
 * Read access is CLOSED to the public, unlike every other catalogue collection.
 * A readable coupons endpoint is a list of every working discount code in the
 * shop — codes are validated by a server action that looks them up with
 * overrideAccess, so nothing legitimate needs to read this from the client.
 */
export const Coupons: CollectionConfig = {
  slug: 'coupons',

  access: {
    read: isAdminOrEditor,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },

  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'discountType', 'discountValue', 'timesUsed', 'isActive'],
    group: 'Sales',
  },

  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Case-insensitive. Stored and compared in upper case.' },
      hooks: {
        // Normalised on write so "SPRING10", "spring10" and "Spring10" cannot
        // become three different coupons.
        beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value)],
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'discountType',
          type: 'select',
          required: true,
          defaultValue: 'percent',
          options: [
            { label: 'Percentage off', value: 'percent' },
            { label: 'Fixed amount off (EUR)', value: 'fixed' },
            { label: 'Free shipping', value: 'free_shipping' },
          ],
        },
        {
          name: 'discountValue',
          type: 'number',
          min: 0,
          admin: {
            description: 'Percent (1-100) or EUR amount. Ignored for free shipping.',
            condition: (data) => data?.discountType !== 'free_shipping',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'minimumSubtotal',
          type: 'number',
          min: 0,
          admin: { description: 'Optional. Minimum order subtotal in EUR.' },
        },
        {
          name: 'maxUses',
          type: 'number',
          min: 0,
          admin: { description: 'Optional. Total redemptions allowed across all customers.' },
        },
        {
          name: 'timesUsed',
          type: 'number',
          defaultValue: 0,
          admin: { readOnly: true },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'startsAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'endsAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      index: true,
      admin: { position: 'sidebar' },
    },
  ],

  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data

        if (data.discountType === 'percent' && typeof data.discountValue === 'number') {
          if (data.discountValue <= 0 || data.discountValue > 100) {
            throw new Error('A percentage discount must be between 1 and 100.')
          }
        }

        if (data.startsAt && data.endsAt && new Date(data.startsAt) >= new Date(data.endsAt)) {
          throw new Error('The end date must be after the start date.')
        }

        return data
      },
    ],
  },
}
