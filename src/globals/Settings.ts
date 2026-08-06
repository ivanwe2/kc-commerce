import type { GlobalConfig } from 'payload'

import { anyone, isAdmin } from '@/access'

export const Settings: GlobalConfig = {
  slug: 'settings',

  access: {
    // Read is public: the footer needs the company details on every page.
    read: anyone,
    update: isAdmin,
  },

  admin: {
    group: 'Configuration',
  },

  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          fields: [
            { name: 'siteName', type: 'text', localized: true, defaultValue: 'KC Trading' },
            { name: 'logo', type: 'upload', relationTo: 'media' },
            {
              name: 'heroHeading',
              type: 'text',
              localized: true,
              admin: { description: 'Main headline on the homepage.' },
            },
            { name: 'heroSubheading', type: 'textarea', localized: true },
            {
              name: 'announcementBar',
              type: 'group',
              fields: [
                { name: 'isActive', type: 'checkbox', defaultValue: false },
                { name: 'text', type: 'text', localized: true },
                { name: 'link', type: 'text' },
              ],
            },
          ],
        },

        {
          label: 'Contact',
          fields: [
            { name: 'contactEmail', type: 'email' },
            { name: 'contactPhone', type: 'text' },
            { name: 'address', type: 'textarea', localized: true },
            {
              name: 'socialLinks',
              type: 'array',
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'platform',
                      type: 'select',
                      options: [
                        { label: 'Facebook', value: 'facebook' },
                        { label: 'Instagram', value: 'instagram' },
                        { label: 'Viber', value: 'viber' },
                        { label: 'Telegram', value: 'telegram' },
                      ],
                    },
                    { name: 'url', type: 'text' },
                  ],
                },
              ],
            },
          ],
        },

        {
          /**
           * Legally mandatory under the Bulgarian Electronic Commerce Act: this
           * information must be accessible from every page of the site. The
           * footer reads it from here, so leaving these blank is a compliance
           * gap, not a cosmetic one.
           */
          label: 'Company (legal)',
          description:
            'Required by the Bulgarian Electronic Commerce Act and shown in the footer on every page. Must be completed before launch.',
          fields: [
            { name: 'companyName', type: 'text' },
            {
              type: 'row',
              fields: [
                {
                  name: 'registrationNumber',
                  type: 'text',
                  admin: { description: 'UIC / Bulstat' },
                },
                { name: 'vatNumber', type: 'text', admin: { description: 'If VAT registered' } },
              ],
            },
            { name: 'registeredAddress', type: 'textarea', localized: true },
            { name: 'tradeRegisterInfo', type: 'text' },
          ],
        },

        {
          label: 'Shipping',
          fields: [
            {
              /**
               * Rates live in the CMS rather than in code so the shop owner can
               * change them without a deploy. The checkout server action reads
               * these values — it never trusts a shipping cost sent by the client.
               */
              name: 'shippingRates',
              type: 'group',
              admin: { description: 'Flat rates in EUR, applied at checkout.' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'econtOffice',
                      type: 'number',
                      defaultValue: 3.5,
                      min: 0,
                      label: 'Econt — to office',
                    },
                    {
                      name: 'econtAddress',
                      type: 'number',
                      defaultValue: 5,
                      min: 0,
                      label: 'Econt — to address',
                    },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'speedyOffice',
                      type: 'number',
                      defaultValue: 3.5,
                      min: 0,
                      label: 'Speedy — to office',
                    },
                    {
                      name: 'speedyAddress',
                      type: 'number',
                      defaultValue: 5,
                      min: 0,
                      label: 'Speedy — to address',
                    },
                  ],
                },
                {
                  name: 'freeShippingThreshold',
                  type: 'number',
                  min: 0,
                  admin: {
                    description:
                      'Order subtotal above which shipping is free. Leave empty to disable.',
                  },
                },
              ],
            },
            {
              name: 'shippingInfo',
              type: 'richText',
              localized: true,
              admin: { description: 'Shown on product pages and at checkout.' },
            },
          ],
        },

        {
          label: 'Footer',
          fields: [{ name: 'footerText', type: 'richText', localized: true }],
        },
      ],
    },
  ],
}
