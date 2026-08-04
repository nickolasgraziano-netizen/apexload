# ApexLoad Design System

Source of truth for visual style. Written from the [Step 1 audit](.) — it keeps everything that was already working (the color-token architecture, the two typefaces, the two-tier input system) and picks one winner for everything that had drifted into 2–4 competing variants.

This is a **visual-only** spec. Nothing here changes data models, routes, or behavior — applying it to a page should never change what that page *does*, only how it looks.

---

## 1. Color

The token architecture is the one thing the audit found zero problems with — keep it exactly as is. Four semantic tokens, each backed by a CSS custom property in `app/globals.css` so `components/ThemeSwitcher.tsx` can swap the whole palette at runtime. **Never** reach for a raw Tailwind color (`red-500`, `gray-800`, etc.) or a hardcoded hex — always a token.

| Token | Role | 950 | 900 | 800 | 700 | 600 | 500 | 400 |
|---|---|---|---|---|---|---|---|---|
| `steel` | Neutral — backgrounds, surfaces, borders | `#0B0D10` | `#13161B` | `#1B1F26` | `#262B33` | `#3A4149` | `#5B636D` | `#889099` |
| `chalk` | Text | — | — | — | — | — | `#A9A497` (500) | — |
| | | | | | | `#D8D4CA` (300) | | |
| | | | | | | `#F5F3EE` (100) | | |
| `copper` | Primary accent — CTAs, "go," standard mode | — | — | — | `#C9A400` (700) | `#E6BE00` (600) | `#FFD400` (500) | `#FFE066` (400) |
| `tungsten` | Secondary accent — alternate mode (TUT/cardio/superset), highlights, alerts | — | — | — | — | `#C4341F` (600) | `#E34234` (500) | `#FF6B57` (400) |

*(Hex values above are the default "Dragon & Chalk" theme. "Iron & Ember," the alt theme, swaps the same 4 roles to a different hue set — copper shifts to a hotter red-orange, tungsten shifts to electric blue. Both themes keep steel/chalk structurally identical. Adding a third theme means adding CSS variables, never new Tailwind classes.)*

**Semantic rules:**
- `steel-950` — page background only.
- `steel-900` — the default card/surface fill.
- `steel-800` — a surface nested *inside* another surface (compact inputs, chips-with-fill).
- `steel-700` — the default border color on a `steel-900` surface.
- `steel-600` — border color for interactive controls (buttons, inputs) and secondary-button borders.
- `steel-500` — border color specifically for standalone top-level form inputs.
- `steel-400` — reserved for disabled icons/glyphs only.
- `chalk-100` — primary text (headings, list-item titles, values).
- `chalk-300` — secondary text on a dark surface (body copy inside cards).
- `chalk-500` — tertiary text: captions, labels, placeholders, timestamps.
- `copper-500` — every *positive/primary* action: filled CTAs, active tab/toggle state, primary eyebrow labels.
- `copper-400` — text-on-dark for copper-toned ghost links and destructive-outline text.
- `copper-600`/`700` — hover/press shades and destructive borders.
- `tungsten-500` — secondary-mode accent fill (TUT badge, cardio, superset), alert/highlight card borders.
- `tungsten-400` — text-on-dark for tungsten labels and destructive-adjacent-but-not-destructive warnings (e.g. "you haven't logged this yet").

**Destructive actions are a copper *outline*, never a copper fill.** A filled `bg-copper-500` button always means "do the primary thing" (Save, Start, Add). An outlined `border-copper-600 text-copper-400` button always means "undo/remove" (Delete, Hide, Dismiss, Cancel-and-lose-data). This is the one real bug the audit found — `SetRow`'s Delete button uses neutral steel/chalk (indistinguishable from Cancel) and `DismissSessionButton` uses tungsten — both should move to the copper-outline pattern.

**Opacity scale** — five named uses, not eight ad hoc values:

