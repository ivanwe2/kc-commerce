import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminOrEditor, isAdminOrEditorField } from '@/access'

export const SHIPPING_METHODS = [
  'econt_office',
  'econt_address',
  'speedy_office',
  'speedy_address',
] as const

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/**
 * Which status changes are legal.
 *
 * Enforced server-side because an illegal transition is not merely untidy: going
 * back from `shipped` to `processing` would re-fire the shipping email, and
 * `delivered -> pending` would misstate the 14-day withdrawal window that starts
 * on delivery. Cancellation is reachable from any live state; terminal states
 * are terminal.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
}

export const Orders: CollectionConfig = {
  slug: 'orders',

  access: {
    // Customers have no accounts, so nobody outside the admin panel may read
    // orders — they contain names, phone numbers and delivery addresses.
    read: isAdminOrEditor,
    // Created exclusively by the checkout server action via the Local API with
    // overrideAccess. Public creation stays closed: an open create endpoint on a
    // collection holding prices and stock is not something to leave ajar.
    create: () => false,
    update: isAdminOrEditor,
    // Orders are commercial records with a 5-year tax retention requirement.
    // Cancel them; do not delete them.
    delete: isAdmin,
  },

  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'status', 'customerName', 'total', 'createdAt'],
    listSearchableFields: ['orderNumber'],
    group: 'Sales',
  },

  defaultSort: '-createdAt',

  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'orderNumber',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          admin: { readOnly: true },
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'pending',
          index: true,
          options: ORDER_STATUSES.map((value) => ({
            label: value.charAt(0).toUpperCase() + value.slice(1),
            value,
          })),
        },
      ],
    },

    // Denormalised for the admin list view: showing a customer name otherwise
    // costs a join per row on every page of the order list.
    {
      name: 'customerName',
      type: 'text',
      admin: { readOnly: true, hidden: true },
    },

    {
      name: 'customer',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'firstName', type: 'text', required: true },
            { name: 'lastName', type: 'text', required: true },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'email', type: 'email', required: true, index: true },
            {
              name: 'phone',
              type: 'text',
              required: true,
              admin: { description: 'Required — the courier needs it for Cash on Delivery.' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'acceptedTerms',
              type: 'checkbox',
              required: true,
              admin: { readOnly: true, description: 'Consent record — do not edit.' },
            },
            {
              name: 'marketingConsent',
              type: 'checkbox',
              defaultValue: false,
              admin: { readOnly: true, description: 'Consent record — do not edit.' },
            },
          ],
        },
      ],
    },

    {
      name: 'shippingMethod',
      type: 'select',
      required: true,
      options: [
        { label: 'Econt — to office', value: 'econt_office' },
        { label: 'Econt — to address', value: 'econt_address' },
        { label: 'Speedy — to office', value: 'speedy_office' },
        { label: 'Speedy — to address', value: 'speedy_address' },
      ],
    },
    {
      name: 'officeCode',
      type: 'text',
      admin: {
        description: 'Courier office name or code.',
        condition: (data) => String(data?.shippingMethod ?? '').endsWith('_office'),
      },
    },
    {
      name: 'shippingAddress',
      type: 'group',
      admin: {
        condition: (data) => String(data?.shippingMethod ?? '').endsWith('_address'),
      },
      fields: [
        { name: 'street', type: 'text' },
        {
          type: 'row',
          fields: [
            { name: 'city', type: 'text' },
            {
              name: 'postalCode',
              type: 'text',
              admin: { description: 'Four digits (Bulgaria).' },
            },
          ],
        },
        {
          name: 'country',
          type: 'text',
          defaultValue: 'Bulgaria',
          admin: { readOnly: true },
        },
        { name: 'notes', type: 'textarea', admin: { description: 'Delivery instructions.' } },
      ],
    },

    /**
     * Line items are immutable snapshots, not live references.
     *
     * The product relationship is kept for reporting, but title, sku and price
     * are copied at order time on purpose: when a price changes next month, this
     * order must still show what the customer actually agreed to pay. A live
     * lookup here would silently rewrite commercial history.
     */
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      admin: {
        readOnly: true,
        description: 'Snapshot taken when the order was placed. Immutable.',
      },
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
        },
        {
          type: 'row',
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'sku', type: 'text', required: true },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'quantity', type: 'number', required: true, min: 1 },
            { name: 'unitPrice', type: 'number', required: true, min: 0 },
            { name: 'totalPrice', type: 'number', required: true, min: 0 },
          ],
        },
      ],
    },

    {
      type: 'row',
      fields: [
        {
          name: 'subtotal',
          type: 'number',
          required: true,
          min: 0,
          admin: { readOnly: true, description: 'EUR. Calculated server-side.' },
        },
        {
          name: 'shippingCost',
          type: 'number',
          required: true,
          min: 0,
          admin: { readOnly: true, description: 'EUR. Calculated server-side.' },
        },
        {
          name: 'total',
          type: 'number',
          required: true,
          min: 0,
          admin: { readOnly: true, description: 'EUR. Amount due on delivery.' },
        },
      ],
    },

    // --- Fulfilment ---------------------------------------------------------
    {
      type: 'row',
      fields: [
        {
          name: 'courierService',
          type: 'select',
          options: [
            { label: 'Econt', value: 'econt' },
            { label: 'Speedy', value: 'speedy' },
          ],
        },
        {
          name: 'trackingNumber',
          type: 'text',
          admin: { description: 'Required before an order can be marked as shipped.' },
        },
      ],
    },
    {
      name: 'adminNotes',
      type: 'textarea',
      access: { read: isAdminOrEditorField, update: isAdminOrEditorField },
      admin: { description: 'Internal only. Never shown to the customer.' },
    },
    {
      name: 'statusHistory',
      type: 'array',
      admin: {
        readOnly: true,
        initCollapsed: true,
        description: 'Audit trail of status changes.',
      },
      fields: [
        { name: 'status', type: 'text' },
        { name: 'changedAt', type: 'date' },
        { name: 'changedBy', type: 'text' },
      ],
    },
    {
      name: 'locale',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Language the order was placed in — used for email language.',
      },
    },
  ],

  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        if (operation !== 'update' || !originalDoc) return data

        const previous = originalDoc.status as OrderStatus
        const next = data.status as OrderStatus | undefined

        if (next && next !== previous) {
          const allowed = ALLOWED_TRANSITIONS[previous] ?? []
          if (!allowed.includes(next)) {
            throw new Error(
              `Cannot change status from "${previous}" to "${next}". ` +
                (allowed.length
                  ? `Allowed from here: ${allowed.join(', ')}.`
                  : `"${previous}" is a final status.`),
            )
          }

          // Marking an order shipped without a tracking number sends the
          // customer a "your order is on its way" email containing nothing they
          // can act on, and support pays for it afterwards.
          if (next === 'shipped') {
            const tracking = data.trackingNumber ?? originalDoc.trackingNumber
            const courier = data.courierService ?? originalDoc.courierService
            if (!tracking) {
              throw new Error('Add a tracking number before marking this order as shipped.')
            }
            if (!courier) {
              throw new Error('Select a courier service before marking this order as shipped.')
            }
          }

          const history = Array.isArray(data.statusHistory)
            ? data.statusHistory
            : (originalDoc.statusHistory ?? [])

          data.statusHistory = [
            ...history,
            {
              status: next,
              changedAt: new Date().toISOString(),
              changedBy: req.user?.email ?? 'system',
            },
          ]
        }

        return data
      },
    ],
  },
}
