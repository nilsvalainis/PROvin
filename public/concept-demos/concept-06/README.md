# Concept 06

## Goal
Dashboard-first story with Chart.js graphs for synthetic risk and mileage.

## Tech
- HTML
- CSS
- Vanilla JS
- Chart.js (CDN)

## Features
- Risk bar chart
- Mileage line chart
- Fake scores

## How to run
Each page loads **Tailwind CSS** from the official CDN plus a small companion `styles.css` for bespoke visuals. Asset URLs are **root-relative** (`/concept-demos/concept-06/…`) so CSS/JS load even without a trailing slash on the folder URL.

In development/production, open `/concept-demos/concept-06/` from the PROVIN site. For CDN-heavy concepts (maps, charts, video), prefer the deployed or `next dev` origin (not `file://`).

```bash
npm run dev
# then visit http://localhost:3000/concept-demos/concept-06/
```
