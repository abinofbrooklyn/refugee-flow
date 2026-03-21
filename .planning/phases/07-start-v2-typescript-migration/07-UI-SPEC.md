---
phase: 7
slug: start-v2-typescript-migration
status: draft
shadcn_initialized: false
preset: none
created: 2026-03-21
---

# Phase 7 — UI Design Contract

> Visual and interaction contract for Phase 7: TypeScript migration. This phase converts existing JS/JSX to TS/TSX and class components to functional components — no new UI surface area is introduced. The contract documents the existing design system as a preservation target. Executors MUST replicate these values exactly during conversion; no design changes are permitted.

---

## Phase 7 UI Context

**This is a code-conversion phase, not a design phase.** There are no new pages, no new interaction flows, and no new components being designed. The UI contract here serves one purpose: define the existing design system so that every converted TSX file preserves the correct visual output. If a converted component renders differently than its JSX predecessor, that is a regression.

The three-layer regression approach (snapshot tests, build check, manual smoke test) is the enforcement mechanism. This spec provides the ground truth for what "correct" looks like.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | none | codebase scan — no components.json, no Tailwind |
| Preset | not applicable | no shadcn |
| Component library | none | no Radix, no shadcn, no base-ui |
| Styling approach | styled-components v6 + SCSS | detected in src/components/, src/styles/ |
| Icon library | none detected | no icon library imports found |
| Font stack | Ubuntu, Roboto, Tajawal | src/styles/fonts.css via Google Fonts |

**shadcn gate result:** `components.json` not found. Project uses styled-components, not a component library. shadcn initialization is not appropriate for this migration phase — the stack is locked. No shadcn init required.

---

## Spacing Scale

Declared values (multiples of 4 only):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, annotation padding |
| sm | 8px | Compact element spacing, button padding |
| md | 16px | Default element spacing, panel padding |
| lg | 24px | Section padding, card gap |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions:
- Touch targets on globe controls: minimum 44px (accessibility floor for interactive THREE.js elements)
- GlobeModal overlay font-size 60px is display-only — not a spacing token

**Preservation rule:** Existing inline styles and styled-components values use ad-hoc pixel values. During TSX conversion, do NOT normalize spacing to the token scale above — preserve the exact pixel values from the source JSX. The token scale above is reference for NEW elements only (none expected in this phase).

---

## Typography

All values preserved from existing JSX source. Do not change during conversion.

| Role | Size | Weight | Line Height | Font | Usage | Source |
|------|------|--------|-------------|------|-------|--------|
| Body | 14px | 300 | 1.5 | Roboto | Paragraph text, about page body | Paragraph.jsx, DownloadLink.jsx |
| Label | 12px | 400 | 1.4 | Roboto | Nav sub-labels, instruction text | RefugeeRoute_titleGroup.jsx, Annotation.jsx |
| UI Text | 16px | 300 | 1.5 | Ubuntu | Nav links, route text | Navbar.jsx |
| Heading | 26px | 200 | 1.2 | Roboto | Route title group | RefugeeRoute_titleGroup.jsx |
| Display | 28px | 100–200 | 1.2 | Roboto / Tajawal | Accordion headings, globe orbit label | Accordion.jsx, GlobeContainer.jsx |

Font weights in use (2 primary, rest legacy):
- **300** — primary body weight (Roboto body text, Ubuntu nav links)
- **900** — primary brand weight (Ubuntu nav brand label)

Additional weights present in existing code: 100, 200, 400, 500, 700. These are preserved as-is during migration; do not consolidate during this phase.

**Preservation rule:** Typography is defined inline in styled-component template literals. Conversion to TSX must not alter any font-size, font-weight, font-family, or line-height value. Snapshot tests will catch regressions.

---

## Color

All values preserved from existing source. The app uses a dark navy color scheme appropriate for a museum exhibit visualization.

| Role | Value | Usage | Source |
|------|-------|-------|--------|
| Dominant (60%) | `#111116` | App background, globe scene background, main surface | reset.scss, GlobeVisual.jsx |
| Secondary (30%) | `#2d2d4a` | Navbar background, mobile landing nav, card surfaces | Navbar.jsx, MobileLanding.jsx |
| Accent — teal/green (10%) | `#00ffb0bd` | Active nav indicator, CTA highlight | Navbar.jsx, MobileLanding.jsx |
| Info blue | `#9cddf7` / `#8BDEFF` | About page links hover, accordion heading | Paragraph.jsx, Accordion.jsx |
| Text primary | `#ffffff` | Default text on dark background | global |
| Text secondary | `#a0a0b8` | Muted nav labels, annotation label text | Navbar.jsx, Annotation.jsx |
| Text muted | `#8a8fb0` | Annotation title text | Annotation.jsx |
| Overlay dark | `#0d0d18e0` | Annotation wrapper background | Annotation.jsx |
| Overlay panel | `rgba(20, 20, 35, 0.9)` | Annotation label card, panel overlays | Annotation.jsx |
| Error | `#ff6b6b` | Data fetch error message text | RefugeeRoute.jsx |
| Loading background | `#1a1a2e` | Loading state full-screen container | RefugeeRoute.jsx |

