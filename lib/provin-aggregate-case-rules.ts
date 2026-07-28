/**
 * Ražotāju / agregātu case rules — statiskā PROVIN ekspertu bāze (auditu pieredze + tehniskā literatūra).
 * Dinamiskie mācījumi no saglabātajām atskaitēm: `lib/admin-audit-learnings-store.ts`.
 */
import type { VehicleReportFingerprint } from "@/lib/admin-vehicle-report-fingerprint";

export type AggregateCasePack = {
  id: string;
  /** Minimālais atbilstības skaits, lai iekļautu šo paku promptā. */
  minScore: number;
  score: (fp: VehicleReportFingerprint, haystack: string) => number;
  title: string;
  body: string;
};

function haystackFromFingerprint(fp: VehicleReportFingerprint): string {
  return [
    fp.makeModel,
    ...fp.makeTokens,
    ...fp.modelTokens,
    fp.engineCode,
    fp.fuelType,
    fp.transmission,
    fp.typeCode,
    fp.emissionStandard,
    fp.engineDisplacementCm3,
    fp.enginePowerKw,
  ]
    .join(" ")
    .toUpperCase();
}

function brandScore(fp: VehicleReportFingerprint, brands: string[], hay: string): number {
  let s = 0;
  for (const b of brands) {
    if (fp.makeTokens.includes(b)) s += 12;
    if (hay.includes(b)) s += 8;
  }
  return s;
}

function engineScore(fp: VehicleReportFingerprint, codes: string[]): number {
  if (!fp.engineCode) return 0;
  for (const c of codes) {
    if (fp.engineCode === c || fp.engineCode.startsWith(c)) return 25;
  }
  return 0;
}

const PACK_BODY_HEADER = `Katrā atbilstošā laukā (īpaši **2. Kopsavilkums** un **Ieteikumi klātienes apskatei**):
- Pārvērt riskus par **konkrētu spriedumu šim auto** (galvenais pirkuma risks / vidējs uzturēšanas risks / tikai kontrolpunkts).
- Saisti katru svarīgu agregātu ar **konkrētu klātienes darbību** — ne vispārīgu „jāpārbauda auto”.`;

