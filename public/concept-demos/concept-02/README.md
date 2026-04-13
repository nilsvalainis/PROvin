# Concept 02

## Goal
ChatGPT-style auto expert with typing animation and canned VIN insights.

## Tech
- HTML
- CSS
- Vanilla JS

## Features
- Threaded chat UI
- Typing indicator
- Fake AI replies tied to VIN

## How to run
Each page loads **Tailwind CSS** from the official CDN plus a small companion `styles.css` for bespoke visuals. Asset URLs are **root-relative** (`/concept-demos/concept-02/…`) so CSS/JS load even without a trailing slash on the folder URL.

In development/production, open `/concept-demos/concept-02/` from the PROVIN site. For CDN-heavy concepts (maps, charts, video), prefer the deployed or `next dev` origin (not `file://`).

```bash
npm run dev
# then visit http://localhost:3000/concept-demos/concept-02/
```