Accent reserved for: active navigation state indicator, loading spinner color reference.

**Preservation rule:** No color changes during migration. Every hex value and rgba in styled-component templates must be reproduced exactly in the converted TSX version. Snapshot tests catch color regressions at the rendered DOM level.

---

## Copywriting Contract

This phase introduces no new user-facing copy. The copywriting contract below documents existing copy that must be preserved unchanged during JSX-to-TSX conversion.

| Element | Existing Copy | Location | Preservation Required |
|---------|--------------|----------|-----------------------|
| Loading state | ScaleLoader spinner (no text) | RefugeeRoute.jsx | Yes — no text to preserve, keep spinner |
| Data fetch error | "Error loading data. Please try refreshing the page." (inline style p tag) | RefugeeRoute.jsx | Yes — exact copy must survive conversion |
| No new CTAs | — | — | No CTAs introduced in Phase 7 |
| No new empty states | — | — | No new empty states in Phase 7 |
| No destructive actions | — | — | No destructive actions in Phase 7 |

**Phase 7 introduces zero new user-facing copy.** The smoke test checklist (see below) is the verification mechanism for copy preservation.

---

## Interaction Preservation Contract

These interactions exist today and must continue to work after each conversion layer. The manual smoke test checklist enforces this.

| Interaction | Component | Verification Method |
|-------------|-----------|---------------------|
| Globe rotation toggle | GlobeContainer | Smoke test: click toggle, globe stops/resumes |
| Globe zoom (scroll/drag) | GlobeVisual | Smoke test: scroll on globe, camera zooms |
| Year timeline click | GlobeTimeline | Smoke test: click year, globe transitions |
| Route selection | GlobeRouteButton, RefugeeRoute_titleGroup | Smoke test: click route, map loads |
| Nav link navigation | Navbar | Smoke test: click all 4 nav links |
| About page accordion | Accordion | Smoke test: click accordion items expand/collapse |
| Admin CSV upload flow | Admin UI | Smoke test: POST /admin/csv/preview, preview table renders |
| Loading spinner | RefugeeRoute | Smoke test: throttle network, spinner appears |
| Error message | RefugeeRoute | Smoke test: simulate API 500, error text appears |

---

## Smoke Test Checklist

Run after each conversion layer (Redux, utils/api, data dictionaries, components, server). This is the formalized checklist referenced in CONTEXT.md and RESEARCH.md.

**Layer completion gate — all items must pass before merging a layer:**

### Landing
- [ ] Desktop landing page renders (globe background, title, subtitle)
- [ ] Mobile landing page renders (nav bar, video/background)
- [ ] "Explore" or equivalent CTA navigates to globe view

### Globe
- [ ] Globe renders with 3D earth texture
- [ ] Conflict data points appear on globe surface
- [ ] Globe rotation runs on load
- [ ] Globe rotation toggle button stops/resumes rotation
- [ ] Scroll zoom works on desktop
- [ ] Year timeline visible; clicking a year transitions the globe

### Routes
- [ ] At least 3 routes navigable from globe (e.g. Central Mediterranean, Eastern Mediterranean, Western Balkans)
- [ ] Route map loads with MapLibre/Carto dark basemap
- [ ] Route popup appears on point click
- [ ] IBC chart renders with asylum data
- [ ] Route title group displays route name and navigation arrows

### About
- [ ] About page renders with accordion sections
- [ ] Accordion items expand and collapse
- [ ] External links resolve (no 404s on visible links)

### Navigation
- [ ] Navbar links navigate to: globe, conflict, asylum, about pages
- [ ] Browser back/forward works after each nav action
- [ ] URL updates correctly for all routes (including /route/:arg)

### Admin
- [ ] /admin shows login prompt
- [ ] Correct shared secret grants access
- [ ] Wrong secret shows 401 error
- [ ] CSV upload preview renders table
- [ ] Cancel clears preview without committing

### API (server layer)
- [ ] /data/reduced_war_data returns JSON array
- [ ] /data/route_deaths returns JSON array
- [ ] /data/asy_applications returns JSON array

---

## TypeScript Type Preservation Contract

The following type-safety invariants must hold at the end of Phase 7. Executors treat these as acceptance criteria for type correctness.

| Invariant | Enforcement |
|-----------|-------------|
| `strict: true` in tsconfig.json from Wave 0 | `tsc --noEmit` must pass with zero errors on converted files |
| No `any` in Redux state types (RootState, AppDispatch) | Code review — `@ts-expect-error` allowed only with comment explaining why |
| `useAppSelector` / `useAppDispatch` used throughout (not raw `useSelector`/`useDispatch`) | Grep check: zero `import { useSelector } from 'react-redux'` in converted files |
| GlobeVisualHandle interface exported from GlobeVisual.tsx | Build check — GlobeContainer.tsx import must resolve |
| All 17 test files convert to .test.ts/.test.tsx | File existence check post-conversion |
| Vite build succeeds after each layer merge | `npm run build` — zero error output |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — shadcn not initialized |
| third-party | none | not applicable |

No third-party component registries are used in this phase. Phase 7 is a code-conversion phase; no new UI library dependencies are added.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
