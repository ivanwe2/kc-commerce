import type { Field } from 'payload'

export const link: Field = {
  name: 'link',
  type: 'group',
  fields: [
    {
      name: 'type',
      type: 'radio',
      options: [
        { label: 'Internal', value: 'reference' },
        { label: 'External', value: 'custom' },
      ],
      defaultValue: 'reference',
    },
    {
      name: 'reference',
      type: 'relationship',
      relationTo: ['pages', 'products'],
      required: true,
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'reference',
      },
    },
    {
      name: 'url',
      type: 'text',
      required: true,
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'custom',
      },
    },
    {
      name: 'label',
      type: 'text',
      required: true,
    },
    {
      name: 'newTab',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}
