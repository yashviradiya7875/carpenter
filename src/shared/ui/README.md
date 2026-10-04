# Design system (`src/shared/ui`)

Carpenter Pro's UI foundation: design tokens, base styles and accessible React
components. It is self-contained — it imports only `react` and `react-dom` and
nothing from `features/` — so the folder can be copied into another React +
Vite project as is.

## Setup

Load the styles once at the app entry (already done in `src/index.css`):

```css
@import './shared/ui/styles/index.css';
```

Then import components from the barrel:

```tsx
import { Button, Dialog, Field, TextInput } from '../../shared/ui'
```

## Structure

```
shared/ui/
  tokens/        tokens.css (CSS custom properties) · tokens.ts (JS mirror: breakpoints, durations, z-index)
  styles/        base.css (document defaults, focus ring, .sr-only, motion) · index.css (imports tokens + base)
  primitives/    single-purpose building blocks: Button (+ buttonClasses), Icon, Spinner, Skeleton, Field / TextInput / Select / Textarea
  components/    composed, with behavior: Alert, Dialog, ConfirmDialog, Menu, EmptyState, LoadingState, GeneratingLoader, Tabs, AnimatedGridPattern
  layout/        page structure: TopBar
  theme/         ThemeProvider, useTheme, ThemeToggle (light / dark)
  utils/         cx (class-name joiner), focus helpers (focusableWithin, trapFocus), usePrefersReducedMotion
  index.ts       public API — import from here, never from inner paths
```

Dependencies only point downward: `components` and `layout` may use `primitives`; `primitives` use only `utils` and tokens. Product-specific pieces (brand, copy, API calls) stay outside this folder — Carpenter Pro keeps its wordmark in `src/shared/components`.

## Tokens

Tokens come in two layers. **Primitives** (`--palette-*`) are raw values and
are never used directly. **Semantic tokens** are what components and features
use. Re-theme by overriding semantic tokens, e.g. under `[data-theme='light']`.

| Group | Tokens |
|---|---|
| Color — surfaces | `--color-canvas`, `-canvas-raised`, `-surface`, `-surface-raised`, `-surface-overlay`, `-surface-inset`, `-surface-hover`, `-surface-subtle`, `--color-backdrop` |
| Color — lines | `--color-line`, `-line-strong`, `-line-subtle` |
| Color — text | `--color-text`, `-text-secondary`, `--color-muted`, `-text-placeholder`, `-text-on-accent` |
| Color — brand | `--color-accent`, `-accent-hover`, `-accent-light`, `-accent-subtle`, `-accent-line`, `--color-highlight`, `--gradient-accent` |
| Color — status | `--color-{danger,success,warning,info}` plus `-text`, `-bg`, `-line` (danger also `-text-strong`, `-bg-strong`, `-bg-hover`) |
| Color — fields | `--color-field-bg`, `-bg-focus`, `-line`, `-line-hover` |
| Typography | `--font-ui`, `--font-display`, `--font-mono`; `--font-size-{2xs,xs,sm,md,base,lg,xl,2xl,3xl,4xl}` (10–40px); `--font-weight-{regular,medium,semibold,strong,bold}`; `--line-height-{none,tight,snug,normal}`; `--letter-spacing-{tight,normal,wide}` |
| Spacing | `--space-{0,0-5,1,1-5,2,2-5,3,4,5,6,8,10,12,16}` — 4px grid (`--space-4` = 16px) |
| Radius | `--radius-{xs,sm,md,lg,xl,full}`; roles `--radius-control`, `-panel`, `-dialog`, `-mark`, `-pill` |
| Borders | `--border-width`, `--border-width-strong`, `--border-subtle`, `--border-strong` |
| Shadows | `--shadow-{sm,md,lg}`, `--shadow-accent`, `--shadow-glow` |
| Elevation | `--z-{base,raised,sticky,dropdown,overlay,modal,popover,toast}` |
| Heights | `--control-height-{xs,sm,md,lg}` (28/32/38/44px), `--control-height-touch` |
| Motion | `--duration-{instant,fast,base,slow,slower,spin}`, `--ease-{standard,out,in,linear}`, `--transition-colors` |
| Breakpoints | `--breakpoint-{xs,sm,md,lg,xl}` = 380/520/760/1000/1280px (reference only — see below) |
| Focus | `--focus-ring`, `--focus-ring-{width,offset,color}`, `--focus-glow` |

