# provin-ctr-inbox: CheckThisReg -> PROVIN pasūtījums (Hetzner)

Nila «jā» 27.11.2026 (A). Nils pats pērk CheckThisReg atskaiti; šis darbinieks to automātiski ieliek PROVIN pasūtījumā.
**Sistēma NEKAD nepērk, netērē tokenus un neizsauc redeem / purchase / refund.** Uz checkthisreg.com iet tikai
`GET /api/guest/order/<id>?token=…` (sargs `guard_ctr_url`, testēts), PDF - tikai GET no
`storage.googleapis.com/checkthisreg.firebasestorage.app/orders/`.

## Plūsma

1. systemd taimeris ik 10 min -> `run.sh` -> `ctr_inbox.py` (tikai Python stdlib).
2. IMAP `imap.gmail.com` (Nila konts, `CTR_IMAP_USER`), mape ar `\All` (Visas vēstules), meklē
   `from:noreply@checkthisreg.com` pēdējās 35 dienās ar tēmu «Your Report is Ready!» vai «Update About Your Order».
   IMAP parole katrā gājienā no 1Password: `op-galv item get "$CTR_OP_ITEM" --vault "$CTR_OP_VAULT"
   --fields password --reveal` - netiek rakstīta diskā vai žurnālā.
3. Apstrādātie Message-ID: `/var/lib/provin-ctr-inbox/seen.json` (600). Pirmā palaišana = **bāzes līnija**: visi jau esošie
   e-pasti tikai atzīmēti, uz PROVIN nekas netiek sūtīts (lai vecie pirkumi neielīstu jau nosūtītos pasūtījumos).
4. E-pastam: guest saite -> `GET /api/guest/order/<id>` -> `documents[]` -> PDF lejupielāde -> PROVIN:
   - `POST /api/ctr/ingest {action:"document", …}` katram PDF (daļās pa 2 MB, md5)
   - `POST /api/ctr/ingest {action:"finalize", ctrOrderId, orderNumber, vin, manufacturer, emailKind, documents[]}`
   - gājiena beigās `{action:"retry_pending"}` (CheckThisReg dati, kam pasūtījums vēl nebija atrasts)
5. Kļūda (tīkls, 5xx, PDF vēl nav) -> nākamajā gājienā vēlreiz, līdz 12 mēģinājumiem. Guest saite 401/403/404 -> «failed».

## PROVIN pusē (`/api/ctr/ingest`, `lib/checkthisreg-ingest.ts`)

- Pasūtījums: jaunākais apmaksātais **dīlera datu** (priekšroka) vai **AUDITS/Business** pasūtījums ar šo VIN pēdējās 120 dienās,
  kas vēl nav nosūtīts klientam (`clientReportReadyAt` / dīlera sūtīšanas žurnāls tukšs). Nav -> gaidošo sarakstā + push
  «CheckThisReg bez pasūtījuma» (pievienosies pats, kad pasūtījums būs; 30 d).
- PDF parsē `lib/checkthisreg-pdf-parse.ts`: Renault «Operation Detail» + «Maintenance program», BMW vehicle history
  (Key Read / Repair / Service History, aprīkojums, eļļas intervāls). Cits formāts -> PDF + teksts RAW laukā, čips
  «jāapstrādā ar roku».
- Dīlera bloks: servisa rindas (sapludinātas pēc datuma+km), nobraukuma rindas, RAW, AI konteksts, ražotāja eļļas intervāls
  (tikai, ja grafikā tukšs). Darbi tulkoti latviski (RAW produkts - oriģinālvalodā). Klientam avota nosaukums netiek rādīts
  («Renault dīleris»).
- PDF pasūtījuma pielikumos (Blob `ctr/<sessionId>/…` + Dropbox pasūtījuma mapē).
- AI komentāri (eļļas intervāli + «Komentāri», tikai tukšie lauki) - tas pats dīlera ceļš ar visiem filtriem; darba statuss
  «datu nav» -> «Ielasīts». Push «CheckThisReg dati ievadīti - <VIN>».
- «Update About Your Order» bez PDF -> čips «CheckThisReg: nav datu» + push (statistikai).
- Statistika: Blob `ctr_inbox/_stats.json` (marka, modelis, gads, rezultāts).

## Uzstādīšana (root, Hetzner)

```bash
git -C /root/provin-galvenais/PROvin fetch origin
SRC=/root/provin-ctr-inbox-src && mkdir -p "$SRC"
git -C /root/provin-galvenais/PROvin archive origin/main relay/provin-ctr-inbox | tar -x -C "$SRC"   # main HEAD
bash "$SRC/relay/provin-ctr-inbox/install.sh"   # backup, kods -> /opt/provin-ctr-inbox, /etc/provin-ctr-inbox.env (600)
nano /etc/provin-ctr-inbox.env                   # CTR_INGEST_TOKEN (tas pats, kas Vercel), CTR_IMAP_USER, CTR_OP_ITEM
/opt/provin-ctr-inbox/run.sh --dry-run           # pārbaude: e-pasti + guest pasūtījumi, uz PROVIN nesūta
bash "$SRC/relay/provin-ctr-inbox/install.sh"   # otrreiz: bāzes līnija + taimeris
systemctl list-timers provin-ctr-inbox.timer
journalctl -u provin-ctr-inbox -n 50
```

Konkrētu jau esošu e-pastu ievadīt (pēc bāzes līnijas): `seen.json` izdzēš tā Message-ID ierakstu un palaiž `run.sh`.

Atslēgt: `systemctl disable --now provin-ctr-inbox.timer`. Atcelt pilnībā: backup no `/root/backups/provin-ctr-inbox-*`.

Testi: `cd relay/provin-ctr-inbox && python3 -m unittest test_ctr_inbox.py`; servera puse
`npx vitest run lib/checkthisreg-pdf-parse.test.ts lib/checkthisreg-ingest-logic.test.ts app/api/ctr/ingest/route.test.ts`.

## Env

| Kur | Mainīgais | Kas |
| --- | --- | --- |
| Vercel (Production, Sensitive) | `CTR_INGEST_TOKEN` | ≥ 24 zīmes (`openssl rand -hex 32`); bez tā maršruts izslēgts (401) |
| Hetzner `/etc/provin-ctr-inbox.env` | `CTR_INGEST_TOKEN` | tā pati vērtība |
| Hetzner | `CTR_IMAP_USER` | Nila Gmail adrese |
| Hetzner | `CTR_OP_ITEM` | 1Password ieraksta nosaukums ar Gmail IMAP paroli (glabātava `CTR_OP_VAULT`) |
| Hetzner (nav jāmaina) | `CTR_INGEST_URL`, `CTR_OP_CMD`, `CTR_OP_ITEM`, `CTR_OP_VAULT`, `CTR_STATE_DIR`, `CTR_LOOKBACK_DAYS` | noklusējumi parauga failā |

Atmiņa: darbinieks ~30 MB, `MemoryMax=400M`. Garākais solis - servera AI komentāri (līdz 5 min, `flock` - viens gājiens vienlaikus).