| Use | Fill | Border | Notes |
|---|---|---|---|
| Floating chrome (sticky nav, FAB, dropdown) | `/90` | `/60` | always with `backdrop-blur-md` |
| Glass card (link-cards sitting on open page background) | `/60` | `/60` | always with `backdrop-blur-md` |
| Glass pill (secondary button on open background) | `/40` | `/60` | always with `backdrop-blur-md` |
| Tinted accent card (alert/highlight banners) | `/10` | `/60` | tungsten only; never a full-opacity border |
| Chip/badge fill | `/30` | none | copper or tungsten background behind a `[10px]` label |
| Disabled state | — | — | always `disabled:opacity-50`, no other value |

---

## 2. Typography

Three typefaces, each with one job. Don't introduce a fourth.

- **`font-display` — Barlow Condensed** (600/700/800). Headings and big numbers only. Condensed + heavy, reads as athletic/technical at large sizes — never use it below `text-lg`.
- **`font-body` — Manrope** (400/500/600). Running text. This is the `<body>` default — plain text with *no* font utility already renders in Manrope, so don't add `font-body` explicitly; it's redundant. Only reach for the class name if you need to force it inside an element that otherwise inherits `font-mono`/`font-display`.
- **`font-mono` — IBM Plex Mono** (400/500). Labels, data, anything that reads as "system output" rather than prose: eyebrows, captions, badges, stat captions, timestamps.

### Scale

| Style | Classes | Use |
|---|---|---|
| Page title | `font-display text-3xl font-extrabold text-chalk-100` | One per page, top of the screen. Includes the Home greeting — it's that page's title, so it gets the same size as every other page's H1. |
| Card/section title | `font-display text-lg font-bold text-chalk-100` | Heading inside a card (a choice-card's name, an entry's name). |
| Display number | `font-display text-2xl font-extrabold text-chalk-100 tabular-nums` | Big standalone numeric readouts (stat tiles, counters) — visually distinct from headings on purpose, always paired with `tabular-nums`. |
| Eyebrow / section label | `font-mono text-xs uppercase tracking-widest text-{copper-500\|chalk-500\|tungsten-400}` | The small all-caps tag above a title or above a group of content ("ApexLoad", "Set up", "Weekly volume by muscle group"). Always uppercase + tracked — that pairing is what makes it read as an eyebrow rather than a nav label. |
| Inline label / nav text | `font-mono text-xs text-{chalk-300\|chalk-500\|copper-400}` | Normal-case mono for things that behave like data or navigation, not section headers: nav-bar links, "Set 3", "Continue →". No uppercase, no tracking — that's what visually distinguishes it from an eyebrow. |
| Micro-label / badge | `font-mono text-[10px] uppercase tracking-widest text-{tungsten-400\|copper-400\|chalk-500}` | Chips and tiny inline tags (TUT, Custom, PR, Edit). Always paired with `tracking-widest`, even at this size. |
| Body | *(no font utility — inherits Manrope)* `text-chalk-100` or `text-chalk-300` | Primary readable text: names, values, prompts. |
| Secondary / caption, standalone | `text-sm text-chalk-500` | A help sentence or standalone caption long enough to read as a phrase. |
| Secondary / caption, inline | `text-xs text-chalk-500` | A short caption living inside a dense row or card, next to other content. |
| Error / destructive text | `text-sm text-copper-400` (standalone) or `text-xs text-copper-400` (inline) | Same size rule as captions above. |

---

## 3. Spacing & layout

**Page shell:** `<main className="min-h-screen px-5 pt-8 pb-24">`. That's every page. The one legitimate variant: a page with a *sticky/fixed bottom action bar* uses `pb-40` instead of `pb-24`, so content never sits under the fixed control — that's a deliberate rule now, not a one-off (currently only `workout/import/photo` needs it; apply the same logic anywhere else a fixed footer exists).

**Gap scale** — three steps, pick by relationship:
- `gap-2` — tight inline groups (an icon next to its label, two badges side by side).
- `gap-3` — items stacking inside a card, or a card's internal sections.
- `gap-4`/`gap-6` — separating distinct page sections.

**Card padding** — three named tiers, kept distinct on purpose (they carry different content density), but a *given* card always uses the tier that matches its type — no more picking padding ad hoc:
- **List row** — `px-4 py-3`. Scannable list items (exercise rows, template rows, history entries).
- **Section** — `p-4`. A standalone content block (a form panel, a choice-card, a banner).
- **Stat tile** — `p-3`. Compact numeric readouts in a grid.

