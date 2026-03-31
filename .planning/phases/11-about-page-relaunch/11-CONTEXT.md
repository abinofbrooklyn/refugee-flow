# Phase 11: About Page Relaunch - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete redesign of the About page from a plain accordion layout to a cinematic narrative scroll experience. The page serves as the emotional on-ramp before visitors use the visualization — it must create a human connection quickly, explain what the tool does and where the data comes from, and launch them into the visualization. This is a relaunch: the project has evolved from a static student project to a live automated data visualization tool with 6 ingestion pipelines.

</domain>

<decisions>
## Implementation Decisions

### Layout
- Narrative scroll — scroll through distinct chapters, each a full visual moment
- NOT accordions, NOT grid/magazine, NOT single-column text
- Concise: the visitor should reach the "explore the data" moment quickly — not 10 screens of scrolling
- Team section must be prominent (not buried in footer) — this is a publicity opportunity

### Narrative structure
- Opening: human and grounding — lead with a single human moment, then zoom out to scale
- Video embed: short video of a refugee/displaced person's experience (design for embed, source later — YouTube/Vimeo placeholder)
- Data methodology woven into the story — as the narrative describes each visualization (globe, routes, charts), mention where the data comes from inline. No separate "methodology" section.
- CTA: launch directly into the visualization at the end
- Team and contact included as a prominent section within the narrative (not an afterthought)
- FAQ: keep existing Q&A content, integrate at the end

### Visual style
- Cinematic / editorial — large serif typography, generous whitespace, full-width sections
- Dark theme consistent with app (#1a1a2e background, cyan/teal accents)
- Each scroll section feels like turning a page
- Video section is immersive — borderless, centered
- Quiet confidence, inspired by NYT interactive features

### Data source attribution
- Hover/tap reveals on data numbers — numbers subtly underlined or have a small icon
- Hovering/tapping shows the source in a tooltip (e.g., "IOM Missing Migrants Project")
- Clean for casual readers, detailed for curious ones
- All 6 current sources must be attributable: IOM, UNHCR, Frontex, Eurostat, CBP, UK Home Office
- Plus ACLED when available (globe conflict data)

### Section flow (Claude's discretion on exact count and balance)
- Must include: human moment (video), what the tool does, data sources (woven), team/credits, CTA to visualization
- Must be concise — museum visitors won't scroll through a long article
- Team must be called out prominently — not a footer afterthought

### Claude's Discretion
- Exact number of scroll sections and their pacing
- Typography choices (serif family for headings, etc.)
- Scroll animation approach (CSS scroll-snap, intersection observer reveals, parallax, etc.)
- How the CTA launches into the visualization (which page — conflict globe or a default route)
- Video embed sizing and behavior (autoplay muted? click to play?)
- How to handle the existing DownloadLink component
- Whether to keep the Accordion component or replace entirely

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current About page
- `src/components/about/About.tsx` — Current component (accordion layout, 400ms fade-in)
- `src/components/about/config/accordionsConfig.tsx` — Content definitions (Mission, Vision, Team, Q&A, Data Sources)
- `src/components/about/accordion/Accordion.tsx` — Expand/collapse component
- `src/components/about/paragraph/Paragraph.tsx` — Text block component
- `src/components/about/downloadLink/DownloadLink.tsx` — Download link component

### App theme
- `src/components/Navbar.tsx` — Navigation bar (40px height, dark theme colors)
- `src/components/landing/DesktopLanding.tsx` — Landing page animations (reference for cinematic pacing)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- styled-components: used throughout for all styling — keep using it
- 400ms fade-in pattern: established in About.tsx and other components
- Dark theme colors: #1a1a2e (bg), #111117 (card bg), #0af5dd (cyan accent), #91eae3 (teal)
- Roboto font: used across the app for body text

### Established Patterns
- React functional components with hooks (TypeScript)
- styled-components with transient props ($prefixed)
- Route navigation via react-router-dom useNavigate

### Integration Points
- Router.tsx routeRegistry — About page mounted at /about
- Navbar — consistent across all non-landing pages
- Landing page — the About page may replace or complement the landing as the entry point

</code_context>

<specifics>
## Specific Ideas

- Museum exhibit context: visitors stand in front of large displays. The narrative should work at scale.
- "Every dot on this map is someone who didn't make it home" — this kind of emotional framing
- The video does the heavy emotional lifting faster than text can
- Data source hover/tap tooltips: subtle underline or small icon next to numbers, tooltip on interaction
- The project has won awards (Information is Beautiful, Awwwards) — the About page should feel worthy of that pedigree

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-about-page-relaunch*
*Context gathered: 2026-03-27*
