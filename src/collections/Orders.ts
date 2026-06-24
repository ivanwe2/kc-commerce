import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

const ORDER_STATUSES = [
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Returned', value: 'returned' },
]

const SHIPPING_METHODS = [
  { label: 'Econt — до офис', value: 'econt_office' },
  { label: 'Econt — до адрес', value: 'econt_address' },
  { label: 'Speedy — до офис', value: 'speedy_office' },
  { label: 'Speedy — до адрес', value: 'speedy_address' },
]

const COURIER_SERVICES = [
  { label: 'Econt', value: 'econt' },
  { label: 'Speedy', value: 'speedy' },
]

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: ['returned', 'cancelled'],
  cancelled: [],
  returned: [],
}

const SHIPPING_RATES: Record<string, number> = {
  econt_office: 3.50,
  econt_address: 5.00,
  speedy_office: 3.50,
  speedy_address: 5.00,
}

export const Orders: CollectionConfig = {
  slug: 'orders',
  access: {
    read: authenticated,
    create: () => true, // public — checkout creates orders
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'status', 'customer.firstName', 'total', 'createdAt'],
  },
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ORDER_STATUSES,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'customer',
      type: 'group',
      required: true,
      fields: [
        {
          name: 'firstName',
          type: 'text',
          required: true,
        },
        {
          name: 'lastName',
          type: 'text',
          required: true,
        },
        {
          name: 'email',
          type: 'email',
          required: true,
        },
        {
          name: 'phone',
          type: 'text',
          required: true,
          admin: {
            description: 'Bulgarian format: +359 XX XXX XXXX or 0XX XXX XXXX',
          },
        },
        {
          name: 'acceptedTerms',
          type: 'checkbox',
          required: true,
          admin: {
            description: 'Customer must accept Terms & Conditions',
          },
        },
        {
          name: 'marketingConsent',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
    {
      name: 'shippingAddress',
      type: 'group',
      required: true,
      fields: [
        {
          name: 'street',
          type: 'text',
          required: true,
        },
        {
          name: 'city',
          type: 'text',
          required: true,
        },
        {
          name: 'postalCode',
          type: 'text',
          required: true,
          admin: {
            description: 'Bulgarian postal code (4 digits)',
          },
        },
        {
          name: 'country',
          type: 'text',
          defaultValue: 'Bulgaria',
          admin: {
            disabled: true,
          },
        },
        {
          name: 'notes',
          type: 'textarea',
        },
      ],
    },
    {
      name: 'shippingMethod',
      type: 'select',
      required: true,
      options: SHIPPING_METHODS,
    },
    {
      name: 'econtOfficeCode',
      type: 'text',
      admin: {
        condition: (_, siblingData) =>
          siblingData.shippingMethod === 'econt_office',
      },
    },
    {
      name: 'speedyOfficeCode',
      type: 'text',
      admin: {
        condition: (_, siblingData) =>
          siblingData.shippingMethod === 'speedy_office',
      },
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products' as never,
          required: true,
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'title',
          type: 'text',
          required: true,
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'sku',
          type: 'text',
          required: true,
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1,
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'unitPrice',
          type: 'number',
          required: true,
          min: 0,
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'totalPrice',
          type: 'number',
          required: true,
          min: 0,
          admin: {
            readOnly: true,
          },
        },
      ],
    },
    {
      name: 'subtotal',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'shippingCost',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'total',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'trackingNumber',
      type: 'text',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'courierService',
      type: 'select',
      options: COURIER_SERVICES,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'adminNotes',
      type: 'textarea',
      admin: {
        position: 'sidebar',
        condition: ({ user }) => !!user,
      },
    },
    {
      name: 'locale',
      type: 'text',
      required: true,
      defaultValue: 'bg',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ operation, data, req }) => {
        if (!data) return data

        // Generate orderNumber on create
        if (operation === 'create' && !data.orderNumber) {
          const year = new Date().getFullYear()
          const lastOrder = await req.payload.find({
            collection: 'orders' as never,
            where: {
              orderNumber: { like: `KC-${year}-` },
            },
            sort: '-orderNumber',
            limit: 1,
            depth: 0,
          })
          const lastDoc = lastOrder.docs[0] as Record<string, unknown> | undefined
          const lastOrderNum = typeof lastDoc?.orderNumber === 'string' ? lastDoc.orderNumber : ''
          const lastNum = lastOrderNum
            ? parseInt(lastOrderNum.split('-').pop() ?? '0', 10)
            : 0
          const nextNum = String(lastNum + 1).padStart(5, '0')
          data.orderNumber = `KC-${year}-${nextNum}`
        }

        // Calculate totals on create
        if (operation === 'create' && data.items) {
          data.subtotal = data.items.reduce(
            (sum: number, item: { totalPrice?: number }) => sum + (item.totalPrice ?? 0),
            0,
          )
          data.shippingCost = SHIPPING_RATES[data.shippingMethod] ?? 5.00
          data.total = data.subtotal + data.shippingCost
        }

        return data
      },
    ],
    beforeChange: [
      ({ operation, data, originalDoc }) => {
        if (!data) return data
        // Validate status transitions
        if (operation === 'update' && data.status && originalDoc?.status) {
          const allowed = VALID_STATUS_TRANSITIONS[originalDoc.status] || []
          if (data.status !== originalDoc.status && !allowed.includes(data.status)) {
            throw new Error(
              `Cannot transition from '${originalDoc.status}' to '${data.status}'`,
            )
          }
          // When transitioning to shipped, require trackingNumber
          if (data.status === 'shipped' && !data.trackingNumber) {
            throw new Error('Tracking number is required when marking order as shipped')
          }
        }
        return data
      },
    ],
    afterChange: [
      // TODO: Send email on status change (confirmed, shipped)
      // Will be implemented in Phase 7 after email system is set up
    ],
  },
}
