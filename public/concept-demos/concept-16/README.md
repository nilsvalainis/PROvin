# Concept 16

## Goal
CLI fantasy: VIN entry as a shell command with printed audit lines.

## Tech
- HTML
- CSS
- Vanilla JS

## Features
- Fake shell prompt
- Command parsing
- Typed log lines

## How to run
Each page loads **Tailwind CSS** from the official CDN plus a small companion `styles.css` for bespoke visuals. Asset URLs are **root-relative** (`/concept-demos/concept-16/…`) so CSS/JS load even without a trailing slash on the folder URL.

In development/production, open `/concept-demos/concept-16/` from the PROVIN site. For CDN-heavy concepts (maps, charts, video), prefer the deployed or `next dev` origin (not `file://`).

```bash
npm run dev
# then visit http://localhost:3000/concept-demos/concept-16/
```
