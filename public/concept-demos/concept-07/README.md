# Concept 07

## Goal
Sticky split layout: narrative on the left, vehicle canvas on the right.

## Tech
- HTML
- CSS
- Vanilla JS

## Features
- Two-column split
- Sticky visual rail
- Scroll-tied caption swaps

## How to run
Each page loads **Tailwind CSS** from the official CDN plus a small companion `styles.css` for bespoke visuals. Asset URLs are **root-relative** (`/concept-demos/concept-07/…`) so CSS/JS load even without a trailing slash on the folder URL.

In development/production, open `/concept-demos/concept-07/` from the PROVIN site. For CDN-heavy concepts (maps, charts, video), prefer the deployed or `next dev` origin (not `file://`).

```bash
npm run dev
# then visit http://localhost:3000/concept-demos/concept-07/
```
