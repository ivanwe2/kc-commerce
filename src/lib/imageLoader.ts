'use client'

import type { ImageLoaderProps } from 'next/image'

/**
 * next/image loader backed by Cloudflare Image Transformations.
 *
 * Next's built-in optimizer needs sharp, and sharp cannot run on Workers. So
 * resizing moves to the edge: Cloudflare fetches the original from R2, resizes
 * it, negotiates AVIF/WebP from the Accept header, and caches the result.
 *
 * Net effect versus pre-generated Payload imageSizes: any width is available
 * instead of three fixed ones, format selection is automatic, and storage stays
 * at one object per image.
 *
 * https://developers.cloudflare.com/images/transform-images/transform-via-url/
 *
 * NOTE: this file is referenced by `images.loaderFile` in next.config.ts, which
 * inlines it into the client bundle. It therefore cannot import from src/lib/env
 * (server-only zod validation) and reads the public flag directly — the one
 * sanctioned exception to the "never touch process.env" rule.
 */
export default function cloudflareImageLoader({ src, width, quality }: ImageLoaderProps): string {
  // Transformations require a Cloudflare zone. On workers.dev there is no zone
  // and /cdn-cgi/image returns 404 — so before a custom domain is attached we
  // must hand back the original URL untouched. Without this branch every image
  // on the pre-domain deployment silently breaks.
  //
  // String() is not redundant: `wrangler types` narrows process.env entries to
  // the literal values in wrangler.jsonc, so comparing against 'true' would be
  // a compile error ("types have no overlap") while the var reads "false".
  if (String(process.env.NEXT_PUBLIC_CF_IMAGES) !== 'true') {
    return src
  }

  // Data URIs and already-transformed URLs must pass through unmodified.
  if (src.startsWith('data:') || src.startsWith('/cdn-cgi/image/')) {
    return src
  }

  const params = [
    `width=${width}`,
    `quality=${quality ?? 82}`,
    // Serve AVIF or WebP based on what the client actually accepts.
    'format=auto',
    // Never upscale past the original — that costs bytes and buys nothing.
    'fit=scale-down',
    // Product photography is shot on white; stripping metadata trims payload.
    'metadata=none',
  ].join(',')

  return `/cdn-cgi/image/${params}/${src}`
}