**Breakpoints:** CSS can't read custom properties inside `@media`, so write the
literal value — `@media (max-width: 760px)` for md and below — and use
`maxWidth('md')` from `tokens.ts` in JS.

## Themes

Light and dark are defined entirely in `tokens/tokens.css`: `:root` is dark, and `:root[data-theme='light']` overrides the semantic tokens. Components and feature styles use semantic tokens only, so nothing else knows which theme is active.

- **Setup:** wrap the app in `<ThemeProvider storageKey="…">`, and add the pre-paint script from `index.html` (same key) so a saved theme applies before first render, without a flash.
- **Behavior:** the saved choice wins; without one, the OS preference applies and is followed live. A switch repaints in one frame (`.app-theme-switching` suppresses transitions briefly).
- **API:** `useTheme()` returns `{ theme, setTheme, toggleTheme }`; `<ThemeToggle />` is the header control (its label names the action, e.g. "Switch to light theme").
- **Rules:** never branch on the theme in CSS or components; add or adjust a semantic token instead. Purple is an accent only: primary actions, selection, focus. The light theme uses white and neutral surfaces with soft lavender tints. All pairs meet WCAG AA.

Main semantic tokens, beyond those listed above: `--color-panel` / `-panel-strong` (content panels), `--color-overlay-1…4` (neutral tints on any surface), `--color-line-faint` (dividers), `--color-accent-faint` / `-subtle` / `-line` / `-line-strong` / `-muted` / `-press`, `--color-highlight-subtle`, `--color-media-bg`, `--background-composer`, `--pattern-line` / `--pattern-sheen`, `--gradient-headline`, `--avatar-*`, `--shadow-button-primary` / `-composer` / `-card-hover`.

## Motion

Plain CSS: no animation library. Keyframes, enter utilities and the reduced-motion rule live in `styles/base.css`.

**Rules:** motion is fast (80–320ms), small (fades plus at most 8px of travel) and never bouncy or looping (spinners and the generating loader excepted). Elements animate in only; exits are instant, so closing never delays focus or state changes. The one exception is `Dialog`, which can leave with a short fade (150ms) when it is closed through its `open` prop.

| Interaction | Motion | Where |
|---|---|---|
| Press | `scale: 0.97`, 80ms (`scale`, not `transform`, so it composes with positioning) | `Button` |
| Hover / toggle | color transitions, `--duration-fast` | `--transition-colors` everywhere |
| Dialog | backdrop fades 150ms; panel rises 200ms; slides up as a sheet on phones (320ms). Closing via `open={false}`: backdrop fades and the panel sinks 6px in 150ms (the sheet slides back down, 200ms) | `Dialog` |
| Menu | scales in from the trigger corner, 150ms | `Menu` |
| Tooltip | fades and slides 4px after a 400ms hover delay | `Button tooltip` |
| Loading | fades in after `--duration-loading-delay` (150ms), so fast responses never flash a spinner or placeholders | `LoadingState`, `SkeletonGroup` |
| Loading placeholders | a soft band of light crosses each shape every 1.6s; still shapes under reduced motion | `Skeleton` |
| Feedback and new content | fades up 4px, 200ms | `Alert`, `EmptyState`, field errors |
| View change | fades in, 200ms | `.app-enter-fade` |
| Content appearing in place (lists, panels, expanded groups) | fades up 4px, 200ms | `.app-enter` |
| Side panel | slides in 12px from the inline end, 200ms | `.app-enter-end` |
| Ambient background | grid cells fade in and out over 4s at under 10% opacity, then move | `AnimatedGridPattern` |
| Long AI operation | a softly lit rim rotates (2.6s) while a wave passes through the word; only `transform` and `opacity` animate | `GeneratingLoader` |

