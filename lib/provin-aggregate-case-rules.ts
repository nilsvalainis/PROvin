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

function parsePowerKw(fp: VehicleReportFingerprint): number | null {
  const n = Number.parseFloat(fp.enginePowerKw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDisplacementCm3(fp: VehicleReportFingerprint): number | null {
  const n = Number.parseInt(fp.engineDisplacementCm3, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** kW + tilpums + gads (+ degviela haystackā) — kad koda nav vai tas ir vājš.
 * Ja cm³ ir zināms un ārpus joslas, kW punktus NEDOD (pretējā gadījumā 150 kW 2.0
 * ievelk 3.0 V6 / N57 pakas). */
function powertrainProxyScore(
  fp: VehicleReportFingerprint,
  hay: string,
  opts: {
    kwMin: number;
    kwMax: number;
    cm3Min: number;
    cm3Max: number;
    yearMin?: number;
    yearMax?: number;
    fuelRe?: RegExp;
  },
): number {
  let s = 0;
  const kw = parsePowerKw(fp);
  const cm3 = parseDisplacementCm3(fp);
  const cm3Ok = cm3 != null && cm3 >= opts.cm3Min && cm3 <= opts.cm3Max;
  const cm3KnownOut = cm3 != null && !cm3Ok;
  if (cm3KnownOut) return -8;
  if (cm3Ok) s += 10;
  const kwOk = kw != null && kw >= opts.kwMin && kw <= opts.kwMax;
  if (kwOk && (cm3Ok || cm3 == null)) s += 14;
  if (opts.yearMin != null && opts.yearMax != null && fp.year != null) {
    if (fp.year >= opts.yearMin && fp.year <= opts.yearMax) s += 8;
    else if (fp.year < opts.yearMin - 2 || fp.year > opts.yearMax + 2) s -= 14;
  }
  if (opts.fuelRe && opts.fuelRe.test(hay) && (cm3Ok || kwOk)) s += 4;
  return s;
}

const PACK_BODY_HEADER = `INTERNĀ KALIBRĀCIJA — šīs pakas € summas ir TIKAI tavai iekšējai smaguma/varbūtības kalibrācijai, NEKAD nekopē tās klienta tekstā (skat. NO ESTIMATED REPAIR EUR); ja tās tomēr paslīd, tās izfiltrē pēcapstrāde, bet tas ir drošības tīkls, ne atļauja.

Katrā atbilstošā laukā (īpaši **1. Tehnisko risku analīze**, **2. Ieteikumi klātienes apskatei**, avotu komentāri):
- Šī paka der TIKAI ja šī auto **dzinēja kods / tilpums / kārba** sakrīt. Tā pati marka ar citu kodu = IGNORĒ šo paku un meklē šim kodam.
- Pārvērt riskus par **konkrētu spriedumu šim auto** (galvenais pirkuma risks / ierasta uzturēšanas izmaksa / tikai pārbaudāms klātienē).
- Saisti katru svarīgu agregātu ar **konkrētu klātienes darbību** — ne vispārīgu „jāpārbauda auto”.
- **1. Tehnisko risku analīze** — DETALIZĒTI (nosacīts garums: tik sadaļu, cik ir konkrēta materiāla): katrs relevantais mezgls, kas NAV risks, nobraukuma kalibrācija — BEZ € skaitļiem klientam. Blīvums ≠ īsums. TA nosegts nodilums nav šīs sadaļas saturs.
- EUR skaitļi klientam drīkst parādīties tikai cenas vērtējumā/tirgus laukā. **3. Kopsavilkumā** un **1. sadaļā** cenas un EUR summas neraksta — pat ne no šīs pakas.`;

export const PROVIN_AGGREGATE_CASE_PACKS: AggregateCasePack[] = [
  {
    id: "vag_audi_v6_tdi",
    minScore: 14,
    title: "Audi / VW grupa — 3.0 TDI un transmisiju pāris",
    score: (fp, hay) => {
      let s = brandScore(fp, ["AUDI", "VW", "VOLKSWAGEN", "SKODA", "SEAT"], hay);
      if (/3\.0|V6|2967|2993/.test(hay)) s += 15;
      if (/BITURBO|230KW|313|SQ5/.test(hay)) s += 10;
      if (/S-TRONIC|DSG|TIPTRONIC|7G|8HP/.test(hay)) s += 6;
      if (/2\.0|1968/.test(hay) && !/3\.0|V6|2967|2993/.test(hay)) s -= 20;
      s += powertrainProxyScore(fp, hay, {
        kwMin: 150,
        kwMax: 260,
        cm3Min: 2900,
        cm3Max: 3000,
        yearMin: 2004,
        yearMax: 2020,
        fuelRe: /DIESEL|DĪZEL|TDI/,
      });
      return s + engineScore(fp, ["CRT", "CAPA", "ASB", "CDUC", "CVU", "CASA", "CGQB"]);
    },
    body: `${PACK_BODY_HEADER}

**Vispirms nošķir kārbas tipu — tas maina visu risku profilu:** šai V6 3.0 TDI konstrukcijai VW grupa lietojusi divus principiāli atšķirīgus risinājumus, un tos NEDRĪKST sajaukt: (a) **klasiskais hidrotransformatora automāts** (Tiptronic 6 vai 8AT/8HP) — nav sausā/mitrā sajūga, nav mehatronikas kļūmes riska, dubultsajūga trīcēšanas tēma **UZ ŠO VARIANTU NEATTIECAS**; (b) **S-Tronic 7 (DL501, mitrais divsajūgs)** — te tieši mehatronika un sajūgs ir galvenais finansiālais risks.

**150/180 kW + S-Tronic 7 (DL501):** **galvenais pirkuma risks — S-Tronic mehatronika un divsajūgs** (trīcēšana zemos apgriezienos, aizkaves pārslēdzot, kļūdu kodi). Ķēde šajā variantā bieži problemātiska pie **~200 000 km** — klasificēt kā finansiālu ieejas risku, kas jāapstiprina ar klātienes testu.

**176 kW + Tiptronic 6 (piem. C6 posms) — IZŅĒMUMS:** hidrotransformatora automāts, nav S-Tronic sajūga riska; parasti uzticamākais šīs konstrukcijas komplekts. **Ķēdes maiņa pie ~250 000 km** — ja odometrs rāda mazāk un ķēde jau mainīta, tas ir augsts rollback signāls (reālais nobraukums visticamāk >500 000 km).

**Biturbo ~230 kW + 8AT/8HP Tiptronic:** hidrotransformatora automāts (nav S-Tronic riska); fokuss — **V-intercooler dzesēšanas noplūde**, **iesmidzinātāji un vara blīvgredzeni** (klusā bojāejuma risks — motors turpina strādāt, defekts pamanāms tikai pēc patēriņa/dūmu izmaiņām), **plastmasas termostats/ūdens sūknis**. Eļļas intervāls **7 000–10 000 km** premium eļļai — īsāks intervāls datos izskatās labi.

**204 kW un jaunākas biturbo versijas (Euro 6, ap 2015+):** tehniski tuvākas biturbo variantam; papildus kontrolē EGR dzesētāja blīvumu un AdBlue sistēmas kļūdu vēsturi, ja pieejama.

**Quattro pilnpiedziņa (visos variantos):** aizmugurējās kardānvārpstas **krustiņi** un **karājošais gultnis** ir dilstoša daļa neatkarīgi no dzinēja/kārbas kombinācijas — tipiska pazīme ir vibrācija vai dobjš troksnis paātrinoties pēc **150 000+ km**; tas ir mehānisks nodilums, ne dzinēja/kārbas defekts, un jāvērtē atsevišķi no ķēdes/sajūga riska.

**Virsbūve pēc vairākiem gadiem Latvijā / Lietuvā / Igaunijā:** cinkojums neatceļ pārbaudi arkām, sliekšņu apakšām un bagāžnieka vākam pie numura zīmes gaismām — klimata risks, ne pierādīts defekts. Svaiga TA to nenosedz (rūsa zem oderēm).

**Klātienē:** auksts/patērēts starta tests (S-Tronic variantam — sajūga tvēriens un trīcēšana zemos apgriezienos; Tiptronic variantam — pārslēgšanās plūdenums); intercooler/termiskā stabilitāte; dūmi un spiedības lasījumi; klausīties troksni/vibrāciju no kardānvārpstas paātrinoties un asos pagriezienos; servisa pierādījumi par eļļu, dzesēšanu un (S-Tronic gadījumā) mehatronikas programmatūru.`,
  },
  {
    id: "vag_2_0_tdi_dsg",
    minScore: 12,
    title: "VW grupa — 2.0 TDI (EA189 / EA288), DPF/AdBlue, DSG tips",
    score: (fp, hay) => {
      let s = brandScore(fp, ["VW", "VOLKSWAGEN", "AUDI", "SKODA", "SEAT"], hay);
      if (/2\.0|1968/.test(hay)) s += 14;
      if (/\bTDI\b/.test(hay) && /2\.0|1968|EA288|EA189/.test(hay)) s += 6;
      if (/DQ200|DQ250|DQ500|DSG|S-TRONIC/.test(hay)) s += 8;
      if (/3\.0|V6|2967|2993/.test(hay) && !/2\.0|1968/.test(hay)) s -= 20;
      s += powertrainProxyScore(fp, hay, {
        kwMin: 81,
        kwMax: 150,
        cm3Min: 1900,
        cm3Max: 2000,
        yearMin: 2008,
        yearMax: 2024,
        fuelRe: /DIESEL|DĪZEL|DIZEL|TDI/,
      });
      return s + engineScore(fp, ["CFFB", "CFGB", "CUPA", "DFGA", "DFHA", "CUNA", "DTPA", "DTRB", "DTUA", "CAHA", "CAGA", "CJCA"]);
    },
    body: `${PACK_BODY_HEADER}

**Nošķir paaudzi (kods / gads / AdBlue):** (a) **EA189** (~2008–2015, tipiski ~103–130 kW, bieži bez AdBlue) — zobsiksna, DPF/EGR pilsētā, dažiem agrīnajiem eļļas sūkņa piedziņas ass; (b) **EA288 / evo** (piem. DTPA 150 kW, 1968 cm³) — arī **zobsiksna** (ne ķēde), bieži AdBlue/SCR. 3.0 V6 plastmasas termostata stāstu uz šo motoru NEDRĪKST kopēt.

**Zobsiksna:** ja dīlera Veiktie darbi vai komentāros siksna jau fiksēta (datums + km), to kā „jāmaina” NERAKSTI. Ja NAV fiksēta — **nepierādīts**, jālūdz dokumenti; >30k km / >24 mēn. bez oficiāla ieraksta = darbs var būt ārpus dīlera. Neraksti „neatliekamu obligātu” maiņu tikai no odometra.

**DQ200 (sauss, mazāks moments):** finansiāls risks pie **150–200k** — slīdēšana, smaka, mehatronika. Manuālei / FWD šis stāsts neattiecas.

**DQ250/DQ500 (mitrā, smagāki auto):** izturīgāka, bet joprojām obligāts testa brauciens un eļļas maiņas vēsture.

**DPF/EGR/AdBlue:** pilsētas profils = augstāka varbūtība; šosejas profils ar pierādījumiem — tikai pārbaudes punkts. Euro 6 + AdBlue ≠ automātiski „slikts motors”.

**Klātienē:** DSG slīdēšana uz kāpnēm; DPF regenerācijas kļūdas; AdBlue patēriņš; dūmainība; auksts starts bez metāliskas klaboņas; siksnas dokumenti.`,
  },
  {
    id: "vag_tfsi_ea888_early",
    minScore: 14,
    title: "VW / Audi — EA888 gen1/2 TFSI (eļļas patēriņš, ķēde)",
    score: (fp, hay) => {
      if (/EA888.?GEN.?3|GEN3|GEN.?3/.test(hay)) return 0;
      if (fp.year != null && fp.year >= 2014) return 0;
      let s = brandScore(fp, ["VW", "AUDI", "SKODA", "SEAT"], hay);
      if (!/TFSI|TSI|BENZĪN|BENZIN|PETROL|EA888|EA113/.test(hay) && !/BENZ/.test(fp.fuelType.toUpperCase())) {
        // still allow via proxy below
      } else {
        s += 8;
      }
      if (/1\.8|2\.0|1798|1984|EA888|EA113|TFSI|TSI/.test(hay)) s += 10;
      s += engineScore(fp, ["CDAB", "CDAA", "CCZB", "CAWB", "CCT", "CDNC"]);
      s += powertrainProxyScore(fp, hay, {
        kwMin: 118,
        kwMax: 155,
        cm3Min: 1780,
        cm3Max: 2000,
        yearMin: 2008,
        yearMax: 2012,
        fuelRe: /BENZ|PETROL|TFSI|TSI/,
      });
      if (fp.year != null && fp.year >= 2013) s -= 14;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**2008–2012/13 EA888 gen1/2 (un EA113 pāreja):** bieži **galvenais pirkuma risks** — eļļas patēriņš, ķēdes stiepšanās, galvas/bloka termiskās kaites. Bez pierādītas eļļas disciplīnas un ķēdes stāvokļa — konservatīvs spriedums. Šī paka NEattiecas uz EA888 gen3 (~2013+).

**Klātienē:** eļļas līmenis pēc stāvēšanas; zilas dūmas aukstā; ķēdes troksnis aukstā startā; servisa intervāli; spiedības/kompresijas, ja iespējams.`,
  },
  {
    id: "vag_tfsi_ea888_gen3",
    minScore: 14,
    title: "VW / Audi — EA888 gen3 TFSI (ūdens sūknis, PCV)",
    score: (fp, hay) => {
      if (/EA113|GEN.?1|GEN.?2/.test(hay) && !/GEN.?3/.test(hay)) return 0;
      if (fp.year != null && fp.year <= 2012) return 0;
      let s = brandScore(fp, ["VW", "AUDI", "SKODA", "SEAT"], hay);
      if (/TFSI|TSI|BENZĪN|BENZIN|PETROL|EA888/.test(hay)) s += 8;
      if (/1\.8|2\.0|1798|1984|EA888/.test(hay)) s += 8;
      s += engineScore(fp, ["CHHB", "CJX", "DKZ", "DNU"]);
      s += powertrainProxyScore(fp, hay, {
        kwMin: 110,
        kwMax: 220,
        cm3Min: 1780,
        cm3Max: 2000,
        yearMin: 2013,
        yearMax: 2024,
        fuelRe: /BENZ|PETROL|TFSI|TSI/,
      });
      if (fp.year != null && fp.year <= 2011) s -= 16;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**EA888 gen3 (~2013+):** eļļas patēriņa „rijējs” naratīvs no gen1/2 **neattiecas** pēc noklusējuma. Aktuālie mezgli: **ūdens sūknis/termostats**, turbo eļļas caurulītes, PCV, DSG/S-Tronic eļļa ja ir divsajūgs.

**Klātienē:** dzesēšanas stabilitāte; noplūdes priekšā; auksts starts; kārbas plūdenums.`,
  },
  {
    id: "mercedes_om654",
    minScore: 14,
    title: "Mercedes-Benz — OM654 (2016+ 1.6/2.0 dīzelis)",
    score: (fp, hay) => {
      if (/OM642|OM651/.test(hay) && !/OM654/.test(hay) && !/^OM654/.test(fp.engineCode || "")) {
        return 0;
      }
      let s = brandScore(fp, ["MERCEDES", "BENZ"], hay);
      if (/DIESEL|DĪZEL|BLUE|CDI/.test(hay)) s += 4;
      const om654 =
        engineScore(fp, ["OM654"]) ||
        (/OM654/.test(hay) ? 25 : 0) ||
        (fp.year != null &&
        fp.year >= 2016 &&
        (fp.engineDisplacementCm3 === "1950" ||
          fp.engineDisplacementCm3 === "1598" ||
          /1950|1598|1\.6|2\.0/.test(hay)) &&
        /DIESEL|DĪZEL|CDI|220D|200D|180D|300D/.test(hay)
          ? 18
          : 0);
      return s + om654;
    },
    body: `${PACK_BODY_HEADER}

**OM654 ≠ OM651/OM642.** Šī paka der TIKAI OM654 (un ļoti līdzīgiem 2016+ 1.6/2.0 MB dīzeļiem ar šo kodu). OM651 piezo/ķēdes stāstu un OM642 divmasu+7G stāstu šeit NEDRĪKST kopēt.

**Konstrukcija (iekšējai kalibrācijai):** alumīnija bloks, NANOSLIDE, parasti ķēdes gāzu sadale; bieži 9G-Tronic. Kopumā uzticamāks par agrīno OM651, bet nav „bez problemām”.

**Aktuālie mezgli (kalibrē pret šī auto km/profilu; BEZ € klientam):**
- **Izplūdes puses rokera/hidraulisko atsperu (tappet) nodilums** — aukstā startā „plop”/neviendabīgs darbs; smagākos gadījumos izciļņu bojājums. Klātienē klausīties aukstu startu.
- **Iesmidzinātāju blīvgredzeni** — eļļas/kvēpu noplūde ap sprauslām („black death”); pārbaudīt vizuāli un pēc dīlera/RAW ierakstiem.
- **Ķēdes spriegotājs / ķēde** — riskants galvenokārt pie sliktiem eļļas intervāliem / nepareizas eļļas; ne pasniegt kā OM651 kritisko ķēdi pēc noklusējuma.
- **EGR / DPF / AdBlue** — pilsētas profilā biežāka aizsērēšana; šosejas profilā mazāk. Kalibrēt pēc motorstundu / km blīvuma.
- **Turbo eļļas caurulītes / šļūtenes** — vizuāli un testa braucienā (boost).

**Eļļa:** MB 229.51/229.52 (vai jaunāks MB apstiprinājums); pilsētā praktiski ~10 000 km griesti. Long-life „mūža” stāstu neizmantot kā attaisnojumu gariem intervāliem.

**Kārba:** ja 9G — eļļas intervāli un pārslēgšanās plūdenums testa braucienā. Ja 7G uz šo motoru — nejauc ar OM642 divmasu stāstu bez datiem.

**Klātienē:** auksts starts (rokera/ķēdes troksnis); eļļas noplūdes ap iesmidzinātājiem un karteri; AdBlue/DPF kļūdas; 9G pārslēgumi; dīlera Veiktie darbi uzvar „jāmaina” sarakstu.`,
  },
  {
    id: "mercedes_om642",
    minScore: 14,
    title: "Mercedes-Benz — OM642 3.0 V6 dīzelis, 7G/9G, divmasu",
    score: (fp, hay) => {
      if (/OM654|OM651/.test(hay) || /^(OM654|OM651)/.test(fp.engineCode || "")) return 0;
      let s = brandScore(fp, ["MERCEDES", "BENZ"], hay);
      if (/DIESEL|DĪZEL|BLUE|CDI/.test(hay)) s += 4;
      s += engineScore(fp, ["OM642"]);
      if (/OM642|2987|3\.0.?V6|350.?CDI|320.?CDI|280.?CDI/.test(hay)) s += 12;
      s += powertrainProxyScore(fp, hay, {
        kwMin: 140,
        kwMax: 195,
        cm3Min: 2900,
        cm3Max: 3050,
        yearMin: 2005,
        yearMax: 2017,
        fuelRe: /DIESEL|DĪZEL|CDI/,
      });
      const cm3 = parseDisplacementCm3(fp);
      if (cm3 != null && cm3 > 0 && cm3 < 2500) s -= 20;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**OM642 (3.0 V6, ~2987 cm³) ≠ OM651/OM654.** Piezo OM651 un OM654 rokera stāstus šeit NEDRĪKST kopēt.

**7G-Tronic + divmasu:** bieži **galvenais finansiālais risks** pie liela nobraukuma — vibrācija tukšgaitā, raustīšanās. Ja 7G jau „nogurusi”, bieži izdevīgāk meklēt veselīgu lietotu kārbu + kodēšanu nekā tikai DMF. **9G-Tronic (vēlākie, bieži 2014+ bez 4Matic):** labāks profils, ja eļļas intervāli ievēroti; neraksti 7G DMF stāstu uz 9G bez datiem.

**Ieplūde / EGR / eļļas dzesētājs:** kvēpi un noplūdes pie liela km — pārbaudāms, ne automātiski „bloks beidzies”.

**Klātienē:** vibrācijas tukšgaitā; 7G/9G plūdenums; AdBlue/DPF kļūdas; eļļas noplūdes pie kartera/dzesētāja; W206 vs A-klases „Renault” mītu neizplatīt bez šasijas faktiem.`,
  },
  {
    id: "mercedes_om651",
    minScore: 14,
    title: "Mercedes-Benz — OM651 2.1 dīzelis (ķēde, piezo, EGR)",
    score: (fp, hay) => {
      if (/OM654/.test(hay) || /^OM654/.test(fp.engineCode || "")) return 0;
      if (/OM642/.test(hay) || /^OM642/.test(fp.engineCode || "")) return 0;
      let s = brandScore(fp, ["MERCEDES", "BENZ"], hay);
      if (/DIESEL|DĪZEL|BLUE|CDI/.test(hay)) s += 4;
      s += engineScore(fp, ["OM651"]);
      if (/OM651|2143|2\.1|220.?CDI|250.?CDI|200.?CDI/.test(hay)) s += 12;
      s += powertrainProxyScore(fp, hay, {
        kwMin: 100,
        kwMax: 150,
        cm3Min: 2100,
        cm3Max: 2200,
        yearMin: 2008,
        yearMax: 2016,
        fuelRe: /DIESEL|DĪZEL|CDI/,
      });
      // 1950 cm³ 2016+ → OM654 klase
      const cm3 = parseDisplacementCm3(fp);
      if (cm3 === 1950 || cm3 === 1598) s -= 18;
      if (fp.year != null && fp.year >= 2017 && (cm3 === 1950 || /1950|1598/.test(hay))) s -= 10;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**OM651 (~2143 cm³, tipiski ~100–150 kW) ≠ OM642 V6 ≠ OM654.** OM654 rokera/NANOSLIDE un OM642 7G/DMF stāstus šeit NEDRĪKST kopēt bez datiem.

**Ķēde / izciļņi / eļļas disciplīna:** agrīnās partijās ķēdes stiepšanās un izciļņu nodilums — auksta starta klaboņa. Eļļas intervāls un pareizā specifikācija maina spriedumu; long-life bez pierādījumiem pilsētā = risks.

**Piezo iesmidzinātāji:** dārga pozīcija, ja jāmaina; neraksti kā jau bojātus bez dūmu/kļūdu/datu.

**EGR dzesētājs / DPF:** pilsētas profilā biežāk; šosejā - pārbaudes punkts.

**Klātienē:** auksts starts (ķēde/izciļņi); eļļas noplūdes; AdBlue ja ir; 7G/9G plūdenums; dīlera Veiktie darbi uzvar „jāmaina”.`,
  },
  {
    id: "mercedes_diesel",
    minScore: 12,
    title: "Mercedes-Benz — dīzelis (vispārīgs fallback, ja OM kods neskaidrs)",
    score: (fp, hay) => {
      if (/OM654|OM642|OM651|OM656/.test(hay) || /^(OM654|OM642|OM651|OM656)/.test(fp.engineCode || "")) {
        return 0;
      }
      const cm3 = parseDisplacementCm3(fp);
      if (cm3 === 2987 || cm3 === 2143 || cm3 === 1950 || cm3 === 1598) return 0;
      let s = brandScore(fp, ["MERCEDES", "BENZ"], hay);
      if (/DIESEL|DĪZEL|BLUE|CDI/.test(hay)) s += 8;
      return s + engineScore(fp, ["OM656"]);
    },
    body: `${PACK_BODY_HEADER}

**Kad precīzs OM kods / cm³ nav skaidrs:** vispirms izsecini kandidātus no kW+cm³+gada (OM642 ~3.0 V6; OM651 ~2.1; OM654 ~1.6/2.0 2016+), tad meklē to kodu. Neraksti sajauktu „Mercedes dīzelis” eseju.

**AdBlue/SCR/DPF:** klasificēt pēc nobraukuma un pilsētas/šosejas profila.

**Klātienē:** vibrācijas tukšgaitā; pārslēgšanās plūdenums; AdBlue kļūdas; eļļas noplūdes.`,
  },
  {
    id: "bmw_m57_e60_e61",
    minScore: 14,
    title: "BMW — M57 (E60/E61 525d/530d): ķēde priekšā, ne N57",
    score: (fp, hay) => {
      if (/N47|N57|B47/.test(hay) || /^(N47|N57|B47)/.test(fp.engineCode || "")) return 0;
      const m57hit = /M57/.test(hay) || /^M57/.test(fp.engineCode || "");
      const chassisHit =
        /\bE60\b|\bE61\b|PX61|PX51/.test(hay) || /^PX/.test(fp.typeCode || "");
      const preF10DieselSix =
        fp.year != null &&
        fp.year <= 2010 &&
        /\b525\b|\b530\b|\b535\b/.test(hay) &&
        /DIESEL|DĪZEL/.test(hay);
      if (!m57hit && !chassisHit && !preF10DieselSix) return 0;
      let s = brandScore(fp, ["BMW"], hay);
      if (m57hit) s += 30;
      if (chassisHit) s += 14;
      if (preF10DieselSix) s += 12;
      if (
        (fp.year == null || fp.year <= 2010) &&
        (fp.engineDisplacementCm3 === "2993" || /2993/.test(hay))
      ) {
        s += 8;
      }
      return s + engineScore(fp, ["M57"]);
    },
    body: `${PACK_BODY_HEADER}

**M57 / M57TU / M57T2 pret N47/N57:** sadales **ķēde dzinēja priekšpusē** (ne aizmugurē). Labi uzturēts M57 pie **300 tūkst. km ir ierasts darba mūžs**, ne resursa gals (bieži 400–500 tūkst.). Ķēdes komplekts neatkarīgā servisā orientējoši **900–1600 €**. **Aizliegts** likt N57 „ķēde lūzt / eļļas sūknis” naratīvu uz M57.

**525d M57T2 (145 kW, Euro 4) + ZF 6HP19 + HECK:** viens no izturīgākajiem E60/E61 salikumiem. Automāts bez divsajūga; **nav divmasu spararata**. 6HP „mūža eļļa” ir mīts — ATF+filtrs ik **60–80 tūkst. km** (**280–450 €**); mehatronika, ja kadreiz, **800–1800 €**.

**E61 Touring:** visiem rūpnīcā **aizmugures pneimatika (EHC)** — tas nav Dynamic Drive. Spilveni + korodējis kompresors = tipiskais aktuālais rēķins (**spilveni 400–800 €**, kompresors **250–500 €**, komplekss **800–1600 €**). E60 sedans bez EHC šo rindkopu neliek kā galveno.

**Kas bieži NAV šim eksemplāram (pārbaudīt SA/aprīkojumu; nenoliegt bez pamata):** Active Steering (dārgā stūres reika), Dynamic Drive / Adaptive Drive, Soft Close, Logic 7, xDrive. Ja to nav — tas ir **TCO arguments**, ne trūkums. Lifestyle Edition = āda/komforts, ne šasijas elektronika.

**M57 mehānika pie 250–350 tūkst. km (ierasta uzturēšanas izmaksa, ne bloķētājs):** eļļas filtra korpusa blīve, vāka blīve, vakuumsūknis, turbīnas līnijas (**180–350 €** tipiskā blīve — INTERNĀ KALIBRĀCIJA, nekopē klientam); **ventilatora viskozā hidromufte** (**100–220 €**); ūdens sūknis/termostats/plastmasas caurules (**250–500 €**); kloķvārpstas svārstību slāpētājs (skriemelis) — ja jau mainīts, tas datos izskatās labi. Ieplūdes kolektors 2008. gada M57T2 visticamāk vēl ir oriģinālais — profilakse **200–450 €**; servisā nepierādīts ≠ nav izdarīts. EGR dzesētājs **250–550 €**. Turbīna/iesmidzinātāji statistiski otrajā pusē; **zema dūmainība TA** (piem. 0,10 pret 1,5) ir labs DPF/turbo rādījums datos.

**Elektronika kā 15–20 gadu E60/E61 īpatnība:** ELV (iedarbināšana, **150–450 €**), FRM, CAS/IBS, CIC pikseļi, bagāžnieka vadi. Tas ir **laika** risks, ne pierādījums, ka šis auto ir elektriski beidzies. Nošķir jau fiksētu diagnostikas kļūdu (tuvākais rēķins) no paaudzes kaprīzes.

**Klātienē:** aizmugure pēc 10 min stāvēšanas (E61); eļļa uz filtra korpusa/startera; hidromufte (troksnis/sasilšana); auksts starts bez ķēdes klaboņas; 6HP 1–2 un 4–5; ELV starta cikls; pusass puteklis; parastās stūres brīvkustība (ne Active Steering cena); EMF stāvbremze; ieplūdes kolektora kodi.`,
  },
  {
    id: "bmw_n57",
    minScore: 14,
    title: "BMW — N57 3.0d (ķēde aizmugurē, eļļas sūknis)",
    score: (fp, hay) => {
      if (/M57/.test(hay) || /^M57/.test(fp.engineCode || "")) return 0;
      if (/\bE60\b|\bE61\b/.test(hay)) return 0;
      if (/N47|B47|M47/.test(hay) || /^(N47|B47|M47)/.test(fp.engineCode || "")) {
        if (!/N57/.test(fp.engineCode || "") && !/N57/.test(hay)) return 0;
      }
      let s = brandScore(fp, ["BMW"], hay);
      if (/DIESEL|DĪZEL/.test(hay)) s += 4;
      s += engineScore(fp, ["N57"]);
      if (/N57/.test(hay)) s += 20;
      s += powertrainProxyScore(fp, hay, {
        kwMin: 180,
        kwMax: 280,
        cm3Min: 2950,
        cm3Max: 3050,
        yearMin: 2011,
        yearMax: 2019,
        fuelRe: /DIESEL|DĪZEL/,
      });
      // ~145 kW pre-2011 = M57 klase
      const kw = parsePowerKw(fp);
      if (kw != null && kw > 0 && kw <= 160 && (fp.year == null || fp.year <= 2010)) s -= 20;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**N57 (3.0d, ķēde aizmugurē) ≠ M57 (ķēde priekšā) ≠ N47 (2.0).** M57 „ierasts darba mūžs pie 300k” un N47 2.0 stāstus šeit NEDRĪKST kopēt.

**Galvenais finansiālais bloķētājs:** ķēdes lūzums / gultņi. Pēc „ķēdes remonta” obligāti jautā: vai mainīts **eļļas sūknis** (nolietots sūknis pēc ķēdes darba = bloka bojāejuma risks). Ja datos ķēde+sūknis fiksēti - risks krīt; ja tikai „ķēde” - jautā dokumentus.

**Kalibrācija:** pie ~150–220k km ķēde jau var būt pirkuma risks; neraksti kā tālu perspektīvu. Twin-turbo / augstāka kW josla = lielāka termiskā slodze.

**Klātienē:** auksta metāliska klaboņa; eļļas spiedība; servisa rēķini par ķēdi/sūkni; turbo atlikušais resurss.`,
  },
  {
    id: "bmw_n47",
    minScore: 14,
    title: "BMW — N47 / B47 2.0d ķēde",
    score: (fp, hay) => {
      if (/M57|N57/.test(hay) || /^(M57|N57)/.test(fp.engineCode || "")) return 0;
      if (/\bE60\b|\bE61\b/.test(hay) && /2993|3\.0/.test(hay)) return 0;
      let s = brandScore(fp, ["BMW"], hay);
      if (/DIESEL|DĪZEL/.test(hay)) s += 4;
      s += engineScore(fp, ["N47", "B47", "M47"]);
      if (/N47|B47|M47/.test(hay)) s += 16;
      s += powertrainProxyScore(fp, hay, {
        kwMin: 85,
        kwMax: 140,
        cm3Min: 1950,
        cm3Max: 2000,
        yearMin: 2007,
        yearMax: 2019,
        fuelRe: /DIESEL|DĪZEL/,
      });
      const cm3 = parseDisplacementCm3(fp);
      if (cm3 != null && cm3 >= 2900) s -= 20;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**N47 (2.0d) ≠ N57 (3.0) ≠ M57.** N57 eļļas sūkņa katastrofas naratīvu uz N47 NEkopē 1:1; N47 ķēde stiepjas agri (~100–150k), bet **laicīga apkope** maina spriedumu. Labi uzturēts N47 ar dokumentētu ķēdi bieži labāks par nogurušu M47 „bez ķēdes problēmas”.

**B47 (vēlākie 2.0d):** uzlabojumi pret N47, bet ķēdes/eļļas disciplīna joprojām jākalibrē pret km - neraksti, ka B47 ir „bez riska”.

**Klātienē:** auksta klaboņa; eļļas spiedība; ķēdes rēķini; turbo/EGR/DPF pilsētā.`,
  },
  {
    id: "bmw_diesel_chains",
    minScore: 12,
    title: "BMW — dīzelis ķēde (fallback, ja N47/N57 neskaidrs)",
    score: (fp, hay) => {
      if (/M57|N57|N47|B47|M47/.test(hay) || /^(M57|N57|N47|B47|M47)/.test(fp.engineCode || "")) {
        return 0;
      }
      if (/\bE60\b|\bE61\b/.test(hay)) return 0;
      const cm3 = parseDisplacementCm3(fp);
      if (cm3 === 2993 || cm3 === 1995) return 0;
      let s = brandScore(fp, ["BMW"], hay);
      if (/DIESEL|DĪZEL/.test(hay)) s += 6;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**Kad 2.0 pret 3.0 nav skaidrs:** vispirms kW+cm³+gads → N47 (~2.0, ≤~140 kW) vai N57 (~3.0, ≥~180 kW, 2011+) vai M57 (≤2010, ķēde priekšā). Tad meklē to kodu. Neraksti sajauktu „BMW dīzeļa ķēde” eseju.

**Klātienē:** auksta metāliska klaboņa; eļļas spiedība; servisa rēķini par ķēdi.`,
  },
  {
    id: "bmw_petrol_n20",
    minScore: 12,
    title: "BMW — N20/N26 benzīns (dzesēšana, ķēde)",
    score: (fp, hay) => {
      if (/B48|B58|N55/.test(hay) || /^(B48|B58|N55)/.test(fp.engineCode || "")) return 0;
      let s = brandScore(fp, ["BMW"], hay);
      if (/BENZĪN|BENZIN|PETROL|BENZ/.test(hay)) s += 6;
      s += engineScore(fp, ["N20", "N26"]);
      if (/N20|N26/.test(hay)) s += 14;
      s += powertrainProxyScore(fp, hay, {
        kwMin: 135,
        kwMax: 180,
        cm3Min: 1950,
        cm3Max: 2000,
        yearMin: 2011,
        yearMax: 2017,
        fuelRe: /BENZ|PETROL/,
      });
      if (fp.year != null && fp.year >= 2018) s -= 12;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**N20/N26:** **ūdens sūknis/termiskā pārvaldība** un ķēdes/eļļas disciplīna — vidējs/liels risks; kontrolēt dzesēšanas vēsturi. B48 stāstu šeit NEkopē.

**Klātienē:** temperatūras stabilitāte; noplūdes; eļļas emulsija; kļūdu kodi pēc auksta starta.`,
  },
  {
    id: "bmw_petrol_b48",
    minScore: 12,
    title: "BMW — B48/B58 benzīns (dzesēšana, eļļa)",
    score: (fp, hay) => {
      if (/N20|N26/.test(hay) || /^(N20|N26)/.test(fp.engineCode || "")) return 0;
      let s = brandScore(fp, ["BMW"], hay);
      if (/BENZĪN|BENZIN|PETROL|BENZ/.test(hay)) s += 6;
      s += engineScore(fp, ["B48", "B58", "N55"]);
      if (/B48|B58|N55/.test(hay)) s += 14;
      s += powertrainProxyScore(fp, hay, {
        kwMin: 100,
        kwMax: 250,
        cm3Min: 1490,
        cm3Max: 3000,
        yearMin: 2015,
        yearMax: 2026,
        fuelRe: /BENZ|PETROL/,
      });
      if (fp.year != null && fp.year <= 2013) s -= 14;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**B48/B58 (un N55 pēc konteksta):** N20 „agrīnās dzesēšanas katastrofas” naratīvu NEkopē pēc noklusējuma. Fokusā: dzesēšanas noplūdes, eļļas intervāli, turbo eļļas līnijas, 8HP eļļa ja automāts.

**Klātienē:** temperatūras stabilitāte; noplūdes; auksts starts; kārbas plūdenums.`,
  },
  {
    id: "volvo_d5244_single_turbo",
    minScore: 14,
    title: "Volvo — 2.4 D5 viens turbo (D5244T5/T8/T10/T11 u.c.)",
    score: (fp, hay) => {
      let s = brandScore(fp, ["VOLVO"], hay);
      const codeHit = engineScore(fp, [
        "D5244T11",
        "D5244T10",
        "D5244T8",
        "D5244T5",
        "D5244T4",
        "D5244T",
      ]);
      // Biturbo / vēlākie T13+ kodi — šī paka NAV.
      if (/D5244T1[3456789]|D5244T2|BITURBO|MELNS.?VĀKS|BLACK.?COVER/.test(hay)) {
        if (!/D5244T11|D5244T10|D5244T8|D5244T5|D5244T4/.test(fp.engineCode || "")) return 0;
      }
      if (/D5244T1[3456789]/.test(fp.engineCode || "")) return 0;
      s += codeHit;
      if (/D5|D5244|2400|2\.4/.test(hay)) s += 8;
      if (/DIESEL|DĪZEL|DIZEL/.test(hay)) s += 4;
      // ~120–140 kW + ~2400 cm³ + ~2004–2011 → T11 klase bez koda.
      s += powertrainProxyScore(fp, hay, {
        kwMin: 115,
        kwMax: 145,
        cm3Min: 2300,
        cm3Max: 2500,
        yearMin: 2004,
        yearMax: 2011,
        fuelRe: /DIESEL|DĪZEL|DIZEL/,
      });
      // Augstāka jauda tipiski biturbo — sodīt šo paku.
      const kw = parsePowerKw(fp);
      if (kw != null && kw >= 148) s -= 18;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**Konstrukcija (D5244T5/T8/T10/T11 u.c., tipiski ~120–140 kW / ~163–185 zs, viens VGT turbo):** piecu cilindru 2.4 dīzelis ar **zobsiksnu** (ne ķēdi). Šī paka NEattiecas uz biturbo / melnā vāka stāstu - to ņem tikai biturbo pakā.

**Zobsiksna + ūdenssūknis:** ražotāja josla bieži **180 000 km / 10 gadi**. Ja datos maiņa NAV fiksēta: tas ir **nepierādīts**, ne „neatliekami jāmaina”. >30k km vai >24 mēn. bez oficiālā ieraksta = darbs var būt bijis ārpus dīlera; jālūdz **dokumenti**. Klientam neraksti, ka siksna jau ir „nokavēta obligātā maiņa”, kamēr nav zināms pēdējais darbs.

**Papildsiksnas spriegotājs / brīvgaitas skriemelis (šīs paaudzes D5 paraksts):** nolietojoties siksna var pārtrūkt un tikt ierauta **zobsiksnas** mehānismā → vārstu/virzuļu sadursme. Klātienē klausīties čīkstoņu/gaudošanu aukstā startā; ja maiņas laiks nezināms — profilaktiski kopā ar zobsiksnas komplektu (kā risks, ne kā jau noticis defekts).

**Turbīnas VGT aktuators:** bieža kļūme šajā joslā — jaudas zudums, limpa režīms, kļūdu kodi. Testā: vienmērīga paātrināšanās bez aizkaves; diagnostika, ja iespējams.

**Ieplūde / ieplūdes vārstiņi / EGR:** kvēpu uzkrāšanās pie liela nobraukuma un pilsētas profila — jaudas zudums / dūmi kā **pārbaudāms** punkts, ne pierādīts defekts bez simptomiem datos.

**Manuālā M66 + divmasu + sajūgs:** pie 250–350k km resurss var būt tuvu, BET bez vibrācijām/skaņām tukšgaitā un uzsākot — neraksti „resurss beidzies”. Klātienes tests; € joslas klientam aizliegtas.

**Eļļas disciplīna:** bez oficiāliem intervāliem neizdomā izlaistas maiņas; pasaki, ka dokumenti jāprasa. Šī konstrukcija ar labu eļļu bieži pārsniedz 300 000 km kā ierastu darba mūžu.

**Klātienē:** auksts starts (papildsiksna); eļļas/dzesēšanas noplūdes (vārstu vāks, turbo); turbo aktuatora reakcija; DMF/sajūgs manuālei; Haldex eļļa, ja AWD.`,
  },
  {
    id: "volvo_d5_biturbo_block",
    minScore: 14,
    title: "Volvo — D5 biturbo / bloka plaisas, Haldex",
    score: (fp, hay) => {
      let s = brandScore(fp, ["VOLVO"], hay);
      if (/D5244T1[3456789]|D5244T2|BITURBO|MELNS.?VĀKS|BLACK.?COVER/.test(hay)) s += 16;
      s += engineScore(fp, ["D5244T13", "D5244T14", "D5244T15", "D5244T16", "D5244T17"]);
      // Viens turbo T11 klase — šo paku neņemt.
      if (/D5244T11|D5244T10|D5244T8|D5244T5|D5244T4/.test(fp.engineCode || "")) return 0;
      if (/DIESEL|DĪZEL|DIZEL|D5/.test(hay)) s += 4;
      s += powertrainProxyScore(fp, hay, {
        kwMin: 148,
        kwMax: 170,
        cm3Min: 2300,
        cm3Max: 2500,
        yearMin: 2008,
        yearMax: 2016,
        fuelRe: /DIESEL|DĪZEL|DIZEL/,
      });
      const kw = parsePowerKw(fp);
      // Zema jauda = visticamāk viens turbo — sodīt.
      if (kw != null && kw > 0 && kw < 145) s -= 16;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**2.4 D5 biturbo (bieži „melns vāks” / augstāka kW josla):** **bloka plaisas** — klusā **antifrīza zudums**, auksts gaiss no apkures braucot, dzesēšanas līmeņa krišana bez redzamas noplūdes. Šis stāsts NEattiecas uz ~136 kW / D5244T11 viena turbo klasi.

**Haldex AWD:** bez eļļas maiņas = **faktiska priekšpiedziņa**.

**Klātienē:** dzesēšanas līmenis trendā un smarža; apkures temperatūra braucienā; Haldex serviss; automāta (Aisin) plūdenums, ja nav manuāla.`,
  },
  {
    id: "volvo_d4_drive_e",
    minScore: 14,
    title: "Volvo — Drive-E D4 (D4204) zobsiksna",
    score: (fp, hay) => {
      if (/D5244/.test(hay) || /^D5244/.test(fp.engineCode || "")) return 0;
      let s = brandScore(fp, ["VOLVO"], hay);
      s += engineScore(fp, ["D4204", "D420"]);
      if (/D4204|DRIVE.?E|D4/.test(hay) && /DIESEL|DĪZEL|DIZEL/.test(hay)) s += 12;
      s += powertrainProxyScore(fp, hay, {
        kwMin: 110,
        kwMax: 140,
        cm3Min: 1960,
        cm3Max: 2000,
        yearMin: 2014,
        yearMax: 2024,
        fuelRe: /DIESEL|DĪZEL|DIZEL/,
      });
      const cm3 = parseDisplacementCm3(fp);
      if (cm3 != null && cm3 >= 2300) s -= 20;
      return s;
    },
    body: `${PACK_BODY_HEADER}

**Drive-E D4 (D4204T…, ~1969 cm³, tipiski ~120–140 kW) ≠ vecais 2.4 D5.** Biturbo bloka plaisas un D5244T11 papildsiksnas stāstus šeit NEDRĪKST kopēt.

**Zobsiksna + ūdenssūknis:** ražotāja intervāls (bieži ~180–240k / gadi pēc specifikācijas) - ja datos NAV fiksēta maiņa: **nepierādīts**, jālūdz dokumenti; ne „neatliekami obligāti” tikai no odometra.

**Eļļas patēriņš / PCV (agrīnās partijās):** kontrolēt eļļas līmeņa disciplīnu un dīlera ierakstus; neizdomāt patēriņu bez datiem.

**8-pakāpju Aisin (ja automāts):** eļļas intervāli un plūdenums testa braucienā. Haldex AWD - eļļas maiņa.

**Klātienē:** auksts starts; eļļas līmenis; siksnas dokumenti; Aisin/Haldex; dūmainība.`,
  },
  {
    id: "psa_stellantis",
    minScore: 12,
    title: "Peugeot / Citroën / DS / Opel — wet belt, PureTech",
    score: (fp, hay) => {
      let s = brandScore(fp, ["PEUGEOT", "CITROEN", "CITROËN", "DS", "OPEL"], hay);
      if (/PURETECH|1\.2|1\.6|WET|BELT|EB2|DV5|DV6/.test(hay)) s += 10;
      s += powertrainProxyScore(fp, hay, {
        kwMin: 60,
        kwMax: 130,
        cm3Min: 1190,
        cm3Max: 1600,
        yearMin: 2014,
        yearMax: 2024,
        fuelRe: /BENZ|PETROL|DIESEL|DĪZEL|PURETECH/,
      });
      return s;
    },
    body: `${PACK_BODY_HEADER}

**Wet belt (eļļā, PureTech / daži 1.2/1.0):** bieži **galvenais motors risks** — siksna degradējas ķīmiski bez skaļas brīdinājuma; gumijas atliekas aizzīž eļļas uztvērēju → eļļas bads. Profilaktiska maiņa vai **dokumenti**; trūkums = nepierādīts, ne „jau bojāts”.

**1.2 PureTech:** eļļas patēriņš un agrīna nolietojuma sajūta; īsāki eļļas intervāli pilsētā.

**BlueHDi / DV dīzelis:** AdBlue/DPF pilsētā; wet-belt stāstu uz ķēdes dīzeli NEkopē bez koda.

**Klātienē:** eļļas krāsa/līmenis; servisa intervāli / siksnas rēķins; vibrācija un dūmi; auksts starts.`,
  },
  {
    id: "renault_nissan",
    minScore: 10,
    title: "Renault / Dacia / Nissan — 1.5 dCi, CVT, hibrīdi",
    score: (fp, hay) => {
      let s = brandScore(fp, ["RENAULT", "DACIA", "NISSAN"], hay);
      if (/DCI|1\.5|1\.6|QASHQAI|X-TRAIL|K9K|R9M/.test(hay)) s += 8;
      s += powertrainProxyScore(fp, hay, {
        kwMin: 66,
        kwMax: 110,
        cm3Min: 1450,
        cm3Max: 1600,
        yearMin: 2005,
        yearMax: 2020,
        fuelRe: /DIESEL|DĪZEL|DCI/,
      });
      return s;
    },
    body: `${PACK_BODY_HEADER}

**1.5/1.6 dCi (K9K u.c.):** turbo un iesmidzinātāju nolietojums; EGR/DPF pilsētā. Eļļas intervāls kritisks ķēdei/turbo. Wet-belt PureTech stāstu uz dCi NEkopē.

**Nissan CVT (benzīns):** vibrācija un pārkaršana — testa brauciens obligāts; eļļas maiņas vēsture.

**Klātienē:** turbo spiedība; CVT bez slīdēšanas; servisa pierādījumi; dūmainība.`,
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
      if (/ECOBOOST|ECOSPORT|FOCUS|POWERSHIFT|WET.?BELT|1\.0|1\.5/.test(hay)) s += 10;
      s += powertrainProxyScore(fp, hay, {
        kwMin: 74,
        kwMax: 134,
        cm3Min: 990,
        cm3Max: 1500,
        yearMin: 2012,
        yearMax: 2024,
        fuelRe: /BENZ|PETROL|ECOBOOST/,
      });
      return s;
    },
    body: `${PACK_BODY_HEADER}

**1.0/1.5 EcoBoost:** dzesēšana un turbo resurss; dažās PSA platformās **wet belt** (eļļā) - tas pats ķīmiskās degradācijas risks kā PureTech; dokumenti vai profilakse. Neraksti wet-belt uz ķēdes EcoBoost bez koda.

**Powershift (sauss DCT):** **galvenais risks** — obligāts testa brauciens; smaka/slīdēšana.

**Klātienē:** pārslēgšanās; temperatūra; eļļas/siksnas pierādījumi.`,
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

**Rūsa Latvijā, Lietuvā un Igaunijā:** virsbūve un šasija — pārbaudes punkts pat „uzticamiem” zīmoliem.

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

export function formatAggregateCasePacksForAi(packs: AggregateCasePack[]): string {
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
