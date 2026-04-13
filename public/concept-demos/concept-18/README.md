# Concept 18

## Goal
Cinematic background with readable overlay UI. Uses a lightweight sample clip via HTTPS.

## Tech
- HTML
- CSS
- Vanilla JS
- HTML5 video

## Features
- Muted background video
- Gradient scrim
- Overlay CTA

## How to run
Each page loads **Tailwind CSS** from the official CDN plus a small companion `styles.css` for bespoke visuals. Asset URLs are **root-relative** (`/concept-demos/concept-18/…`) so CSS/JS load even without a trailing slash on the folder URL.

In development/production, open `/concept-demos/concept-18/` from the PROVIN site. For CDN-heavy concepts (maps, charts, video), prefer the deployed or `next dev` origin (not `file://`).

```bash
npm run dev
# then visit http://localhost:3000/concept-demos/concept-18/
```
