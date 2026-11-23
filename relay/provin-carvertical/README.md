# provin-carvertical: CarVertical atskaite fonā pēc Nila pogas (Hetzner, kredīti, sesija serverī)

Nils adminā pasūtījuma CarVertical blokā nospiež **"Pirkt CarVertical (fonā)"** un apstiprina dialogu. Tālāk viss notiek
serverī: relejs pārbauda "Manas atskaites", kredītu atlikumu, iztērē 1 kredītu, sagaida atskaiti, lejupielādē PDF;
PROVIN saglabā PDF pasūtījuma Dropbox mapē un ielasa to esošajā CarVertical parserī (tas pats ceļš kā PDF augšupielāde).
Apmaksa tikai ar **kredītiem** CarVertical kontā - karti, checkout un abonementu relejs neaiztiek.

| Fails | Kas |
| --- | --- |
| `server.mjs` | HTTP 127.0.0.1:8792, Bearer, Chrome profils, navigācijas bloķēšana, atzvans uz PROVIN |
| `lib/relay-core.mjs` | Rinda, pirkuma aizsardzība, VIN reģistrs (`state.json`), atlikuma kešs, PDF glabātuve (bez pārlūka, testējams) |
| `lib/cv-flow.mjs` | Pārlūka soļi: pieteikšanās + e-pasta kods, "Manas atskaites", kredīta pirkums, PDF |
| `lib/cv-page.mjs` | Lapu / API atbilžu atpazīšana, pirkuma lēmums, redakcija |
| `systemd/` | `provin-carvertical.service` + `provin-carvertical-xvfb.service` (:95) |
| `install.sh` | Backup + kods uz `/opt/provin-carvertical` + systemd (Caddy neaiztiek) |

Testi (repo saknē): `npx vitest run lib/carvertical-relay.test.ts lib/carvertical-auto.test.ts lib/carvertical-purchase.test.ts`.

## Kā CarVertical izskatās (pārbaudīts dzīvi 23.11.2026, bez pirkuma)

- `/lv/auth`: e-pasts + parole, neredzama reCAPTCHA (izgāja bez izaicinājuma). Hetzner IP ir Somijā - lapa piedāvā
  "Palikt valstī: Latvija" (`data-testid=stayInCurrentMarket`), relejs to nospiež.
- Pēc paroles **vienmēr** `/lv/auth/code`: "Tavs pierakstīšanās kods ir nosūtīts" - 6 rakstzīmju kods uz konta e-pastu
  (derīgs 15 min; CarVertical `requiresLoginCode`). Konta e-pasts ir Nila Gmail, kam serverim piekļuves nav, tāpēc kodu
  ievada **Nils** adminā (lauks "Kods no CarVertical e-pasta"). Pēc tam sesija paliek profilā (sīkdatnes pārdzīvo restartu).
- Konta dati nāk no lapas pašas pieprasījumiem uz `api.carvertical.net`, relejs tos tikai nolasa:
  `GET /user/quotas?productId=N` (kredīti), `GET /reports?productId=N` (atskaites: `id`, `vin`, `reportStatus` 10/20/30),
  `GET /reports/{id}/pdf/full?locale=lv` -> `pdfUrl` -> fails no `www.carvertical.com/pdf/...` (tieši tā strādā lapas poga).
- Pirkums ar kredītu: precheck lapā lietotājam ar kredītiem ir saite "Izmantot atskaiti" (`useOneReport`), kas ved uz
  atskaites lapu ar `vin=`/`encryptedVin=` (nevis uz checkout). Relejs spiež tikai to.

