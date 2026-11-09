---
name: graphify-runs-locally
description: /graphify is a local tool on the user's Windows machine, not a cloud-session command
type: feedback
---

When the user types `/graphify`, they mean the graphify tool (`graphifyy`, installed with
`uv tool`) on their own Windows machine. It isn't installed in Claude Code cloud sessions.
The user runs it locally and uploads the output (`graph.html`, `.graphify_labels.json`,
`cost.json`).

**Why:** On 2026-11-09, `/graphify .` didn't run in the cloud session, so
`/cartographer:map` was used instead. The user then ran graphify locally and uploaded its output.

**How to apply:** If `/graphify` is requested in a cloud session, say that it isn't available
and ask for the uploaded output. Use `/cartographer:map` only as a fallback. When output is
uploaded, read the labels and the `RAW_NODES`/`RAW_EDGES` arrays in `graph.html`; the file
is about 470 KB, so don't read it whole.
