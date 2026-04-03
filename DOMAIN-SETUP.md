# provin.lv — soli pa solim (no nulles, bez Anything)

Visu, kas jādara **Vercel** un **domēna reģistrā**, dara **tu** pārlūkā. Šis fails ir **secība**, ko sekot.

---

## Pirms sākuma — viena skaidra shēma

1. **Vienīgais** vietnes projekts = **Vercel** → repozitorijs **`nilsvalainis/PROvin`**.
2. **DNS** = tur, kur pirkts **`provin.lv`** (reģistrators vai, piemēram, Cloudflare).
3. Anything.com **neizmanto** — to var ignorēt.

---

## 1. solis: Vercel — pārbaudi projektu

1. Ej [vercel.com/dashboard](https://vercel.com/dashboard).
2. Atver **PROVIN** (vai kā saucas tavs projekts).
3. **Settings → Git** — jābūt savienojumam ar **GitHub** un repo **`PROvin`**.

Ja šeit viss kārtībā → **2. solis**.

---

## 2. solis: Vercel — notīri liekos domēnus (svarīgi)

Lai **www** nerāda „linked to another account”:

1. **Dashboard** → cauri **visiem** projektiem ( arī vecajiem testiem).
2. Katrā: **Settings → Domains**.
3. Ja redzi **`provin.lv`** vai **`www.provin.lv`** — **Remove** (izņemot **tavu galveno PROVIN projektu**, kur gribi lapu).

Ja neesi pārliecināts — **noņem tikai no projektiem, kas NAV galvenā PROVIN lapa**.

---

## 3. solis: Vercel — pievieno domēnu **tikai** šim projektam

1. Atver **pareizo** PROVIN projektu.
2. **Settings → Domains → Add**.
3. Vispirms ieraksti **`provin.lv`** → **Production** → **Add**.
4. Pēc tam **`www.provin.lv`** → **Production** → **Add**.

**Nekopē** neko no vecām instrukcijām — skaties **tikai** to, ko rāda **šis** projekts **tagad**.

---

## 4. solis: Vercel — nokopē DNS uzdevumus

1. Uzklikšķini uz **`provin.lv`** sarakstā.
2. Vercel parādīs **konkrētus** ierakstus (bieži **A** uz `@` un IP, piemēram `76.76.21.21` — **ņem tieši no ekrāna**).
3. Atkārto **`www.provin.lv`** — parasti **CNAME** `www` → `cname.vercel-dns.com` (vai kā prasa Vercel).

**Šos** ierakstus nākamajā solī ieliec pie reģistra.

---

## 5. solis: Reģistrators — DNS zona

1. Ieej tur, kur pārvaldi **`provin.lv`** DNS (DNS / Zona / Ieraksti).
2. Pievieno **tos pašus** ierakstus, ko **4. solī** nokopēji no Vercel.
3. Dzēs **vecus** konfliktējošus **A** ierakstus uz `@`, ja tie vēl ved uz citu hostu.

Saglabā. Gaidi **10–30 min**.

---

## 6. solis: TXT un „another account”

- Ja Vercel prasa **TXT** pie **`_vercel`** un tavs panelis **neļauj underscore** → skaties **`DEPLOY.md`** un sadaļu par **Cloudflare** vai reģistratora atbalstu.
- Ja vairs **nav** ziņas par „another Vercel account” — **TXT** var nebūt vajadzīgs; bieži pietiek ar **A + CNAME**.

---

## 7. solis: Vercel — pārbaude

1. **Settings → Domains** → **Refresh** pie **`provin.lv`** un **`www.provin.lv`**.
2. Mērķis: **Valid** / **Verified** (ne „Verification Needed”).

---

## 8. solis: Vides mainīgie

**Settings → Environment Variables** (Production):

| Mainīgais | Vērtība |
|-----------|---------|
| `NEXT_PUBLIC_SITE_URL` | `https://provin.lv` |

Pēc tam **Deployments → Redeploy** (vai jauns `git push`).

---

## 9. solis: Pārlūkā

Atver **`https://provin.lv`** — jāielādējas tava lapa.

---

## Ja iestrēgst

- **Build Logs** Vercel — ja sarkans, ielīmē kļūdu.
- **Domains** — ielīmē **precīzu** tekstu, ko rāda Vercel (DNS / kļūda).
- Terminālī: `dig provin.lv +short` — jāredz Vercel IP pēc DNS izmaiņām.
