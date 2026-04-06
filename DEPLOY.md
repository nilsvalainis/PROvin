# PROVIN — izvietošana uz provin.lv (Vercel)

**Domēns soli pa solim (tīra secība):** skatīt **[DOMAIN-SETUP.md](./DOMAIN-SETUP.md)**.

## Ātrais ceļš — ko darīt pēc kārtas

### 1. Vercel projekts no GitHub

1. Ej uz [vercel.com/new](https://vercel.com/new) un pieslēdzies ar **GitHub**.
2. **Import** repozitoriju **`nilsvalainis/PROvin`** (vai jaunākais nosaukums, ja mainīji).
3. **Framework Preset:** Next.js (parasti atpazīst pats).
4. **Build:** `npm run build` · **Output:** noklusējums.
5. Spied **Deploy** — pēc minūtes būs **preview URL** (`*.vercel.app`). Tā jau ir „gaisā”, bet vēl bez tava domēna.

### 2. Vides mainīgie (obligāti pirms vai tūlīt pēc pirmā deploy)

Vercel → **Project → Settings → Environment Variables** → vismaz **Production**:

| Mainīgais | Vērtība |
|-----------|---------|
| `NEXT_PUBLIC_SITE_URL` | `https://provin.lv` | bez `/` beigās |
| `STRIPE_SECRET_KEY` | `sk_test_...` vai `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | pēc 5. punkta |
| `ADMIN_SECRET` | garš nejaušs (≥16 rakstzīmes) |
| `ADMIN_USERNAME` | — |
| `ADMIN_PASSWORD` | **spēcīga** parole (ne `admin/admin`) |
| `ADMIN_DEMO_ORDERS` | noklusējums: demo ieslēgts; iestatīt `0`, lai paslēptu |

Pārējie pēc `.env.example` (WhatsApp, e-pasti utt.).

Pēc izmaiņām: **Deployments → … → Redeploy** (vai jauns `git push`).

### 3. Domēns provin.lv

1. Vercel → **Project → Settings → Domains** → **Add** → ieraksti **`provin.lv`**.
2. Vercel parādīs **DNS ierakstus** (bieži: **A** uz `76.76.21.21` vai **CNAME** uz `cname.vercel-dns.com` — **precīzi skatīt savā Vercel ekrānā**).
3. Ieej **domēna reģistrā** (kur pirkts `provin.lv`) → **DNS** → pievieno **tos pašus** ierakstus.
4. Gaidi **5–30 min** (reizēm līdz ~48 h), līdz statusam Vercel ir **Valid Configuration**.
5. SSL (HTTPS) parasti ieslēdzas automātiski.

**www:** vari pievienot arī `www.provin.lv` un Vercel iestatīt **redirect** no `www` uz `provin.lv` (vai otrādi) sadaļā Domains.

### 4. Pārliecinies, ka `NEXT_PUBLIC_SITE_URL` = produkcija

Kad lapa atveras kā **`https://provin.lv`**, env **`NEXT_PUBLIC_SITE_URL`** jābūt **`https://provin.lv`**, lai Stripe atgriešanās un SEO būtu pareizi.

### 5. Stripe webhook (kad jau darbojas `https://provin.lv`)

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Developers → Webhooks** → **Add endpoint**.
2. URL: `https://provin.lv/api/webhooks/stripe`
3. Event: **`checkout.session.completed`**
4. **Signing secret** → Vercel → `STRIPE_WEBHOOK_SECRET` → **Redeploy**.

### Lokālais tests (Stripe CLI)

1. [Stripe CLI](https://stripe.com/docs/stripe-cli) — `stripe login`.
2. Vienā terminālī: `npm run dev` (Next.js uz `localhost:3000`).
3. Citā: `npm run stripe:listen` — CLI izdrukās **`whsec_…`** — ieliec `.env.local` kā **`STRIPE_WEBHOOK_SECRET`** (tikai šim termināļa sesijas laikam derīgs).
4. Testa maksājums caur lapu — webhook nonāk uz lokālo `/api/webhooks/stripe`.

### 6. Pārbaude

- [ ] `https://provin.lv` — sākumlapa
- [ ] Pasūtījums → Stripe → atgriešanās uz `/paldies`
- [ ] `https://provin.lv/admin` — ar produkcijas paroli
- [ ] Webhook notikumi Stripe (test vai live režīmā)

---

## Kas jau sagatavots projektā

- Git, `.gitignore`, `public/mobile-preview.png` nav repozitorijā.
- Kods ir paredzēts Vercel + Node (Next.js 15).

## Piezīmes

- **Repository not found** push laikā: pārbaudi GitHub URL un tiesības; repozitorijam jāeksistē un jābūt push tiesībām.
- Admin panelis: nepublicē paroli; izmanto garu `ADMIN_SECRET` un spēcīgu paroli.
- Juridisks: privātuma politika ir vietnē; pirms kampaņām var konsultēties ar juristu.

### Drošība (īsumā)

- **HTTP galvenes** (HSTS, X-Frame-Options u.c.) — `next.config.ts`.
- **Ierobežojums pēc IP** (`/api/admin/login`, `/api/checkout`) — atmiņā uz instanci; vairākās Vercel instancēs tas ir „mīksts”. Ja vajag stingru globālu limitu: **Upstash Redis** + `@upstash/ratelimit` (vēlāk).
- **security.txt** — `public/.well-known/security.txt` (atjaunini `Contact`, ja mainās e-pasts).
