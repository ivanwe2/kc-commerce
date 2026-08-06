/**
 * Bulgarian Cyrillic → Latin transliteration, per the Streamlined System
 * (the official Bulgarian standard, and the one used on road signs and passports).
 *
 * This exists because the naive `str.replace(/[^\w\s-]/g, '')` approach silently
 * deletes every Cyrillic character: `\w` is ASCII-only without the `u` flag, so
 * "Почистващи препарати" slugifies to the empty string. Every Bulgarian-only
 * product would land on the same empty slug and collide on the unique index.
 */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sht',
  ъ: 'a',
  ь: 'y',
  ю: 'yu',
  я: 'ya',
}

function transliterate(input: string): string {
  let result = ''
  for (const char of input) {
    const lower = char.toLowerCase()
    const mapped = CYRILLIC_TO_LATIN[lower]
    result += mapped ?? char
  }
  return result
}

/**
 * URL-safe slug from arbitrary text, handling Latin and Bulgarian Cyrillic.
 *
 * Cyrillic slugs are technically valid in URLs but percent-encode badly when
 * shared, so Latin is preferred throughout.
 */
export function slugify(input: string): string {
  return transliterate(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}
