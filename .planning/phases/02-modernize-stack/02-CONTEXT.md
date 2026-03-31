# Phase 2: Modernize Stack - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning
**Source:** Direct user input

<domain>
## Phase Boundary

Replace the legacy build/runtime toolchain with modern equivalents. Webpack 4 -> Vite, React 18 with no deprecated warnings, THREE.js r150+, remove dead dependencies. The app must build and run identically after each step.

</domain>

<decisions>
## Implementation Decisions

### Upgrade Strategy
- **LOCKED:** Gradual, incremental upgrades. Each dependency upgrade is its own isolated step so version incompatibilities surface immediately and don't compound. Do NOT batch multiple major version jumps into a single task.
- **LOCKED:** React upgrade must be broken into sub-steps (e.g., fix deprecated lifecycles first, then upgrade react/react-dom, then verify). No big-bang React migration.

### Vite Migration
- **LOCKED:** One-shot swap from Webpack to Vite. The app is small enough that a direct replacement with verification is acceptable.
- Remove all Webpack config files and devDependencies after Vite is confirmed working.

### THREE.js Upgrade
- **Claude's Discretion:** Decide between minimal migration (only swap Geometry -> BufferGeometry) vs. fuller modernization based on research findings. User trusts planner judgment here.

### Legacy Dependency Removal
- **Claude's Discretion:** Decide the safest approach for removing jquery, underscore, and legacy mapbox-gl — audit and replace, or remove and fix. User trusts planner judgment here.

</decisions>

<specifics>
## Specific Ideas

- The gradual upgrade strategy is the user's top priority — they explicitly want to avoid debugging compounded version incompatibilities.
- The three.js pin to 0.91.0 exists because THREE.Geometry was removed in 0.125+. GlobeVisual.jsx uses it extensively. This is the hardest migration task.
- The accepted risk CVE (GHSA-fq6p-x6j3-cmmq) in three@0.91.0 gets resolved by this phase's THREE.js upgrade (MOD-03).

</specifics>

<deferred>
## Deferred Ideas

None — phase scope is well-defined by roadmap requirements MOD-01 through MOD-04.

</deferred>

---
*Phase: 02-modernize-stack*
*Context gathered: 2026-03-12 via direct user input*
