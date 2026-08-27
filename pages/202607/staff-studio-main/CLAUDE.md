# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single self-contained file — `staff-studio.html` — implementing an interactive standard five-line musical staff (五线谱) trainer. All HTML, CSS, and JavaScript live inline in that one file, wrapped in a single IIFE in the `<script>` block. There is **no build step, no package manager, no dependencies, no CDN, and no external fonts** — it must stay 100% offline-capable and open directly via `file://`. Edits go straight into `staff-studio.html`.

There is no test runner, linter, or task config in this repo. Do not invent build/test commands.

## Run & verify (Windows + headless Edge)

"Running" = open `staff-studio.html` in any browser. The established way to *verify behavior headlessly* (used throughout this codebase since there's no test runner) is Microsoft Edge screenshots, optionally with an injected harness:

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
& $edge --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
  --window-size=1180,1500 --screenshot="shot.png" --virtual-time-budget=3000 `
  "file:///C:/path/to/staff-studio.html"
```
Add `--mute-audio --autoplay-policy=no-user-gesture-required` when exercising playback. Edge clamps the minimum window width to ~470px; `--screenshot` captures the full window height, so use a tall `--window-size` to see the wrapped staff. Use `force-device-scale-factor=2` for crisp crops.

**Verification pattern** (how features get tested here): make a temporary copy of the file and inject `<script>` blocks, then screenshot:
- Seed state by writing `localStorage` (key below) in a script placed right after `<body ...>`, *before* the app script runs.
- Drive the app with synthetic events (`dispatchEvent` of `KeyboardEvent`/`MouseEvent`, button `.click()`, slider `input`/`change` events) and assert on the resulting DOM, then write a PASS/FAIL summary into a `position:fixed` banner so it shows in a top screenshot. Keyboard placement (focus the SVG, ArrowUp/Down, Enter) is deterministic and avoids pointer coordinate math. For pointer clicks, map a viewBox point to client coords via `svg.createSVGPoint().matrixTransform(svg.getScreenCTM())`.
Delete the temp copies and PNGs afterward.

## Architecture (the parts that span the file)

The script is organized into labeled `// =====` sections: `I18N`, `MUSIC MODEL`, `GEOMETRY`, `STATE`, `DOM`, `STAFF BASE`, `NOTE/LEDGER/ACCIDENTAL`, `POINTER/KEYBOARD INPUT`, `WEB AUDIO`, `PLAYBACK`, `PERSISTENCE`, `I18N APPLY`, `CONTROLS`, `INIT`.

### Pitch model (load-bearing — do not regress)
Pitch is stored as an **absolute diatonic index** `dia = octave*7 + letterIndex` (C=0…B=6). A note is `{id, dia, acc, dur}`. Clef-relative staff position is `step = dia - CLEF0[clef]` where `CLEF0 = {treble: 30 (E4), bass: 18 (G2)}`. Verified constants that must hold: treble bottom line = E4 (step 0), middle line = B4 (step 4); bass bottom = G2, middle = D3; middle C = C4 (one ledger below treble / above bass). `MIDI = (octave+1)*12 + semitone` (C4=60, A4=69); `freq = 440 * 2^((midi-69)/12)`. Stem rule: `step < 4` → up/right, `step >= 4` → down/left (middle line included). Toggling clef keeps each note's pitch class and transposes by octaves (±7 in `dia`) so it stays within `[MIN_STEP, MAX_STEP]`.

### Responsive multi-system layout
`computeLayout()` (called first in `render()` and on a debounced `resize`) sets `VB_W = svg.clientWidth`, then derives `LINE_X1` and `PER_SYSTEM` (notes per row). The SVG `viewBox` width tracks the real pixel width (`width:100%`, so ~1 unit = 1 CSS px) and its height grows with the number of rows (`nSystems()`). Consequently **notes wrap onto additional staff rows ("systems") as width shrinks — never a horizontal scrollbar**. Position helpers: `sysTop(s)`, `baseY(s)` (bottom line of system s), `stepY(step, s)` (note the minus sign: SVG y grows down, pitch up), `noteSys(i)`, `noteX(i)`. The editor is **append-only**: a click/keypress chooses pitch (from y), and the note always appends at the next slot — the hover ghost previews that landing slot while the pitch readout follows the cursor.

### Rendering layers & drawing rules
Four `<g>` layers, appended in order: `baseLayer` (staff lines + one hand-drawn clef per system, redrawn each render), `dynLayer` (notes + barlines, wiped and rebuilt), `hoverLayer` (ghost), `playLayer` (playhead). Two hard constraints, both deliberate:
- **Color notes/clefs via CSS classes**, never `var()` inside SVG presentation attributes (theming + cross-browser). Theme is a `data-theme="dark"` attribute on `<body>` overriding CSS custom properties.
- **All staff glyphs (clefs, noteheads, stems, flags, accidentals) are hand-drawn SVG**, never Unicode musical symbols (U+1D1xx) or a music font — those render as tofu on default Windows fonts.

### Playback
Tones are scheduled on the `AudioContext` clock (lazy-created, `resume()`d on first gesture). The playhead and active-note highlight are driven by `requestAnimationFrame` reading `audioCtx.currentTime`. `setActive(idx)` toggles the `.active`/`.playing` CSS classes on *existing* nodes — it must **not** call `render()`, to preserve keyboard focus and avoid re-announcing the (non-live) melody strip every frame. Resize is deferred (`pendingReflow`) while `isPlaying` to avoid a layout jump.

### i18n
`I18N = { zh, en }` dictionaries; `t(key, vars)` does `{placeholder}` substitution with English fallback. Static text uses `data-i18n` (textContent), `data-i18n-html` (innerHTML, for markup), `data-i18n-aria`, `data-i18n-title`; `applyLang()` walks these and re-runs the dynamic refreshers. **Any user-facing string must go through `t()` and be added to BOTH languages.** The `#status` aria-live region is intentionally *not* `data-i18n` (so `applyLang()` can't clobber/re-announce in-progress messages — it's seeded once in INIT). Default language follows `navigator.language`, then persisted value.

### Persistence
`localStorage` key `staffStudio.v3` stores `{notes, clef, tempo, volume, labelMode, theme, lang}` (notes serialized as `{dia, acc, dur}` only — the transient `_active` flag is excluded). `load()` validates every field and **range-clamps `dia`** to the drawable window, dropping out-of-range/corrupt entries (and re-saving if any were dropped). Bump the `v3` suffix if the stored shape changes.

## When changing layout/geometry constants
Re-verify (the regression-prone spots): the rightmost note in a full row stays inside `LINE_X1` (the `PER_SYSTEM` formula has no `+1` for this reason); the playhead sweeps a full slot on the last note of a row; ledger-line generation stays bounded; and a measure boundary that lands on a row break still draws a barline (at `LINE_X1`).
