import type { CollectionConfig } from 'payload'

import { isAdminOrEditor, anyone } from '@/access'
import { revalidateBanner } from './hooks/revalidate'

/**
 * Scheduled homepage banners.
 *
 * A collection rather than more fields on the Settings global, because banners
 * are inherently plural and time-bound: a shop runs an autumn promotion and a
 * clearance at once, and wants next week's banner queued now rather than
 * remembered as a calendar reminder.
 *
 * Scheduling is enforced when querying, not by an admin toggling `isActive` at
 * the right moment — a promotion that has to be switched on by hand at 9am is a
 * promotion that starts late.
 */
export const Banners: CollectionConfig = {
  slug: 'banners',

  access: {
    // Public read: the storefront renders these. Date filtering happens in the
    // query, so an unscheduled banner is never returned to a visitor.
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },

  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'placement', 'startsAt', 'endsAt', 'isActive'],
    group: 'Content',
    description: 'Promotional banners. Set dates to schedule; leave them empty to run immediately.',
  },

  defaultSort: 'sortOrder',

  hooks: {
    afterChange: [revalidateBanner],
  },

  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'subtitle',
      type: 'text',
      localized: true,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Wide image. Renders as a coloured panel when empty.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'linkUrl',
          type: 'text',
          admin: { description: 'Where the banner leads, e.g. /products?onSale=1' },
        },
        {
          name: 'linkLabel',
          type: 'text',
          localized: true,
          admin: { description: 'Button text. The whole banner is clickable if empty.' },
        },
      ],
    },
    {
      name: 'placement',
      type: 'select',
      required: true,
      defaultValue: 'homepage_hero',
      options: [
        { label: 'Homepage — below the hero', value: 'homepage_hero' },
        { label: 'Homepage — mid page', value: 'homepage_mid' },
        { label: 'Product listing — top', value: 'listing_top' },
      ],
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startsAt',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'endsAt',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayAndTime' } },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'sortOrder', type: 'number', defaultValue: 0 },
        { name: 'isActive', type: 'checkbox', defaultValue: true, index: true },
      ],
    },
  ],
}
