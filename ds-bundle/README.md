# CommonsHub (commonshub-brussels@0.1.0)

This design system is the published commonshub-brussels React library, bundled as a single
browser global. All 25 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.CommonsHub`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).
- `guidelines/` — the design system's own usage guidance (9 doc(s), see `guidelines/index.md`). Read these before composing larger layouts.

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.CommonsHub.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { AboutSection } = window.CommonsHub;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<AboutSection />);
```

## Tokens

320 CSS custom properties from commonshub-brussels. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (168): `--tw-border-style`, `--tw-shadow-color`, `--tw-inset-shadow-color`, …
- **spacing** (6): `--tw-space-y-reverse`, `--tw-space-x-reverse`, `--tw-inset-shadow`, …
- **typography** (14): `--tw-font-weight`, `--tw-tracking`, `--font-mono`, …
- **radius** (3): `--radius-xs`, `--radius-2xl`, `--radius`
- **shadow** (7): `--tw-shadow`, `--tw-shadow-alpha`, `--tw-ring-shadow`, …
- **other** (122): `--tw-translate-x`, `--tw-translate-y`, `--tw-translate-z`, …

## Components

### general
- `AboutSection`
- `Badge`
- `BookingSection`
- `Button`
- `Card`
- `Checkbox`
- `CommonsSection`
- `CommunityActivityGallery`
- `DiscordStatsDisplay`
- `EconomySection`
- `EmptyDataState`
- `EventsSection`
- `Hero`
- `HoverCard`
- `Input`
- `Label`
- `MembershipPreviewSection`
- `NewsletterSection`
- `OptimizedImage`
- `OtherMembers`
- `RecentContributors`
- `RoomBookingForm`
- `Select`
- `Textarea`
- `WorkshopsCTA`
