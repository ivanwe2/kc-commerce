import {
  RichText as LexicalRichText,
  type JSXConvertersFunction,
} from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { cn } from '@/lib/utils'

/**
 * Renders Payload's Lexical rich text.
 *
 * Note what this is NOT: `dangerouslySetInnerHTML` over a stored HTML string.
 * Lexical content is a structured node tree, and Payload's converter walks it
 * into React elements. Text content can never be interpreted as markup, so
 * stored XSS through the CMS is not possible even if an editor account is
 * compromised.
 */
const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
})

export function RichText({
  data,
  className,
}: {
  data: SerializedEditorState | null | undefined
  className?: string
}) {
  if (!data) return null

  return (
    <div
      className={cn(
        // Typography is scoped here rather than applied globally so CMS content
        // cannot restyle the rest of the page.
        'max-w-prose space-y-4 text-base leading-relaxed text-body',
        '[&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-heading',
        '[&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-heading',
        '[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6',
        '[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6',
        '[&_a]:text-primary [&_a]:underline',
        '[&_strong]:font-semibold [&_strong]:text-heading',
        '[&_hr]:my-8 [&_hr]:border-border-default',
        className,
      )}
    >
      <LexicalRichText data={data} converters={converters} />
    </div>
  )
}
