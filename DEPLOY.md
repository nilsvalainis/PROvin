# PROVIN — izvietošana (provin.lv)

Īss ceļš uz **Vercel** + tavs domēns **provin.lv** (Next.js 15 ir ļoti piemērots Vercel).

## 1. Kods uz Git

- Ja vēl nav: izveido repozitoriju (GitHub / GitLab / Bitbucket) un push šo projektu.

## 2. Vercel projekts

1. Ej uz [vercel.com](https://vercel.com), pieslēdzies (iespējams ar GitHub).
2. **Add New → Project** → izvēlies repozitoriju.
3. Framework: **Next.js** (atpazīst automātiski).
4. **Build Command:** `npm run build` (noklusējums).
5. **Root Directory:** repo sakne (kur ir `package.json`).

## 3. Vides mainīgie (Vercel → Project → Settings → Environment Variables)

Iestatīt vismaz **Production** (un vajadzības gadījumā *Preview*):

| Mainīgais | Production piemērs | Piezīme |
|-----------|-------------------|---------|
| `NEXT_PUBLIC_SITE_URL` | `https://provin.lv` | **Bez** beigu `/`. Obligāti — Stripe atgriešanās URL un SEO. |
| `STRIPE_SECRET_KEY` | `sk_live_...` vai `sk_test_...` | Testēšanai var atstāt test atslēgu. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | No Stripe webhook (skat. zemāk). |
| `ADMIN_SECRET` | garš nejaušs teksts | Admin panelim `/admin`. |
| `ADMIN_USERNAME` | — | |
| `ADMIN_PASSWORD` | spēcīga parole | **Nemaini** `admin/admin` produkcijā. |
| `ADMIN_DEMO_ORDERS` | `0` vai tukšs | Demo pasūtījumi **izslēgti** dzīvajā vidē. |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | pēc vajadzības | Ja lieto paziņojumus. |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `ADMIN_NOTIFY_EMAIL` | pēc vajadzības | E-pasta paziņojumiem. |

Pārējie (`NEXT_PUBLIC_WHATSAPP_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, utt.) — kā `.env.example`.

Pēc izmaiņām: **Deployments → Redeploy** (vai jauns push).

## 4. Domēns provin.lv

1. Vercel → Project → **Settings → Domains** → pievieno `provin.lv` (un opcionāli `www.provin.lv`).
2. Reģistrā (kur pirkts domēns) iestati **DNS**, kā prasa Vercel (parasti **A** ieraksts uz Vercel IP vai **CNAME** uz `cname.vercel-dns.com` — precīzi rāda Vercel UI).
3. Gaidi SSL (parasti dažas minūtes pēc DNS propagācijas).

**Galvenais URL:** iestatīt `https://provin.lv` kā primāro un `NEXT_PUBLIC_SITE_URL` atbilstoši.

## 5. Stripe webhook (pēc tam, kad lapa jau atveras ar HTTPS)

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Developers → Webhooks** → **Add endpoint**.
2. URL: `https://provin.lv/api/webhooks/stripe`
3. Events: vismaz `checkout.session.completed`.
4. Iekopē **Signing secret** → Vercel env kā `STRIPE_WEBHOOK_SECRET`.

Maksājumu testēšanai izmanto **Test mode** atslēgas; pārslēdzoties uz **Live**, nomaini uz `sk_live_...` un izveido jaunu webhook Live vidē.

## 6. Pārbaude

- [ ] `https://provin.lv` — sākumlapa
- [ ] Pasūtījuma forma → Stripe Checkout → atgriešanās uz `/paldies`
- [ ] `https://provin.lv/api/webhooks/stripe` — nedrīkst būt 404 (POST izmanto Stripe)
- [ ] `/admin` — ielogojas ar produkcijas paroli; demo pasūtījumi izslēgti

## Piezīmes

- **Admin panelis** publiski neapspiež; izmanto spēcīgu paroli.
- Juridiski: privātuma politika jau ir vietnē; pirms mārketinga kampaņām pārbaudi tekstu ar juristu.
- Alternatīva Vercel: jebkurš VPS ar Node (Docker) + `npm run build` + `npm run start` + reverse proxy (Nginx) + SSL — vairāk uzturēšanas.
