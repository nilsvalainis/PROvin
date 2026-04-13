# Concept 01

## Goal
Transparent glass UI with depth, fake VIN intelligence panel, and ambient light that follows the pointer.

## Tech
- HTML
- CSS (backdrop-filter)
- Vanilla JS

## Features
- Backdrop blur glass panels
- Animated hover lifts
- Fake VIN decode result card
- Mouse-driven radial highlight (CSS variables)

## How to run
Each page loads **Tailwind CSS** from the official CDN plus a small companion `styles.css` for bespoke visuals. Asset URLs are **root-relative** (`/concept-demos/concept-01/…`) so CSS/JS load even without a trailing slash on the folder URL.

In development/production, open `/concept-demos/concept-01/` from the PROVIN site. For CDN-heavy concepts (maps, charts, video), prefer the deployed or `next dev` origin (not `file://`).

```bash
npm run dev
# then visit http://localhost:3000/concept-demos/concept-01/
```
