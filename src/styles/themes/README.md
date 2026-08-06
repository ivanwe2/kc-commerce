# Swapping the palette

The colour scheme is not signed off. Changing it is a one-file operation.

## Try an alternative theme

In `src/styles/globals.css`, change the second import:

```css
@import './theme.css'; /* default — blue */
```

to

```css
@import './themes/warm-slate.css'; /* alternative — teal/warm neutral */
```

Restart nothing, rebuild nothing in dev. That is the whole change.

## Adjust the current theme

Edit the **ramp** values at the top of `theme.css`. Every role — and therefore
every component — follows automatically.

To change what a colour is *for* rather than what it *is* (e.g. make sale prices
amber instead of red), repoint the role instead:

```css
--color-price-sale: var(--ramp-warning-600);
```

## The rule that makes this work

No component may contain a hex value or a numbered Tailwind colour
(`bg-blue-800`, `text-slate-400`). Components use roles only:
`bg-primary`, `text-muted`, `border-border-default`, `text-price`.

If a needed role does not exist, **add a role** — do not reach for a ramp step
or a literal. One leaked literal is how a theme becomes unswappable.
