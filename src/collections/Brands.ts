import type { CollectionConfig } from 'payload'

import { activeOrAuthenticated, isAdminOrEditor } from '@/access'
import { slugify } from '@/lib/slugify'
import { revalidateBrand } from './hooks/revalidate'

/**
 * Manufacturers and brands.
 *
 * A general-merchandise store resells other people's products, and customers
 * shop by brand constantly — "the Bosch one", "whatever Ariel has". Without this
 * dimension the catalogue can only be navigated by category, which is the wrong
 * axis for a large part of real buying behaviour.
 */
export const Brands: CollectionConfig = {
  slug: 'brands',

  access: {
    read: activeOrAuthenticated,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },

  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'isActive'],
    group: 'Catalogue',
  },

  defaultSort: 'name',

  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      index: true,
      // Not localized: a brand name is a proper noun and is the same in both
      // languages. Localizing it would invite two spellings of one manufacturer.
      admin: { description: 'The manufacturer name as it appears on the product.' },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'website',
      type: 'text',
      admin: { description: "Optional link to the manufacturer's own site." },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
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
    afterChange: [revalidateBrand],

    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        if (!data.slug && typeof data.name === 'string' && data.name) {
          data.slug = slugify(data.name)
        }
        return data
      },
    ],

    beforeDelete: [
      async ({ id, req }) => {
        // Same reasoning as categories: deleting a brand out from under live
        // products leaves them pointing at nothing and silently drops them out
        // of every brand listing.
        const products = await req.payload.find({
          collection: 'products',
          where: { brand: { equals: id } },
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })

        if (products.totalDocs > 0) {
          throw new Error(
            `Cannot delete: ${products.totalDocs} product(s) still reference this brand. ` +
              `Reassign them first.`,
          )
        }
      },
    ],
  },
}