export const PROVIN_AGGREGATE_CASE_PACKS: AggregateCasePack[] = [
  {
    id: "vag_audi_v6_tdi",
    minScore: 14,
    title: "Audi / VW grupa — 3.0 TDI un transmisiju pāris",
    score: (fp, hay) => {
      let s = brandScore(fp, ["AUDI", "VW", "VOLKSWAGEN", "SKODA", "SEAT"], hay);
      if (/3\.0|TDI|V6|2967|2993/.test(hay)) s += 15;
      if (/BITURBO|230KW|313|SQ5/.test(hay)) s += 10;
      if (/S-TRONIC|DSG|TIPTRONIC|7G|8HP/.test(hay)) s += 6;
      return s + engineScore(fp, ["CRT", "CAPA", "ASB", "CDUC", "CVU"]);
    },
    body: `${PACK_BODY_HEADER}

**Biturbo 3.0 TDI (~230 kW) + 8AT Tiptronic:** ķēdes parasti nav galvenais risks; fokuss — **V-intercooler dzesēšanas noplūde**, **injektori un vara gredzeni** (klusā bojāejuma risks), **plastmasas termostats/ūdens sūknis**. Eļļas intervāls **7 000–10 000 km** premium eļļai.

**Vienkāršais 3.0 TDI (150/180 kW) + S-Tronic 7:** **Galvenais risks — DSG/S-Tronic + divmasu spararats** (trīcēšana, aizkaves, mehatronika). Ķēde bieži problēma pie **~200 000 km** — klasificēt kā finansiālu ieejas risku bez klātienes testa.

**C6 3.0 TDI 176 kW + Tiptronic 6:** bieži uzticamākais V6 komplekts; **ķēdes maiņa pie ~250 000 km** — augsts odometra rollback signāls (reālais >500 000 km).

**Klātienē:** auksts/patērēts starta tests S-Tronic; intercooler/termiskā stabilitāte; dūmi un spiedības lasījumi; servisa pierādījumi par eļļu un dzesēšanu.`,
  },
  {
    id: "vag_2_0_tdi_dsg",
    minScore: 12,
    title: "VW grupa — 2.0 TDI, DPF/AdBlue, DSG tips",
    score: (fp, hay) => {
      let s = brandScore(fp, ["VW", "VOLKSWAGEN", "AUDI", "SKODA", "SEAT"], hay);
      if (/2\.0|1968|DIESEL|DĪZEL|TDI/.test(hay)) s += 12;
      if (/DQ200|DQ250|DQ500|DSG|S-TRONIC/.test(hay)) s += 8;
      return s + engineScore(fp, ["CFFB", "CFGB", "CUPA", "DFGA", "DFHA", "CUNA"]);
    },
    body: `${PACK_BODY_HEADER}

**DQ200 (sauss, mazāks moments):** finansiāls risks pie **150–200k** — slīdēšana, smaka, mehatronika.

**DQ250/DQ500 (mitrā, smagāki auto):** izturīgāka, bet joprojām obligāts testa brauciens un eļļas maiņas vēsture.

**DPF/EGR/AdBlue:** pilsētas profils = **vidējs/liels risks**; šosejas profils ar pierādījumiem — kontrolpunkts.

**Klātienē:** slīdēšana uz kāpnēm; DPF regenerācijas kļūdas; AdBlue patēriņš; dūmainība; ūdens sūknis/termostats.`,
  },
  {
    id: "vag_tfsi_ea888",
    minScore: 12,
    title: "VW / Audi — 1.8/2.0 TFSI (eļļas patēriņš, ķēde)",
    score: (fp, hay) => {
      let s = brandScore(fp, ["VW", "AUDI", "SKODA", "SEAT"], hay);
      if (/TFSI|TSI|BENZĪN|BENZIN|PETROL/.test(hay)) s += 8;
      if (/1\.8|2\.0|1798|1984|EA888|EA113/.test(hay)) s += 14;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**2008–2013 paaudzes 1.8/2.0 TFSI:** bieži **galvenais pirkuma risks** — eļļas patēriņš, ķēdes stiepšanās, galvas bloka plaisas. Ja nav pierādīta apkope un eļļas līmeņa disciplīna — **meklēt citu variantu**.

**Jaunāki EA888 gen3:** risks mazāks, bet kontrolē **ūdens sūkni/termostatu**, turbo eļļas caurulītes, PCV.

**Klātienē:** eļļas līmenis pēc stāvēšanas; dūmi aukstā; ķēdes troksnis; spiedības testi; servisa intervāli.`,
  },
  {
    id: "mercedes_diesel",
    minScore: 12,
    title: "Mercedes-Benz — OM642 / OM651, 7G/9G, divmasu",
    score: (fp, hay) => {
      let s = brandScore(fp, ["MERCEDES", "BENZ"], hay);
      if (/DIESEL|DĪZEL|BLUE|CDI/.test(hay)) s += 8;
      return s + engineScore(fp, ["OM642", "OM651", "OM656"]);
    },
    body: `${PACK_BODY_HEADER}

**OM642 + 7G-Tronic:** **divmasu spararats + kārba** — dārgs risinājums (līdzīgi lietotai veselīgai 7G montāžai + kodēšana).

**9G-Tronic (2014+):** labāks profils, ja **eļļas intervāli** ievēroti.

**AdBlue/SCR/DPF:** klasificēt pēc nobraukuma un pilsētas/šosejas profila.

**Klātienē:** vibrācijas tukšgaitā; pārslēgšanās plūdenums; AdBlue kļūdas; eļļas noplūdes pie kartera; W206 vs A-klases arhitektūras mītu neizplatīt bez pamata.`,
  },
  {
    id: "bmw_diesel_chains",
    minScore: 12,
    title: "BMW — N47 / N57 / B47 ķēdes un eļļas sistēma",
    score: (fp, hay) => {
      let s = brandScore(fp, ["BMW"], hay);
      if (/DIESEL|DĪZEL/.test(hay)) s += 6;
      return s + engineScore(fp, ["N47", "N57", "B47", "M47"]);
    },
    body: `${PACK_BODY_HEADER}

**N57:** bieži **galvenais finansiālais blokers** — ķēdes lūzums, gultņi. Pēc „ķēdes remonta” obligāti jautā: vai mainīts **eļļas sūknis** (nolietots sūknis = bloka bojāejums).

**N47:** augsts risks, bet atšķirībā no N57 — **laicīga apkope** maina spriedumu.

**Klātienē:** auksta metāliska klaboņa; eļļas spiedība; servisa rēķini par ķēdi/sūkni; turbo atlikušais resurss.`,
  },
  {
    id: "bmw_petrol_n20_b48",
    minScore: 10,
    title: "BMW — benzīns N20/B48, cooling, timing",
    score: (fp, hay) => {
      let s = brandScore(fp, ["BMW"], hay);
      if (/BENZĪN|BENZIN|PETROL|BENZ/.test(hay)) s += 8;
      if (/N20|B48|N55|B58/.test(hay)) s += 10;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**N20/N26:** **ūdens sūknis/termiskā pārvaldība** — vidējs/liels risks; kontrolēt dzesēšanas vēsturi.

**Klātienē:** temperatūras stabilitāte; noplūdes; eļļas emulsija; kļūdu kodi pēc auksta starta.`,
  },
  {
    id: "volvo_d5_diesel",
    minScore: 12,
    title: "Volvo — D4/D5, Haldex, dīzeļa bloka plaisas",
    score: (fp, hay) => {
      let s = brandScore(fp, ["VOLVO"], hay);
      if (/D5|D4|DIESEL|DĪZEL/.test(hay)) s += 10;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**2.4 D5 biturbo (melns vāks):** risks **bloka plaisām** — klusā **antifrīza zuduma** un **auksta gaisa apkure braucot**.

**Haldex AWD:** bez eļļas maiņas = **faktiska priekšpiedziņa**.

**Klātienē:** dzesēšanas līmenis trendā; Haldex serviss; automātiskās kārba (Aisin/Volvo) plūdenums.`,
  },
  {
    id: "psa_stellantis",
    minScore: 12,
    title: "Peugeot / Citroën / DS / Opel — wet belt, PureTech",
    score: (fp, hay) => {
      let s = brandScore(fp, ["PEUGEOT", "CITROEN", "CITROËN", "DS", "OPEL"], hay);
      if (/PURETECH|1\.2|1\.6|WET|BELT/.test(hay)) s += 10;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**Wet belt (eļļā):** bieži **galvenais motors risks** — bez skaņas pirms bojājuma; profilaktiska maiņa vai pierādījumi obligāti.

**1.2 PureTech:** eļļas patēriņš un agrīna nolietojuma sajūta.

**Klātienē:** eļļas krāsa/līmenis; servisa intervāli; vibrācija un dūmi.`,
  },
  {
    id: "renault_nissan",
    minScore: 10,
    title: "Renault / Dacia / Nissan — 1.5 dCi, CVT, hibrīdi",
    score: (fp, hay) => {
      let s = brandScore(fp, ["RENAULT", "DACIA", "NISSAN"], hay);
      if (/DCI|1\.5|1\.6|QASHQAI|X-TRAIL/.test(hay)) s += 8;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**1.5/1.6 dCi:** turbo un injektoru nolietojums; EGR/DPF pilsētā.

**Nissan CVT (benzīns):** vibrācija un pārkaršana — **vidējs risks**.

**Klātienē:** turbo spiedība; CVT bez slīdēšanas; servisa pierādījumi.`,
  },
  {
    id: "toyota_lexus",
    minScore: 10,
    title: "Toyota / Lexus — hibrīds, e-CVT, uzticamība ar izņēmumiem",
    score: (fp, hay) => {
      return brandScore(fp, ["TOYOTA", "LEXUS"], hay) + (/HYBRID|HIBRĪD|HV/.test(hay) ? 8 : 0);
    },
    body: `${PACK_BODY_HEADER}

**Hibrīds:** HV baterijas stāvoklis un **invertora/dzesēšanas** sistēma; 12 V akumulators bieži ikdienas „nedarbojas” cēlonis.

**e-CVT:** plūdenums bez trīcēšanas; motorstundas loģika atšķiras no dīzeļa.

**Klātienē:** HV kļūdas; baterijas garantija; eļļas intervāls arī hibrīdam (ICE daļa).`,
  },
  {
    id: "ford_ecoboost",
    minScore: 10,
    title: "Ford — EcoBoost, Powershift, wet belt (PSA platformas)",
    score: (fp, hay) => {
      let s = brandScore(fp, ["FORD"], hay);
      if (/ECOBOOST|ECOSPORT|FOCUS|POWERSHIFT/.test(hay)) s += 10;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**1.0/1.5 EcoBoost:** dzesēšana un turbo resurss; dažās platformās **wet belt** risks.

**Powershift (sauss DCT):** **galvenais risks** — obligāts testa brauciens.

**Klātienē:** pārslēgšanās; temperatūra; eļļas pierādījumi.`,
  },
  {
    id: "hyundai_kia",
    minScore: 10,
    title: "Hyundai / Kia — GDI/T-GDI, DCT, EV (E-GMP)",
    score: (fp, hay) => {
      let s = brandScore(fp, ["HYUNDAI", "KIA"], hay);
      if (/ELECTR|ELEKTRO|EV6|IONIQ|EGMP|800V/.test(hay)) s += 12;
      if (/TGDI|GDI|DCT|7DCT/.test(hay)) s += 6;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**T-GDI/GDI:** oglekļa uzdeposīcijas un eļļas kvalitāte.

**7DCT:** testa brauciens kā VAG DSG.

**E-GMP EV:** SOH + **DC uzlādes paradums**; šasijas remonts pēc negadījuma zem grīdas.

**Klātienē:** DCT tests; EV diapazons vs SOC; uzlādes ports.`,
  },
  {
    id: "tesla_ev",
    minScore: 10,
    title: "Tesla — BEV, 12 V, reduktors, MCU",
    score: (fp, hay) => {
      let s = brandScore(fp, ["TESLA"], hay);
      if (/ELECTR|ELEKTRO|MODEL/.test(hay)) s += 10;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**Galvenie riski:** **12 V sistēma**, ekrāna/MCU stabilitāte, aizmugures **reduktora** troksnis (modeļa/gada atkarībā), SOH un uzlādes paradumi (**20–80 %**, DC biežums).

**Klātienē:** diapazons vs SOC; troksnis 80–110 km/h; uzlādes ports; servisa/vairuma kļūdu vēsture.`,
  },
  {
    id: "ev_generic",
    minScore: 8,
    title: "Elektroauto (vispārīgi BEV/PHEV)",
    score: (fp, hay) => {
      if (/ELECTR|ELEKTRO|BEV|PHEV|PLUG|HYBRID.*CHARG|AKUMUL/.test(hay)) return 20;
      if (/KWH|SOH|CCS|TYPE.?2/.test(hay)) return 15;
      return 0;
    },
    body: `${PACK_BODY_HEADER}

Lietot arī vispārīgo **ELECTRIC & PLUG-IN FORENSICS** bloku: SOH + uzlādes režīms + garantija + klātienes HV pārbaude.`,
  },
  {
    id: "japanese_generic",
    minScore: 10,
    title: "Mazda / Honda / Mitsubishi — uzticamība, CVT, rust",
    score: (fp, hay) => {
      return brandScore(fp, ["MAZDA", "HONDA", "MITSUBISHI", "SUBARU", "SUZUKI"], hay);
    },
    body: `${PACK_BODY_HEADER}

**CVT (Honda/Nissan platformas):** plūdenums un dzesēšana.

**Mazda Skyactiv dīzelis:** DPF pilsētā; EGR.

**Baltijas rūsa:** virsbūve un šasija — kontrolpunkts pat „uzticamiem” zīmoliem.

**Klātienē:** CVT tests; rūsa uz arkām; servisa intervāli.`,
  },
  {
    id: "generic_ice_import",
    minScore: 0,
    title: "Vispārīgs imports (DE → LV) — agregātu disciplīna",
    score: () => 1,
    body: `${PACK_BODY_HEADER}

Ja nav spēcīgākas paku atbilstības: motorstundu profils (pilsēta max **10k km** eļļai; šoseja līdz **15–20k** tikai ar pierādījumiem); **divmasu + automātiskā kārba** = obligāts testa brauciens; TA defektu tendences no CSDD; negadījumu zonas vs virsbūve klātienē.`,
  },
];

export function selectAggregateCasePacks(
  fp: VehicleReportFingerprint,
  opts?: { maxPacks?: number },
): AggregateCasePack[] {
  const maxPacks = opts?.maxPacks ?? 4;
  const hay = haystackFromFingerprint(fp);
  const ranked = PROVIN_AGGREGATE_CASE_PACKS.map((pack) => ({
    pack,
    score: pack.score(fp, hay),
  }))
    .filter((r) => r.score >= r.pack.minScore)
    .sort((a, b) => b.score - a.score);

  const picked = ranked.filter((r) => r.pack.id !== "generic_ice_import").slice(0, maxPacks);
  const out = picked.map((r) => r.pack);
  if (out.length === 0) {
    const generic = PROVIN_AGGREGATE_CASE_PACKS.find((p) => p.id === "generic_ice_import");
    if (generic) out.push(generic);
  }
  return out;
}

export function formatAggregateCasePacksForGemini(packs: AggregateCasePack[]): string {
  if (packs.length === 0) return "";
  const blocks = packs.map((p) => `#### ${p.title}\n${p.body.trim()}`);
  return blocks.join("\n\n");
}

export function fingerprintLearningKey(fp: VehicleReportFingerprint): string {
  const parts = [
    ...fp.makeTokens.slice(0, 2),
    ...fp.modelTokens.slice(0, 3),
    fp.engineCode,
    fp.fuelType.slice(0, 24),
    fp.transmission,
  ]
    .filter(Boolean)
    .join("|")
    .toUpperCase();
  return parts || fp.makeModel.slice(0, 48).toUpperCase() || "UNKNOWN";
}