Animations use `backwards` fill, so an element's own `transform` applies once the animation ends. To replay an enter animation when content changes, re-mount the element (`key={view}`).

**Reduced motion:** under `prefers-reduced-motion: reduce`, all animations and transitions are effectively disabled app-wide. Spinners keep a slow 1.6s rotation so loading stays perceivable.

## Components

| Component | Use for | Notes |
|---|---|---|
| `Button` | Every clickable action | See [Button](#button) below. |
| `Icon` | Inline SVG icons | `name`, optional `size`, `label` (omit = decorative). Inherits `currentColor`. |
| `Spinner` | Indeterminate loading inside other UI | `size` sm/md/lg; pass `label` unless nearby text already says what is loading. |
| `Skeleton` / `SkeletonText` / `SkeletonGroup` | Content that is loading and whose shape is known (lists, cards, images, fields) | `Skeleton` is one shape: `variant` text / block / circle, `width`, `height`, or a class. Give it the size of what it stands in for, ideally by placing it inside the real component's own layout classes (a row, a card), so nothing moves when the content arrives. `SkeletonText` is a few lines of text. Wrap a set in `SkeletonGroup`: it announces `label` once (`role="status"`), hides the shapes from assistive technology, takes the content's layout class (`className`) or `stack`, and appears after the loading delay. Colors from `--color-skeleton` / `--color-skeleton-sheen`. Show placeholders only while something is really loading. |
| `LoadingState` | A region whose content is loading and has no predictable shape | Spinner + visible message, `role="status"`. `compact` for one row in panels, dialogs and lists. |
| `GeneratingLoader` | Long AI operations (renders, generations) that take over a whole region | Animated orb around a word (`label`, default "Generating"). `message` for one status line, or `messages` + `messageInterval` to step through lines over time (the last one stays; they describe activity, so never promise "almost done"). `progress` (`value`, `max`, `label`) only for measured progress; omit it and the orb is the indeterminate state. `hint`, `showElapsed` (real elapsed time), `size` md/lg. Status is a `role="status"` region; the clock sits outside it. Colors from `--effect-loader-*` per theme. Under reduced motion nothing rotates; the glow keeps a slow fade. |
| `Menu` + `MenuItem` / `MenuLabel` / `MenuSeparator` | Dropdown action menus (row actions, account menu) | See [Menu](#menu) below. |
| `Tabs` | Switching what one panel shows (categories, filters) | `tabs` (`id`, `label`, optional `count`), `value`, `onChange`, `label`, `panelId`. One tab stop; arrow keys / Home / End move and select. Scrolls sideways when crowded. Give the controlled element `role="tabpanel"`. |
| `ThemeToggle` | Switching light / dark | Ghost icon button; needs `ThemeProvider` above it. |
| `AnimatedGridPattern` | Decorative page background | Fine grid with cells softly fading in and out. Fills its positioned parent; `pointer-events: none`; hidden from assistive technology. Props: `width` / `height` (cell px), `numSquares`, `duration`, `maxOpacity` (defaults to `--effect-grid-opacity`), `fade` (edge falloff, reshape via `--grid-mask`). Colors from `--effect-grid-line` / `--effect-grid-square` per theme. Holds still under reduced motion. Pure SVG + CSS, no animation library. |
| `TopBar` | Application header bar | `start` (brand) and `end` (actions) slots; `sticky`; passes header attributes through (e.g. `inert`). Height via `--app-topbar-height`; tighter on phones. |
| `Alert` | Inline feedback | `tone` info/success/warning/error. Errors and warnings use `role="alert"`; others `role="status"`. Optional `title`, `icon`, `onDismiss`. |
| `EmptyState` | Empty, no-results and no-access states | `icon`, `title`, `description`, `actions`, `compact`, `headingLevel`. |
| `Field` + `TextInput` / `Select` / `Textarea` | Form controls | `Field` wires the label, hint and error to the control (`id`, `aria-describedby`, `aria-invalid`). `TextInput` supports `startIcon` and `endSlot`. Controls also work without `Field` (give them an `aria-label`). |
| `Dialog` | Modal content | Portal-rendered. Escape closes the topmost dialog, focus is trapped and restored, the page behind can't scroll. `dismissible={false}` while saving; `onSubmit` makes the panel a `<form>`. Sizes sm 420 / md 520 / lg 900px; a bottom sheet on phones. Keep it mounted and toggle `open` to close with the exit animation (it is inert while leaving); unmounting it closes at once. |
| `ConfirmDialog` | Confirm or destructive prompts | `tone="danger"` gives a destructive button and trash icon; focuses Cancel first; `loading`, `error`. |

### Button

One component covers every case. All standard `<button>` and `aria-*` attributes pass through; `type` defaults to `"button"`.

| Prop | Values | Default |
|---|---|---|
| `variant` | `primary` · `secondary` · `outline` · `ghost` · `destructive` · `link` | `secondary` |
| `size` | `xs` 28px · `sm` 32px · `md` 38px · `lg` 44px | `md` |
| `shape` | `rounded` (forms) · `pill` (app chrome, dialog actions) | `rounded` |
| `icon` | an `IconName`, or any SVG element | — |
| `iconPosition` | `start` · `end` | `start` |
| `iconOnly` | square button; `icon` (or `children`) is the content | `false` |
| `loading` / `loadingLabel` | spinner in the icon slot, `aria-busy`, clicks ignored, focus kept | `false` |
| `disabled` | native disabled | `false` |
| `fullWidth` | stretch to the container | `false` |
| `tooltip` / `tooltipPlacement` | short hint on hover (400ms delay) and keyboard focus; Escape hides it | — / `top` |

What is standardized:

- **Size scale.** Height, horizontal padding, font size and icon size come from the size: xs 28/10/11/13px, sm 32/12/11/14px, md 38/12/12/15px, lg 44/16/13/17px. Icon-only buttons are square at the same height.
- **Type.** Geist semibold, line-height 1, no wrapping; long labels truncate with an ellipsis.
- **States.** Hover and active change color or brightness only. The button never sets `transform`, so consumers can position it freely. Focus shows `--focus-ring`. Disabled is 58% opacity with `not-allowed`. Loading keeps the button focusable but inert.
- **Touch.** On touch screens the hit area grows to 44×44px without changing the visual size.
- **Motion.** Color transitions use `--duration-fast`; reduced motion is respected.

Accessibility rules:

- An icon-only button needs an accessible name. `tooltip` doubles as the `aria-label`; otherwise pass `aria-label`. A console warning in development flags any that are missing.
- On a labelled button, `tooltip` is supplementary and wired up as `aria-describedby`.
- Tooltips don't show on disabled buttons, because those can't take focus. Explain why an action is unavailable in nearby text instead.
- For navigation use a real link styled the same way: `<a className={buttonClasses({ variant: 'secondary' })} href="/">`.

```tsx
<Button variant="primary" icon="plus">New folder</Button>
<Button variant="secondary" icon="arrow" iconPosition="end">Continue</Button>
<Button variant="ghost" iconOnly icon="trash" tooltip="Delete file" />
<Button variant="destructive" loading={isDeleting} loadingLabel="Deleting…">Delete</Button>
<Button variant="link" size="sm" onClick={showReset}>Forgot password?</Button>
<Button variant="primary" size="lg" fullWidth type="submit">Sign in</Button>
```

### Menu

A trigger plus a list of actions, following the WAI-ARIA menu button pattern.

- `trigger` is a render function: spread its props onto a `Button` (or any focusable element). It receives the ref, `aria-haspopup`, `aria-expanded` and `aria-controls`.
- Opens on click, or on ArrowDown / ArrowUp from the trigger. Arrow keys, Home and End move between items. Escape and Tab close it and return focus to the trigger. A click outside closes it.
- Choosing an item closes the menu and returns focus to the trigger before `onSelect` runs, so a dialog opened from `onSelect` restores focus correctly.
- Renders in a portal with fixed positioning, so scrolling or `overflow: hidden` containers can't clip it. It flips above the trigger when there's no room below and sits above dialogs (`--z-popover`).
- `align` (`end` default) lines it up with the trigger's right or left edge.

```tsx
<Menu trigger={(props) => <Button {...props} variant="ghost" size="sm" iconOnly icon="more" aria-label={`Actions for ${name}`} />}>
  <MenuItem onSelect={onRename}>Rename</MenuItem>
  <MenuItem onSelect={onMove}>Move</MenuItem>
  <MenuSeparator />
  <MenuItem tone="danger" icon="trash" onSelect={onDelete}>Delete folder</MenuItem>
</Menu>

<Menu label="Account" trigger={(props) => <button {...props} className="profile-trigger" aria-label="Open account menu">CP</button>}>
  <MenuLabel><strong>{userName}</strong>{roleName}</MenuLabel>
  <MenuSeparator />
  <MenuItem onSelect={onSignOut}>Sign out</MenuItem>
</Menu>
```

### Recipes (no extra component needed)

| Need | Use |
|---|---|
| Search field | `<TextInput type="search" startIcon="search" aria-label="Search files" />` |
| Inline error or success message | `<Alert tone="error">…</Alert>`; inside forms, put field errors on `Field error` |
| Error state for a whole region | `<EmptyState icon="alert" title="Couldn't load files" description={message} actions={<Button onClick={retry}>Try again</Button>} />` |
| Navigation link styled as a button | `<a className={buttonClasses({ variant: 'secondary' })} href="/">` |
| Short hint on an action | `Button tooltip` |

### Deliberately not components (yet)

Each of these appears once, or its instances differ too much to share an API. Revisit when a second real use appears.

| Pattern | Where | Why not |
|---|---|---|
| Breadcrumbs | Files only | Single use |
| Segmented control | Files view switcher only | Single use (category tabs are covered by `Tabs`) |
| Badge | Files access column only | Single use; plain text today |
| Card | Library product tile, Files grid item, upload-type option, render result | Different content, actions and selection behavior; a shared wrapper would just be a styled `div` |
| File / folder row, folder tree | Files only | Application-specific (Drive roles, favorites) — stays a feature component |
| Standalone Tooltip | — | `Button tooltip` covers action hints; the remaining native `title` uses are on composite controls |

### Examples

```tsx
<Button variant="primary" shape="pill" icon="check" loading={isSaving} loadingLabel="Saving…">
  Save
</Button>

<Field label="Folder name" error={nameError} required>
  <TextInput value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
</Field>

<Dialog
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="New folder"
  size="sm"
  onSubmit={createFolder}
  dismissible={!isCreating}
  footer={<>
    <Button shape="pill" onClick={() => setIsOpen(false)}>Cancel</Button>
    <Button variant="primary" shape="pill" type="submit" loading={isCreating}>Create folder</Button>
  </>}
>
  <Field label="Folder name"><TextInput autoFocus value={name} onChange={…} /></Field>
</Dialog>

<ConfirmDialog
  open={Boolean(target)}
  tone="danger"
  title={`Delete ${target?.name}?`}
  description="This permanently removes the collection and everything in it."
  confirmLabel="Delete collection"
  loading={isDeleting}
  error={deleteError}
  onConfirm={confirmDelete}
  onCancel={() => setTarget(null)}
/>
```

## Principles

- **Tokens over literals.** New CSS uses semantic tokens; add a token instead of repeating a value.
- **Accessible by default.** Visible focus (`--focus-ring`), labelled controls, correct roles and live regions, touch targets of 38px or more, and `prefers-reduced-motion` respected.
- **Low-specificity components.** Classes are `app-<component>` with BEM modifiers (`app-button--primary`). Pass `className` for feature-specific layout; avoid restyling component internals.
- **Composable, not configurable.** Components take content via `children` and slots (`footer`, `actions`, `endSlot`) rather than many flags.
- **Portable.** Never import from `features/` here. Product names, copy and API calls stay in features.
