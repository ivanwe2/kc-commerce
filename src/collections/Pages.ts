import type { CollectionConfig } from 'payload'

import { isAdminOrEditor, publishedOrAuthenticated } from '@/access'
import { slugify } from '@/lib/slugify'

/**
 * CMS-managed static pages (about, shipping info, and the body copy of the
 * legal pages).
 *
 * Phase 6 note: legal pages render through hardcoded templates that pull their
 * body from here. The mandatory sections must always be present regardless of
 * what an editor does, so the structure is not left to CMS content alone.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',

  access: {
    read: publishedOrAuthenticated,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },

  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'isPublished', 'updatedAt'],
    group: 'Content',
  },

  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'content',
      type: 'richText',
      localized: true,
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text', localized: true },
        { name: 'metaDescription', type: 'textarea', localized: true, maxLength: 320 },
      ],
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: false,
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
  },
}
