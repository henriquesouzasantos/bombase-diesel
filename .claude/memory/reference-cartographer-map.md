---
name: cartographer-map
description: The committed .cartographer/ map and what it gets wrong for this repo
type: reference
---

`.cartographer/` (committed 2026-11-09) holds the output of `/cartographer:map`:
`project-map.json`/`.mmd` (import graph), `class_diagram.mmd`, `segments.mmd`
(4 segments: `src`, `api@functions`, `src-misc`, `tailwind.config.js`).

Known blind spots:
- It doesn't detect routes on `express.Router()`. The 24 routes under `/api` in
  `functions/src/routes/*.ts` are missing from `endpoints.md`.
- False edge: `src/app/app.config.ts` → `functions/src/lib/http.ts`. The tool resolved
  `@angular/common/http` by file name. The frontend doesn't import backend code.

Regenerate it with `/cartographer:map .` and don't hand-edit it.
