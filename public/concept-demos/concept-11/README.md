# Concept 11

## Goal
Canvas-driven energy orb with pulsing gradients — no heavy WebGL stack.

## Tech
- HTML
- CSS
- Canvas 2D
- Vanilla JS

## Features
- Animated gradient orb
- Pointer parallax nudge
- Lightweight loop

## How to run
Each page loads **Tailwind CSS** from the official CDN plus a small companion `styles.css` for bespoke visuals. Asset URLs are **root-relative** (`/concept-demos/concept-11/…`) so CSS/JS load even without a trailing slash on the folder URL.

In development/production, open `/concept-demos/concept-11/` from the PROVIN site. For CDN-heavy concepts (maps, charts, video), prefer the deployed or `next dev` origin (not `file://`).

```bash
npm run dev
# then visit http://localhost:3000/concept-demos/concept-11/
```
