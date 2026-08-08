import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminOrEditor } from '@/access'
import { applyStockMovement, stampStockMovement } from './hooks/applyStockMovement'

export const STOCK_REASONS = [
  'sale',
  'cancellation',
  'receiving',
  'damage',
  'stocktake',
  'correction',
  'return',
] as const

/**
 * The stock ledger — every change to inventory, and why.
 *
 * This inverts how stock was previously managed. Before, `products.stock` was
 * the truth and it changed by whatever wrote to it last; you could see a
 * product had 47 units and had no way to learn how it got there. Now the LEDGER
 * is the record and `products.stock` is a running balance maintained from it.
 *
 * The practical consequence is that receiving goods, writing off damage, and
 * correcting a stocktake are all done by ADDING A MOVEMENT rather than by
 * editing a number. That is what makes the number auditable: "we are 12 short"
 * becomes a question with an answer instead of a mystery.
 *
 * Rows are immutable once written. A mistaken movement is corrected by adding
 * an opposing one, exactly as in double-entry bookkeeping — editing history
 * would defeat the purpose of keeping it.
 */
export const StockMovements: CollectionConfig = {
  slug: 'stock-movements',

  access: {
    read: isAdminOrEditor,
    // Staff record receiving, damage and stocktakes here.
    create: isAdminOrEditor,
    // Immutable: correct a mistake with an opposing movement, never by editing.
    update: () => false,
    delete: isAdmin,
  },

  admin: {
    useAsTitle: 'id',
    defaultColumns: ['product', 'delta', 'reason', 'balanceAfter', 'createdAt'],
    group: 'Catalogue',
    description:
      'Every stock change and its reason. Add a movement to receive goods or write off damage — do not edit the stock field on a product directly.',
    listSearchableFields: ['reference', 'note'],
  },

  defaultSort: '-createdAt',
  timestamps: true,

  hooks: {
    beforeValidate: [stampStockMovement],
    afterChange: [applyStockMovement],
  },

  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'delta',
          type: 'number',
          required: true,
          admin: {
            description: 'Positive to add stock, negative to remove. Zero is rejected.',
          },
        },
        {
          name: 'reason',
          type: 'select',
          required: true,
          index: true,
          options: [
            { label: 'Sale', value: 'sale' },
            { label: 'Cancellation', value: 'cancellation' },
            { label: 'Return', value: 'return' },
            { label: 'Goods received', value: 'receiving' },
            { label: 'Damage / write-off', value: 'damage' },
            { label: 'Stocktake', value: 'stocktake' },
            { label: 'Correction', value: 'correction' },
          ],
        },
      ],
    },
    {
      name: 'balanceAfter',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'Stock level immediately after this movement was applied.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'reference',
          type: 'text',
          index: true,
          admin: { description: 'Order number, delivery note, or invoice reference.' },
        },
        {
          name: 'recordedBy',
          type: 'text',
          admin: { readOnly: true, description: 'Who recorded it, or "system" for automatic movements.' },
        },
      ],
    },
    {
      name: 'note',
      type: 'textarea',
      admin: { description: 'Why. Especially worth filling in for damage and corrections.' },
    },
  ],
}
