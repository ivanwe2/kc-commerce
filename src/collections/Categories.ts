import type { CollectionConfig } from 'payload'

import { activeOrAuthenticated, isAdminOrEditor } from '@/access'
import { slugify } from '@/lib/slugify'

export const Categories: CollectionConfig = {
  slug: 'categories',

  access: {
    read: activeOrAuthenticated,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },

  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'parent', 'sortOrder', 'isActive'],
    group: 'Catalogue',
  },

  defaultSort: 'sortOrder',

  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
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
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      maxDepth: 2,
      index: true,
      admin: {
        description: 'Optional parent category. Maximum three levels deep.',
      },
      filterOptions: ({ id }) => {
        // A category cannot be its own parent. Without this the admin happily
        // creates a cycle, and every recursive breadcrumb walk then hangs.
        if (!id) return true
        return { id: { not_equals: id } }
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'sortOrder',
          type: 'number',
          defaultValue: 0,
          admin: { description: 'Lower numbers appear first.' },
        },
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: true,
          index: true,
        },
      ],
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
    },
  ],

  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data

        if (!data.slug) {
          const source =
            typeof data.title === 'string'
              ? data.title
              : ((data.title as Record<string, string> | undefined)?.en ??
                (data.title as Record<string, string> | undefined)?.bg ??
                '')
          if (source) data.slug = slugify(source)
        }

        return data
      },
    ],

    beforeDelete: [
      async ({ id, req }) => {
        // Deleting a category out from under live products would leave them
        // pointing at nothing and drop them out of every category listing
        // without warning. Refuse, and say exactly how many are affected.
        const products = await req.payload.find({
          collection: 'products',
          where: { category: { equals: id } },
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })

        if (products.totalDocs > 0) {
          throw new Error(
            `Cannot delete: ${products.totalDocs} product(s) are still in this category. ` +
              `Move them to another category first.`,
          )
        }

        const children = await req.payload.find({
          collection: 'categories',
          where: { parent: { equals: id } },
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })

        if (children.totalDocs > 0) {
          throw new Error(
            `Cannot delete: ${children.totalDocs} subcategory(ies) still have this as their parent.`,
          )
        }
      },
    ],
  },
}
