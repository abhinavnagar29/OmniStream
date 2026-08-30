# OmniStream — Design system: "Signal"

## Subject
OmniStream reads a user's behavior across five distinct media channels
(movie, video, music, podcast, news) and explains *why* it recommended
something. The two things actually specific to this product: **channels**
(five genuinely different media types, not five tabs of the same thing) and
**explainability** (the "why this?" reasoning is the trust mechanism, not a
decoration).

## Signature element
A **spectrum bar** — a thin horizontal strip segmented into the five domain
colors, in a fixed order, used as a recurring identity mark (sidebar footer,
login card header, section dividers). It's a tuner/equalizer reading: five
channels, one signal. It appears once per screen, small, never as decoration
piled on top of itself.

## Palette
- `ink-950 #0B0C0E` / `ink-900 #141619` / `ink-800 #1C1F24` — graphite base,
  not blue-black, not warm cream. Panels get progressively lighter, not
  translucent-white-on-black everywhere.
- `paper #F3F1EA` — warm off-white for primary text, not pure `#fff`.
- `signal #E7A33E` — one accent, used for the one or two things that matter
  per screen (primary CTA, active nav, focus ring). Warm amber/gold,
  deliberately not the terracotta (`#D97757`) or acid-green/vermilion
  defaults.
- Domain hues — desaturated, distinct, systematic: movie `#6C93EE` (cool
  blue), video `#E2735A` (coral), music `#A57AE8` (violet), podcast
  `#4FB28C` (teal), news `#C9A227` (brass). Used identically everywhere a
  domain badge appears — not different pastel shades of "red-100" per
  component.

## Type
- **Fraunces** (display/headings) — a serif with real character, chosen
  because this is fundamentally a media/editorial product (movies, news,
  podcasts), not a generic SaaS dashboard; an editorial serif nods to that
  without being twee.
- **Inter** (body/UI) — clean, quiet, gets out of the way.
- **IBM Plex Mono** (data: scores, timestamps, relevance numbers, domain
  tags) — reinforces the "signal/measurement" feeling specifically where the
  product is showing you a number it computed, not for general UI chrome.

## What changed from the previous version
The previous palette was Tailwind's stock `blue-500` scale (unmodified) plus
an indigo→fuchsia→pink gradient logo mark and near-black background — the
literal default look, not a choice. Domain badges used raw Tailwind color
utilities (`bg-red-500/20`, `bg-pink-500/20`, ...) with no relationship to
each other. Both are replaced by the token system above.
