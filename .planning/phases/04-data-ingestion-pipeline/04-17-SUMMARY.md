---
phase: 04
plan: 17
status: complete
completed: 2026-03-19
---

# Plan 04-17 Summary

**One-liner:** Removed geo precision reduction from IOM route_deaths ingestion — only war_events (globe) needs reduced coords.

## What was done
- Geo precision reduction removed from IOM ingestion pipeline for route_deaths
- route_deaths now store full-precision coordinates from IOM source data
- Only war_events (ACLED data for THREE.js globe) retains geo reduction
- Work completed outside GSD tracking during frontend data update session

## Notes
- Summary created retroactively — work was done but not tracked through GSD execution