---

## 4. Radius

Assigned by element type, not by file:

| Radius | Value | Use |
|---|---|---|
| `rounded-md` | 6px | Badges and chips only. |
| `rounded-lg` | 8px | Small/inline buttons, compact nested inputs, toggle pills, icon-only buttons. |
| `rounded-xl` | 12px | Primary CTAs, top-level form inputs, List-row and Glass-action cards. |
| `rounded-2xl` | 16px | Section cards and accent/alert banners — anything meant to read as its own distinct block on the page. |
| `rounded-full` | — | Circular elements only: avatars, color swatches, the theme FAB. Never a pill-shaped toggle — that's `rounded-lg`. |

`rounded-plate` (a 50%-radius token in `tailwind.config.ts`) is currently unused. Leave it defined but treat it as reserved specifically for circular "plate" motifs if `RotationWheel` or similar ever needs a literal Tailwind class instead of hand-drawn SVG — don't repurpose it as a generic `rounded-full` alias.

---

## 5. Buttons

Every button gets a free press-state from `globals.css` (`active:scale-96`) — never add a redundant custom `active:` class unless it's a real state change (e.g. a border-color swap), not just feedback.

| Variant | Classes | Use |
|---|---|---|
| **Primary, large** | `w-full rounded-xl bg-copper-500 px-4 py-4 text-center font-semibold text-steel-950 disabled:opacity-50` | The one main action on a screen: Save, Start workout, Log set. `py-4` — a deliberately large tap target, since this is used mid-workout with sweaty/hurried hands. |
| **Primary, small** | `rounded-lg bg-copper-500 px-3 py-1.5 text-xs font-semibold text-steel-950 disabled:opacity-50` | Inline confirm actions next to other content: Save (rename), Start (from a list), Unhide. |
| **Primary, small, full-width** | `w-full rounded-lg bg-copper-500 py-2 text-sm font-semibold text-steel-950 disabled:opacity-50` | A block-level but secondary-weight action inside a card, e.g. a per-row Save. |
| **Secondary, nested** | `rounded-lg border border-steel-600 px-3 py-1.5 text-xs text-chalk-300` | Bordered, no fill, no blur. Use whenever the button lives *inside* an already-opaque card or panel — Cancel, Edit, a picker-tab's unselected state. |
| **Secondary, glass** | `rounded-lg border border-steel-600/60 bg-steel-900/40 px-3 py-1.5 font-mono text-xs text-chalk-300 backdrop-blur-md` | Same role as above, but the control sits directly on the open page background (not inside a card) — top nav links, Home's utility pills. The blur is what separates it from the page's background glow; skip it and it looks like a mistake. |
| **Destructive** | `rounded-lg border border-copper-600 px-3 py-1.5 text-xs text-copper-400 disabled:opacity-50` | Delete, Hide, Dismiss, Remove. Outline only — see the color-rules note above for why this must never be a filled button. |
| **Destructive, large** | `w-full rounded-xl border border-copper-600 px-4 py-3 text-center text-sm text-copper-400 disabled:opacity-50` | A destructive action that's the primary action on its screen (e.g. "Delete this plan"). |
| **Ghost text link** | `font-mono text-[10px] uppercase tracking-widest text-chalk-500` (or `copper-400`/`tungsten-400` for emphasis) | Micro-actions with no button chrome at all: "Edit", "Add note". Add `underline` if it sits in a dense area where it needs an extra affordance to read as clickable. |
| **Toggle / segmented, active** | `rounded-lg bg-{copper-500\|tungsten-500} px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-steel-950` | Selected tab, filter, or mode switch. Copper for the "default/standard" option, tungsten for an "alternate" option (TUT vs. Standard, e.g.) — matches the same rule the color tokens already carry. |
| **Toggle / segmented, inactive** | `rounded-lg border border-steel-600 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-chalk-300` | Unselected sibling of the above. Always the flat "nested" treatment (toggles live inside a page/card, never as floating chrome) — never `rounded-full`. |
| **Icon / FAB** | `flex h-11 w-11 items-center justify-center rounded-full border border-steel-600/60 bg-steel-900/90 backdrop-blur-md` | Circular, floating-chrome icon buttons (theme switcher). |

