# provin-autodna: AutoDNA atskaite fonā pēc Nila pogas (Hetzner, kredīti, sesija serverī)

Nils adminā pasūtījuma AutoDNA blokā nospiež **"Pirkt AutoDNA (fonā)"** un apstiprina dialogu. Tālāk viss notiek
serverī: relejs AutoDNA pašai pajautā, vai šim VIN atskaite jau nopirkta, nolasa kredītu atlikumu, iztērē 1 kredītu,
lejupielādē PDF; PROVIN saglabā PDF pasūtījuma Dropbox mapē un ielasa to esošajā AutoDNA parserī (tas pats ceļš kā PDF
augšupielāde). Apmaksa tikai ar **kredītiem** www.autodna.lv kontā - karti, pakas un bankas relejs neaiztiek.
AutoDNA partnera API (`lib/autodna-api.ts`, pauzē) relejs NElieto.

Uzbūve tā pati kā `relay/provin-carvertical` (port 8793, Xvfb :94, lietotājs `provin-autodna`).

| Fails | Kas |
| --- | --- |
| `server.mjs` | HTTP 127.0.0.1:8793, Bearer, Chrome profils, navigācijas bloķēšana, atzvans uz PROVIN, Chrome aizvēršana dīkstāvē |
| `lib/relay-core.mjs` | Rinda, pirkuma aizsardzība, VIN reģistrs (`state.json`), atlikuma kešs, PDF glabātuve (bez pārlūka, testējams) |
| `lib/dna-flow.mjs` | Pārlūka soļi: pieteikšanās, konts (/ajax), "Manas atskaites", kredīta pirkums, PDF, `probe` |
| `lib/dna-page.mjs` | Atbilžu / lapu atpazīšana, pirkuma lēmums, redakcija |
| `lib/dna-precheck.mjs` | Bezmaksas priekšpārbaudes (`/vin/<VIN>`) parseris un pirkuma aizsargs (TS `parseAutodnaPrecheckHtml` kopija) |

Testi (repo saknē): `npx vitest run lib/autodna-relay.test.ts lib/autodna-auto.test.ts`.

## Kā AutoDNA izskatās (pārbaudīts dzīvi 24.11.2026 no Hetzner, bez pirkuma)

- Sākumlapa un `/ajax/*` bez Cloudflare. Sīkdatņu logs (consentmanager) - relejs spiež "Noraidīt visu".
- Pieteikšanās: galvenes poga -> forma `#form-login` (e-pasts, parole, noteikumu ķeksis) -> `POST /ajax/client_login`
  -> `{is_valid, default_error}`. 24.11 rītā vecā 1Password parole neder; **24.11 pēcpusdienā Nils iestatīja paroli
  (1Password «Cowork Claude» vārdā «www.autodna.lv» ir divi ieraksti - jāņem 24.11 izveidotais, vecais neder) -
  pieteikšanās strādā, e-pasta koda / 2FA nav.** Pēc nepareizas paroles relejs 6 h nemēģina vēlreiz (bloķēšanas risks).
- `POST /ajax/client_is_login` (vin=...) -> `client_id`, `report_bought`, `report_date`: ielogots? + vai VIN jau nopirkts.
- `GET /ajax/get_client_credits` -> `data[{report_code:"report_autodna_vhr", limit}]`: kredītu atlikums (nolasīts dzīvi).
- "Manas atskaites": `/profile/history` (`.report-item`, 5 lapā, pēdējie 3 mēn.), meklēšana `?search=<VIN>&user_search=1`;
  saite "Atskaite autoDNA" -> `/vin/<VIN>/<slug>/<žetons>/autodna_vhr`. Tur "Lejupielādēt" -> `#report-link`
  (`POST /ajax/get_report_file`) -> lejupielāde `/rcontent/.../1.pdf` (mPDF, ~0,7 MB). **PDF lejupielāde pārbaudīta dzīvi**
  ar jau nopirktu atskaiti (kredīti netiek tērēti).
