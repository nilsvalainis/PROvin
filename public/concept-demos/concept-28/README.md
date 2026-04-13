# Concept 28

## Goal
No frameworks, tiny assets, readable single-purpose landing.

## Tech
- HTML
- CSS
- Vanilla JS

## Features
- Sub-100KB total (excluding browser)
- No CDN dependencies
- Instant paint

## How to run
Each page loads **Tailwind CSS** from the official CDN plus a small companion `styles.css` for bespoke visuals. Asset URLs are **root-relative** (`/concept-demos/concept-28/…`) so CSS/JS load even without a trailing slash on the folder URL.

In development/production, open `/concept-demos/concept-28/` from the PROVIN site. For CDN-heavy concepts (maps, charts, video), prefer the deployed or `next dev` origin (not `file://`).

```bash
npm run dev
# then visit http://localhost:3000/concept-demos/concept-28/
```
