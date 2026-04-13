# Concept 20

## Goal
Classic SaaS marketing stack: hero, pricing cards, testimonials.

## Tech
- HTML
- CSS
- Vanilla JS

## Features
- Three-tier pricing
- Fake testimonials
- Simple annual toggle demo

## How to run
Each page loads **Tailwind CSS** from the official CDN plus a small companion `styles.css` for bespoke visuals. Asset URLs are **root-relative** (`/concept-demos/concept-20/…`) so CSS/JS load even without a trailing slash on the folder URL.

In development/production, open `/concept-demos/concept-20/` from the PROVIN site. For CDN-heavy concepts (maps, charts, video), prefer the deployed or `next dev` origin (not `file://`).

```bash
npm run dev
# then visit http://localhost:3000/concept-demos/concept-20/
```
