# Concept 09

## Goal
Theme toggle with smooth variable-driven transitions across surfaces.

## Tech
- HTML
- CSS custom properties
- Vanilla JS

## Features
- Animated theme toggle
- CSS variables for surfaces
- Persisted preference (localStorage)

## How to run
Each page loads **Tailwind CSS** from the official CDN plus a small companion `styles.css` for bespoke visuals. Asset URLs are **root-relative** (`/concept-demos/concept-09/…`) so CSS/JS load even without a trailing slash on the folder URL.

In development/production, open `/concept-demos/concept-09/` from the PROVIN site. For CDN-heavy concepts (maps, charts, video), prefer the deployed or `next dev` origin (not `file://`).

```bash
npm run dev
# then visit http://localhost:3000/concept-demos/concept-09/
```