**Vēl nav redzēts dzīvi (vajag Nila kodu):** "Manas atskaites" pēc pieteikšanās, kredīta saites teksts precheck lapā,
atskaites lapas pirkuma brīdis. Neatpazītā solī relejs neko nespiež un ieraksta `debug/` (teksts bez e-pastiem, cipari -> #).

## Aizsardzība (kāpēc nevar nopirkt nejauši vai divreiz)

1. PROVIN: pirkums tikai ar `explicitOperatorConfirm: true` (poga + dialogs `CARVERTICAL_PURCHASE_CONFIRM_LV`);
   automātiskās plūsmas (Stripe, cron, VIN SCAN, ātrais vērtējums) šo kodu nesasniedz - importu grafa tests.
2. PROVIN: viens pirkums uz pasūtījumu (tas pats `requestId` / aktīvs uzdevums / jau saņemta atskaite -> nekas jauns).
3. Relejs: `POST /purchase` bez `confirm: true` -> 403. Tas pats VIN rindā -> tas pats uzdevums.
4. Relejs: pirms pirkuma "Manas atskaites" - ja šim VIN atskaite jau ir, lejupielādē to, **nepērk**.
5. Relejs: VIN reģistrs ierakstīts **pirms** klikšķa - pēc kļūdas / restarta tas pats VIN netiek pirkts otrreiz.
6. Relejs: pērk tikai, ja atlikums nolasīts un >= 1. Galvenā loga navigācija tikai `carvertical.com`, nekad
   `/checkout`, `/precheck/pricing`, `/billing`, `/subscription`, `/payment` (bloķēts pārlūka līmenī).
7. Captcha / nezināma lapa / VIN apstiprinājums -> `needs_human`, relejs neko neapiet.

## Plūsma

```
admin "Pirkt CarVertical (fonā)" -> POST /api/admin/carvertical {action:"purchase", confirm:true, requestId}
PROVIN -> POST /carvertical/purchase {vin, ref, requestId, confirm:true} -> {jobId}
relejs -> PROVIN /api/carvertical/relay-callback:
   {kind:"job", state: checking | awaiting_login | purchasing | waiting_report | downloading}
   {kind:"job", state:"result", reportId, existing, credits, pdfSize}  -> PROVIN paņem GET /carvertical/jobs/:id/pdf
   {kind:"job", state:"error", code}   insufficient_credits | already_purchased | no_credit_link | captcha | ...
   {kind:"session", state:"awaiting_code"}  -> push Nilam "ievadi kodu"
   {kind:"balance", credits}                -> kešs; < 5 -> sarkans + viens push dienā
PROVIN: PDF -> Blob + Dropbox `/_PROv/<auto>/CarVertical - VIN.pdf`; admin panelis vienreiz ievieto blokā (esošais parseris).
```

## Uzstādīšana (galvenais, root uz 37.27.149.106)

`/etc/provin-carvertical.env` (root 600) jau izveidots 23.11 ar `CARVERTICAL_RELAY_TOKEN`, `CARVERTICAL_EMAIL`,
`CARVERTICAL_PASSWORD` (no 1Password ar `op-galv`), `PROVIN_CARVERTICAL_CALLBACK_URL`. Vērtības nekad nedrukāt.

```bash
cd /root/provin-galvenais/PROvin && git pull   # pēc merge
tar -C relay/provin-carvertical --exclude node_modules -czf /root/provin-carvertical-src.tgz .
rm -rf /root/provin-carvertical-src && mkdir -p /root/provin-carvertical-src \
  && tar -C /root/provin-carvertical-src -xzf /root/provin-carvertical-src.tgz \
  && bash /root/provin-carvertical-src/install.sh
curl -s http://127.0.0.1:8792/carvertical/health          # {"ok":true,"credentialsSet":true,...}
```

Caddy (`csdd-relay.provin.lv` blokā, pirms CSDD catch-all, blakus `/ecsdd/*`), tad `systemctl reload caddy`:

```
	# PROVIN CarVertical relay (provin-carvertical.service); must stay before the CSDD catch-all
	handle /carvertical/* {
		reverse_proxy 127.0.0.1:8792 {
			transport http {
				response_header_timeout 200s
			}
		}
	}
```

Vercel env (Production, Sensitive): `CARVERTICAL_RELAY_URL=https://csdd-relay.provin.lv/carvertical`,
`CARVERTICAL_RELAY_TOKEN` (tā pati vērtība kā env failā). Bez tiem admin panelis nerāda neko jaunu (vecā poga paliek).

Pirmā reize: adminā "Pieslēgt CarVertical" -> Nils ievada kodu no e-pasta -> atlikums parādās. Žurnāls:
`journalctl -u provin-carvertical -f`; neatpazītas lapas: `ls /var/lib/provin-carvertical/debug/`.

Atcelšana: `systemctl disable --now provin-carvertical provin-carvertical-xvfb`; kill switch `POST /carvertical/logout`
(aizver pārlūku, izdzēš profilu); Vercel env noņemšana izslēdz paneli.

Atmiņa: viens Chrome (`MemoryMax=900M`). Serverim 3,7 GB - nepalaist paralēli smagus pārlūka testus.