---

## 6. Cards & containers

| Variant | Classes | Use |
|---|---|---|
| **List row** | `rounded-xl border border-steel-700 bg-steel-900 px-4 py-3` | Any scannable list item — exercises, templates, history entries, set rows. |
| **Section** | `rounded-2xl border border-steel-700 bg-steel-900 p-4` | A standalone panel: a form section, an "add custom exercise" block, an effort-breakdown card. |
| **Glass action card** | `rounded-xl border border-steel-700/60 bg-steel-900/60 px-4 py-3 backdrop-blur-md` | Navigational link-cards sitting directly on the open page background (Home's action links, workout/new's choice links). If the card lives inside another card or a solid section, use **List row** instead — translucency on top of an already-solid surface just looks muddy. |
| **Accent / alert card** | `rounded-2xl border border-tungsten-500/60 bg-tungsten-600/10 p-4` | A highlighted callout: PR banner, "resume this session" nudge, grouping-mode banner. Border is always `/60` — never full-opacity, even when the card is meant to be attention-grabbing; full-opacity border reads as an error state, which none of these are. |
| **Stat tile** | `rounded-xl border border-steel-700 bg-steel-900 p-3 text-center` | Compact numeric readout, typically in a grid alongside siblings of the same type. |
| **Dropzone / empty state** | `rounded-2xl border border-dashed border-steel-600 py-12 text-center` | File upload targets, empty-state prompts. |

---

## 7. Tables & data rows

ApexLoad doesn't use literal `<table>` elements today — its "table" is a horizontally-wrapping row of small chips (set history, workout detail). Formalize that pattern rather than retrofitting real tables onto a mobile-card app:

**Data-chip row** (the existing pattern, now named): `rounded-md bg-{steel-700|tungsten-600/30|copper-600/30} px-2 py-0.5 font-mono text-[10px] uppercase text-{chalk-300|tungsten-400|copper-400}` — one chip per data point (reps×weight, duration, a badge like TUT/PR/superset). Lay chips out with `flex flex-wrap gap-2`.

If a real `<table>` is ever needed (an admin/export view, say), carry the same tokens over rather than inventing new ones:
```
table: w-full border-collapse text-sm
th:    font-mono text-[10px] uppercase tracking-widest text-chalk-500 border-b border-steel-700 px-3 py-2 text-left
td:    text-chalk-100 border-b border-steel-800 px-3 py-2 tabular-nums (for numeric columns)
tr:hover: bg-steel-900
```
Wrap in a container with `overflow-x-auto` so a wide table never forces the page itself to scroll horizontally.

---

## 8. Forms

Two deliberate field sizes — not a bug, a hierarchy (a top-level field reads as "the thing you're filling out"; a compact field reads as "one value in a row you're editing"):

| Tier | Classes | Use |
|---|---|---|
| **Standard field** | `rounded-xl border border-steel-500 bg-steel-900 px-4 py-3 text-chalk-100 outline-none placeholder:text-chalk-500 focus:border-copper-500` | Top-level form fields — the main inputs on a page (name, date, notes, search). |
| **Compact field** | `rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-chalk-100 outline-none focus:border-copper-500` | A field nested inside a card or row — a reps/weight input in a set row, an inline rename field. |

- **Label:** `font-mono text-xs uppercase tracking-widest text-chalk-500`, sitting directly above its field with `gap-1`.
- **Textarea:** same classes as its size tier, plus `rows={N}`.
- **Select:** same classes as its size tier.
- **Checkbox:** native `<input type="checkbox">`, no custom styling needed — but add `accent-color: theme(colors.copper.500)` (inline style or a small utility class) so the browser-native check tint matches the brand instead of defaulting to blue.
- **Focus state:** always `focus:border-copper-500` — copper is the one color reserved for "this is active/selected," so it should never appear as a focus ring anywhere non-interactive.

---

## Applying this

Step 3 goes page by page: hold this file open, update one page or component's classNames to match the tables above, change nothing else (no new features, no behavior changes), then move to the next. The audit called out specific flagged variants per file — those are the concrete diffs each page needs.
