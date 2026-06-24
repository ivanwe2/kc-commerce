import type { CollectionConfig } from 'payload'
import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

const slugify = (str: string): string =>
  str
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'sortOrder', 'isActive'],
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
      name: 'description',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      admin: {
        position: 'sidebar',
        description: 'Maximum 2 levels deep (grandparent > parent > child)',
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
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
  ],
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        // Prevent deletion if products reference this category
        const products = await req.payload.find({
          collection: 'products' as never,
          where: {
            categories: { contains: id },
          },
          limit: 1,
        })
        if (products.docs.length > 0) {
          throw new Error('Cannot delete category with associated products')
        }
        return true
      },
    ],
  },
}