- `/vin/<VIN>` (priekšpārbaude + grozs ar "maksāt ar kredītiem" `#payment-select-credit`) no Hetzner IP rāda
  **Cloudflare Turnstile ķeksi "Verificējiet, ka esat cilvēks" - arī ielogotam lietotājam**. Relejs to NEAPIET: kļūda
  `turnstile`, push Nilam ar saiti; Nils atver saiti savā pārlūkā, apstiprina un spiež pogu vēlreiz (vai tad relejam grozs
  atveras bez Turnstile - nav pārbaudīts). Tāpēc kredītu apmaksas izvēle, kopsumma un apmaksas poga **vēl nav redzēta**.

Pirkuma poga tiek spiesta tikai ar `AUTODNA_PURCHASE_LIVE=1`; līdz tam pirkums ir **sauss** (viss pārbaudīts, ieskaitot
kredītu izvēli un 0 € kopsummu, bet poga netiek spiesta, kļūda `dry_run`, admin panelī pirkuma poga netiek rādīta).
"Ielādēt nopirkto" strādā jau tagad (pēc pirkuma ar roku PDF nonāk pasūtījumā). Neatpazītā solī relejs neko nespiež un
ieraksta `debug/` (teksts bez e-pastiem, cipari -> #).

## Aizsardzība (kāpēc nevar nopirkt nejauši vai divreiz)

1. PROVIN: pirkums tikai ar `explicitOperatorConfirm: true` (poga + dialogs `AUTODNA_PURCHASE_CONFIRM_LV`);
   automātiskās plūsmas (Stripe, cron, VIN SCAN, ātrais vērtējums) šo kodu nesasniedz - importu grafa tests.
2. PROVIN: viens pirkums uz pasūtījumu (tas pats `requestId` / aktīvs uzdevums / jau saņemta atskaite -> nekas jauns).
3. Relejs: `POST /purchase` bez `confirm: true` -> 403. Tas pats VIN rindā -> tas pats uzdevums.
4. Relejs: pirms pirkuma `client_is_login` - ja AutoDNA saka "jau nopirkts", lejupielādē, **nepērk**.
5. Relejs: VIN reģistrs ierakstīts **pirms** klikšķa - pēc kļūdas / restarta tas pats VIN netiek pirkts otrreiz.
6. Relejs: pērk tikai, ja atlikums nolasīts un >= 1, grozā redzama kredītu apmaksa, kopsumma 0 € un tieši viena apmaksas
   poga (nekad "karte", "paka", "bizness"). Galvenā loga navigācija tikai `autodna.lv`, nekad `/pakas`, `/biznesa-pakas`;
   `/payment/*` tikai pirkuma klikšķa logā; bankas / karšu vārtejas citos domēnos bloķētas.
7. Turnstile / captcha / nezināma lapa -> kļūda, relejs neko neapiet. `AUTODNA_PURCHASE_LIVE` nav 1 -> sausais režīms.
8. **Nila likums 25.11 (KATEGORISKS):** pirms jebkuras pirkuma darbības relejs tajā pašā pārlūkā atver `/vin/<VIN>` un
   nolasa bezmaksas priekšpārbaudi. Pērk TIKAI, ja «Auto arhīva fotogrāfijas» vai «Transportlīdzekļa vēsture» rāda >0
   ierakstu. Abi 0 -> `precheck_no_records`; lapa nav gatava (Turnstile «Meklē pieejamo informāciju…»), kļūda vai
   nezināms formāts -> `precheck_unavailable`. Kredīts netiek tērēts, VIN reģistrā nepaliek. Pārbaude atkārtojas arī
   pirkuma solī tieši pirms klikšķa. Jau nopirktu atskaiti (`report_bought`) lejupielādē bez priekšpārbaudes.
   PROVIN (`/api/admin/autodna/fona`) to pašu pārbauda pirms sūtīt relejam (otrais līmenis).

## Plūsma

```
admin "Pirkt AutoDNA (fonā)" -> POST /api/admin/autodna/fona {action:"purchase", confirm:true, requestId}
PROVIN -> (ja nav svaigas priekšpārbaudes) POST /autodna/precheck {vin} -> {allowed, code?, photos, history}
PROVIN -> POST /autodna/purchase {vin, ref, requestId, confirm:true} -> {jobId}
relejs -> PROVIN /api/autodna/relay-callback:
   {kind:"job", state: checking | awaiting_login | purchasing | waiting_report | downloading}
   {kind:"job", state:"result", existing, credits, pdfSize}  -> PROVIN paņem GET /autodna/jobs/:id/pdf
   {kind:"job", state:"error", code}   precheck_no_records | precheck_unavailable | turnstile | insufficient_credits | dry_run | ...
   (notikumos `precheck: {photos, history}` - priekšpārbaudes skaitļi)
   {kind:"session", state:"needs_human", code}  -> push Nilam (viens par katru iemeslu)
   {kind:"balance", credits}                    -> kešs; < 5 -> sarkans + viens push dienā
PROVIN: PDF -> Blob + Dropbox `/_PROv/<auto>/AutoDNA - VIN.pdf`; admin panelis vienreiz ievieto blokā (esošais parseris).
```

## Uzstādīšana (galvenais, root uz 37.27.149.106)

`/etc/provin-autodna.env` (root 600) izveidots 24.11 ar `AUTODNA_RELAY_TOKEN`, `AUTODNA_WEB_EMAIL`,
`AUTODNA_WEB_PASSWORD` (no 1Password ar `op-galv`, 24.11 izveidotais «www.autodna.lv» ieraksts),
`PROVIN_AUTODNA_CALLBACK_URL`. Pievienot `AUTODNA_PURCHASE_LIVE=0`. Vērtības nekad nedrukāt.

```bash
cd /root/provin-galvenais/PROvin && git pull   # pēc merge
tar -C relay/provin-autodna --exclude node_modules -czf /root/provin-autodna-src.tgz .
rm -rf /root/provin-autodna-src && mkdir -p /root/provin-autodna-src \
  && tar -C /root/provin-autodna-src -xzf /root/provin-autodna-src.tgz \
  && bash /root/provin-autodna-src/install.sh
curl -s http://127.0.0.1:8793/autodna/health          # {"ok":true,"credentialsSet":true,"purchaseLive":false,...}
```

Caddy (`csdd-relay.provin.lv` blokā, pirms CSDD catch-all, blakus `/carvertical/*`), tad `systemctl reload caddy`:

```
	# PROVIN AutoDNA relay (provin-autodna.service); must stay before the CSDD catch-all
	handle /autodna/* {
		reverse_proxy 127.0.0.1:8793 {
			transport http {
				response_header_timeout 200s
			}
		}
	}
```

Vercel env (Production, Sensitive): `AUTODNA_RELAY_URL=https://csdd-relay.provin.lv/autodna`,
`AUTODNA_RELAY_TOKEN` (tā pati vērtība kā env failā). Bez tiem admin panelis nerāda neko jaunu.

Pirmā reize: adminā "Pieslēgt AutoDNA" -> atlikums parādās. Tad (bez pirkuma) pirkuma lapas pārbaude ar VIN, kas
kontā vēl nav nopirkts:
`curl -s -X POST -H "Authorization: Bearer $TOKEN" -d '{"vin":"..."}' http://127.0.0.1:8793/autodna/probe`
-> `decision.step` = `ready` un viena apmaksas poga; `ls /var/lib/provin-autodna/debug/`. Tikai tad
`AUTODNA_PURCHASE_LIVE=1` + `systemctl restart provin-autodna`. Žurnāls: `journalctl -u provin-autodna -f`.

Atcelšana: `systemctl disable --now provin-autodna provin-autodna-xvfb`; kill switch `POST /autodna/logout`
(aizver pārlūku, izdzēš profilu); Vercel env noņemšana izslēdz paneli.

Atmiņa: viens Chrome (`MemoryMax=900M`), dīkstāvē 10 min aizveras. Serverim 3,7 GB - nepalaist paralēli smagus pārlūka testus.
