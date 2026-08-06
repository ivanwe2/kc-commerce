import type { CollectionConfig } from 'payload'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * Uploads live in R2 (see `storage` in payload.config.ts).
 *
 * Note what is NOT here: imageSizes, crop, focalPoint. Those all require sharp,
 * which cannot run on Workers. Responsive variants are produced at request time
 * by Cloudflare Image Transformations instead — one stored original, any width
 * on demand. See src/lib/imageLoader.ts.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'filename',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Describes the image for screen readers and search engines. Required.',
      },
    },
  ],
  upload: {
    // Unsupported on Workers — no image processor available.
    crop: false,
    focalPoint: false,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    filesRequiredOnCreate: true,
    // Payload's safe-fetch guard exists to stop SSRF when an admin supplies an
    // image by URL. On Workers that protection is already enforced by the
    // runtime via the `global_fetch_strictly_public` compatibility flag, and
    // Payload's Node-oriented DNS check misbehaves there. Belt is redundant;
    // braces are load-bearing.
    skipSafeFetch: true,
  },
  hooks: {
    beforeOperation: [
      ({ req, operation }) => {
        if (operation !== 'create' && operation !== 'update') return

        const file = req.file
        if (!file) return

        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(`File exceeds the 5MB limit (received ${Math.round(file.size / 1024)}KB).`)
        }

        // Replace the client-supplied filename entirely. It is untrusted input,
        // and predictable names invite enumeration of the media library.
        const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin'
        file.name = `${crypto.randomUUID()}.${extension}`
      },
    ],
  },
}
