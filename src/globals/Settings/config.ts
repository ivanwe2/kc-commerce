import type { GlobalConfig } from 'payload'
import { authenticated } from '../../access/authenticated'

export const Settings: GlobalConfig = {
  slug: 'settings',
  access: {
    read: () => true, // public — site config is read by the frontend
    update: authenticated,
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      required: true,
      localized: true,
      defaultValue: 'KC Trading',
    },
    {
      name: 'siteDescription',
      type: 'textarea',
      localized: true,
      admin: {
        description: 'Short site description for SEO and footer',
      },
    },
    {
      name: 'siteLogo',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'siteFavicon',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'defaultLocale',
      type: 'select',
      required: true,
      defaultValue: 'bg',
      options: [
        { label: 'Български', value: 'bg' },
        { label: 'English', value: 'en' },
      ],
    },
    {
      name: 'supportedLocales',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['bg', 'en'],
      options: [
        { label: 'Български', value: 'bg' },
        { label: 'English', value: 'en' },
      ],
    },
    {
      name: 'contactInfo',
      type: 'group',
      fields: [
        {
          name: 'email',
          type: 'email',
        },
        {
          name: 'phone',
          type: 'text',
        },
        {
          name: 'address',
          type: 'textarea',
          localized: true,
        },
      ],
    },
    {
      name: 'socialLinks',
      type: 'array',
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: [
            { label: 'Facebook', value: 'facebook' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'Twitter/X', value: 'twitter' },
            { label: 'LinkedIn', value: 'linkedin' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'TikTok', value: 'tiktok' },
          ],
        },
        {
          name: 'url',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'footerText',
      type: 'textarea',
      localized: true,
      admin: {
        description: 'Text displayed in the site footer',
      },
    },
    {
      name: 'googleAnalyticsId',
      type: 'text',
      admin: {
        description: 'Google Analytics measurement ID (e.g., G-XXXXXXXXXX)',
      },
    },
    {
      name: 'freeShippingThreshold',
      type: 'number',
      min: 0,
      admin: {
        description: 'Order subtotal threshold for free shipping (€)',
      },
    },
  ],
}
