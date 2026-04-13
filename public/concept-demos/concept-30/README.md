# Concept 30

## Goal
Each reload randomizes hero layout, palette, and density — generative UI sketch.

## Tech
- HTML
- CSS
- Vanilla JS

## Features
- Random palette
- Shuffle section order
- Density mode

## How to run
Each page loads **Tailwind CSS** from the official CDN plus a small companion `styles.css` for bespoke visuals. Asset URLs are **root-relative** (`/concept-demos/concept-30/…`) so CSS/JS load even without a trailing slash on the folder URL.

In development/production, open `/concept-demos/concept-30/` from the PROVIN site. For CDN-heavy concepts (maps, charts, video), prefer the deployed or `next dev` origin (not `file://`).

```bash
npm run dev
# then visit http://localhost:3000/concept-demos/concept-30/
```
