# Concept 14

## Goal
Single VIN field with instant validation feedback — nothing else competes for attention.

## Tech
- HTML
- CSS
- Vanilla JS

## Features
- 17-char VIN gate
- Live status chip
- No secondary chrome

## How to run
Each page loads **Tailwind CSS** from the official CDN plus a small companion `styles.css` for bespoke visuals. Asset URLs are **root-relative** (`/concept-demos/concept-14/…`) so CSS/JS load even without a trailing slash on the folder URL.

In development/production, open `/concept-demos/concept-14/` from the PROVIN site. For CDN-heavy concepts (maps, charts, video), prefer the deployed or `next dev` origin (not `file://`).

```bash
npm run dev
# then visit http://localhost:3000/concept-demos/concept-14/
```
