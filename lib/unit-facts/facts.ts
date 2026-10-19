/**
 * PROVIN agregātu faktu bāze — sākuma ieraksti (17.10.2026).
 * Avoti pārbaudīti 17.10.2026. Bez EUR summām.
 * Jauns fakts: pievieno ierakstu ar avotu un datumu; `verified` tikai ar ražotāja/iestādes
 * avotu vai 2 neatkarīgiem avotiem. B1-B8 tēmas = `pending_nils`.
 */
import type { UnitFact } from "@/lib/unit-facts/types";

const GEARBOX = ["kārb", "transmisij", "tiptronic", "gearbox", "\\b0C8\\b", "\\b09D\\b", "\\b0D5\\b"];
const CHAIN = ["ķēd", "chain"];

export const UNIT_FACTS: readonly UnitFact[] = [
  // ── Audi Q7 kārbas (IRISS 17.10: Q7 4L ar CRCA ir Aisin, ne ZF) ──────────────────────
  {
    id: "audi_q7_4l_gearbox_aisin",
    unitKind: "gearbox",
    codes: ["09D", "TR-60SN", "0C8", "TR-80SD", "TR-81SD"],
    topic: "gearbox_supplier",
    statementLv:
      "Audi Q7 (4L, 2006–2015) automātiskā kārba ir Aisin: 6 pakāpju 09D (TR-60SN) līdz ~2010, 8 pakāpju 0C8 (TR-80SD/TR-81SD) pēc modernizācijas. Nav ZF 8HP.",
    status: "verified",
    sources: [
      {
        kind: "oem_doc",
        title: "Audi SSP 367 — The six-speed automatic gearbox 09D in the Audi Q7",
        url: "https://en.audiclub.eu/manual_download.php?id=1631",
        accessed: "2026-10-17",
      },
      {
        kind: "oem_doc",
        title: "Audi SSP 950113 — 8-Speed Automatic Transmission 0C8",
        url: "https://www.springfieldvw.com/wp-content/uploads/ssp-assistant/docs/ssp/SSP%20AUDI/950113-audi-8-speed-automatic-transmission-0c8.pdf",
        accessed: "2026-10-17",
      },
      { kind: "iriss", title: "IRISS A/B vērtējums r2, auto 13 (Q7 4L CRCA)", accessed: "2026-10-17" },
    ],
    appliesTo: {
      anyOf: ["\\bQ7\\b"],
      andAnyOf: ["\\b4L\\b", "\\b4LB\\b", "\\bCRCA\\b", "\\bCASA\\b", "\\bCCMA\\b", "\\bBUG\\b", "\\bBUN\\b", "\\bCJGD\\b", "\\bCJMA\\b", "\\bJXX\\b", "\\b0C8\\b", "\\b09D\\b"],
      noneOf: ["\\b4M\\b", "\\b0D5\\b"],
      years: [2005, 2015],
    },
    contradictions: [
      {
        subject: GEARBOX,
        contradicts: ["\\bZF\\b", "\\b8HP"],
        unless: ["Aisin", "nav ZF", "ne ZF"],
        message: "Q7 4L kārba ir Aisin (09D vai 0C8), nevis ZF 8HP.",
      },
    ],
    note: "Q7 4M (no 2015) jau ir ZF 8HP65A (0D5), sk. audi_q7_4m_gearbox_zf.",
    addedAt: "2026-10-17",
  },
  {
    id: "audi_q7_4m_gearbox_zf",
    unitKind: "gearbox",
    codes: ["0D5", "AL552-8Q", "8HP65A"],
    topic: "gearbox_supplier",
    statementLv:
      "Audi Q7 (4M, no 2015) 8 pakāpju tiptronic 0D5 ražo ZF (8HP65A, Audi apzīmējums AL552-8Q).",
    status: "verified",
    sources: [
      {
        kind: "oem_doc",
        title: "Audi SSP 632 — Audi Q7 (type 4M), 8-speed automatic gearbox 0D5",
        url: "https://www.springfieldvw.com/wp-content/uploads/ssp-assistant/docs/ssp/SSP%20AUDI/SSP-632-audi-q7-type-4m.pdf",
        accessed: "2026-10-17",
      },
      {
        kind: "oem_doc",
        title: "Audi SSP 672 — Audi Q8 (type 4M), 0D5 AL552",
        url: "https://www.springfieldvw.com/wp-content/uploads/ssp-assistant/docs/ssp/SSP%20AUDI/SSP-672-audi-q8-type-4m.pdf",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: {
      anyOf: ["\\bQ7\\b"],
      andAnyOf: ["\\b4M\\b", "\\b0D5\\b", "\\bCRTC\\b", "\\bCVMD\\b", "\\bDCPC\\b", "\\bCZZA\\b", "\\bDHXA\\b"],
      noneOf: ["\\b4L\\b"],
      years: [2015, 2026],
    },
    contradictions: [
      {
        subject: GEARBOX,
        contradicts: ["Aisin"],
        unless: ["nav Aisin", "ne Aisin", "4L"],
        message: "Q7 4M kārba 0D5 ir ZF 8HP65A, nevis Aisin.",
      },
    ],
    addedAt: "2026-10-17",
  },

  // ── VAG 3.0 V6 TDI sadales ķēdes ────────────────────────────────────────────────────
  {
    id: "vag_30tdi_gen1_four_chains",
    unitKind: "engine",
    codes: ["ASB", "BKS", "BKN", "BMK", "BUG", "BUN", "CASA", "CASB", "CATA", "CCWA", "CCWB", "CDYA", "CDYC"],
    topic: "timing_drive",
    statementLv:
      "Pirmās paaudzes 3.0 V6 TDI (EA896, piem. BUG, CASA, CCWA, CDYA) sadales piedziņa ir ar četrām ķēdēm kārbas pusē.",
    status: "verified",
    sources: [
      {
        kind: "oem_doc",
        title: "Audi SSP 479 — 3.0l V6 TDI engine (second generation): ķēžu un spriegotāju skaits samazināts no četrām uz divām",
        url: "https://www.vag-technique.fr/ext_files/ssp/vw/SSP_479_Audi_3.0_L_V6_TDI_engine_seconde_g%C3%A9n%C3%A9ration_EN.pdf",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "PowerUP: Audi 3.0 TDI EA896 vs EA897 — four chains in the first generation",
        url: "https://powerupszczecin.pl/en/audi-3-0-v6-tdi-ea896-ea897-faults-timing-chains/",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: {
      anyOf: ["\\b(ASB|BKS|BKN|BMK|BUG|BUN|CASA|CASB|CATA|CCWA|CCWB|CDYA|CDYC)\\b"],
    },
    contradictions: [
      {
        subject: CHAIN,
        contradicts: ["\\bdivas\\s+(sadales\\s+)?ķēd", "\\b2\\s+ķēd", "two\\s+chains"],
        unless: ["četr", "\\b4\\s+ķēd"],
        message: "Pirmās paaudzes 3.0 TDI (EA896) ir četras sadales ķēdes, nevis divas.",
      },
    ],
    addedAt: "2026-10-17",
  },
  {
    id: "vag_30tdi_gen2_chain_count",
    unitKind: "engine",
    codes: [
      "CDTA",
      "CDTB",
      "CDUC",
      "CDUD",
      "CJMA",
      "CJGD",
      "CKVB",
      "CKVC",
      "CLAA",
      "CLAB",
      "CRCA",
      "CRCD",
      "CNRB",
      "CPNB",
      "CTBA",
      "CVVA",
      "CVWA",
    ],
    topic: "timing_drive",
    statementLv:
      "3.0 V6 TDI EA897 (Audi otrā paaudze, no ~2010, piem. CLAA, CRCA, CDUC) ir divas ķēdes kārbas pusē: sadales ķēde (206 posmi, ieplūdes vārpsta un balansvārpsta) un palīgpiedziņas ķēde (augstspiediena sūknis, eļļas/vakuuma sūknis). Četras ķēdes bija pirmajai paaudzei (EA896).",
    status: "verified",
    sources: [
      {
        kind: "oem_doc",
        title:
          "Audi SSP 479, 9. lpp. Chain drive and valvegear, att. 479_003: reduces the number of chains and chain tensioners from four to two",
        url: "https://www.vag-technique.fr/ext_files/ssp/vw/SSP_479_Audi_3.0_L_V6_TDI_engine_seconde_g%C3%A9n%C3%A9ration_EN.pdf",
        accessed: "2026-10-17",
      },
      {
        kind: "oem_doc",
        title:
          "VW Workshop Manual Touareg 2010+ 3.0 TDI CR generation II (CRCA, CJGD, CJMA, CNRB, CVWA, CVVA, CRCD), Ed. 01.2019, RG15 3.1 camshaft timing chain, 3.2 drive chain for oil pump and HP pump",
        url: "https://www.scribd.com/document/709620189/Engine-Crca-Cjma-Cjgd-Cnrb-Cvva-Cvwa-Crcd-Repair-Manual-Eng",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "Lymm Engine Parts: komplekts 059109229AA (206 un 136 posmu ķēde) der CLAA, CRCA, CDUC",
        url: "https://www.lymmengineparts.co.uk/timing-chain-kits/audi-timing-chain-kit-059109229AA-45008",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: {
      anyOf: ["\\b(CDTA|CDTB|CDUC|CDUD|CJMA|CJGD|CKVB|CKVC|CLAA|CLAB|CRCA|CRCD|CNRB|CPNB|CTBA|CVVA|CVWA)\\b"],
    },
    contradictions: [
      {
        subject: CHAIN,
        contradicts: ["\\bčetr\\w*\\s+(sadales\\s+)?ķēd", "\\b4\\s+ķēd", "four\\s+chains"],
        unless: ["EA896", "pirm\\w*\\s+paaudz"],
        message: "EA897 (CLAA, CRCA, CDUC u.c.) ir 2 ķēdes (SSP 479, 9. lpp.); 4 ķēdes ir EA896.",
      },
    ],
    note: "Nils 17.10.2026: verified, 2 ķēdes. IRISS r2 auto 15 „4 ķēdes” atcelts. EA897 evo (SSP 581, 2018+) ir 3 ķēdes: vag_30tdi_ea897evo_three_chains (draft).",
    addedAt: "2026-10-17",
  },

  // ── Mercedes 7G-DCT (724.0) ─────────────────────────────────────────────────────────
  {
    id: "mb_7gdct_service_interval",
    unitKind: "gearbox",
    codes: ["724.0", "7G-DCT"],
    topic: "service_interval",
    statementLv:
      "Mercedes 7G-DCT (724.0, CLA/GLA/A/B) kārbas eļļas un abu filtru maiņa ik ~60 000 km vai 6 gadi (AMG versijām 30 000 km).",
    status: "verified",
    sources: [
      {
        kind: "oem_doc",
        title: "StarTuned (Mercedes-Benz USA izdevums servisiem) — 7G-DCT (724.0) Care & Maintenance, 03.2018",
        url: "https://automotivetechinfo.com/wp-content/uploads/2018/03/7G-DCT-724.0-Care-and-Maintenance.pdf",
        accessed: "2026-10-17",
      },
      { kind: "iriss", title: "IRISS A/B vērtējums r2, auto 7 (CLA 180): „7G-DCT ~60 000 km cikls”", accessed: "2026-10-17" },
    ],
    appliesTo: {
      anyOf: ["7G-?DCT", "\\b724\\.0\\b", "\\bCLA\\b", "\\bGLA\\b"],
    },
    contradictions: [
      {
        subject: ["7G-?DCT", "\\b724\\.0\\b", "kārb"],
        contradicts: [
          "(1[0-9]{2}|2[0-9]{2})[\\s\\u00a0]?000\\s*km",
          "(1[0-9]{2}|2[0-9]{2})\\s*(tūkst|tk)",
          "(1[0-9]{2}|2[0-9]{2})[-–](1[0-9]{2}|2[0-9]{2})\\s*tūkst",
        ],
        unless: ["nobrauk", "odometr", "veikt", "fiksēt", "mainīt"],
        level: "W",
        message: "7G-DCT eļļas maiņas cikls ir ~60 000 km; pārbaudi, vai teikumā nav nepareizs intervāls vai „nākamā apkope”.",
      },
    ],
    note: "Mercedes detaļu katalogi (Meyle/PST 2025) norāda arī 100 000 km jaunākiem; IRISS izmanto 60 000 km. ASV StarTuned 60K ir 96 561 km pēc pārrēķina; ES cikls paliek 60 000 km. Pārbaude brīdina tikai par intervāla vārdiem.",
    addedAt: "2026-10-17",
  },

  // ── BMW M340i jauda ─────────────────────────────────────────────────────────────────
  {
    id: "bmw_m340i_power_eu",
    unitKind: "vehicle",
    codes: ["M340i", "B58B30", "G20", "G21"],
    topic: "power_output",
    statementLv:
      "BMW M340i (G20/G21) Eiropas specifikācijā: 275 kW (374 ZS) gan līdz 2022, gan pēc 2022 modernizācijas (48 V). 285 kW ir Austrālijas tirgus dati.",
    status: "verified",
    sources: [
      {
        kind: "oem_press",
        title: "BMW Group PressClub 15.11.2018 — The new BMW M340i xDrive Sedan: 275 kW/374 hp",
        url: "https://www.press.bmwgroup.com/middle-east/article/detail/T0287062EN",
        accessed: "2026-10-17",
      },
      {
        kind: "oem_press",
        title: "BMW Group PressClub UK — The new BMW 3 Series Saloon and Touring (LCI 2022)",
        url: "https://www.press.bmwgroup.com/united-kingdom/article/detail/T0390793EN_GB",
        accessed: "2026-10-17",
      },
      { kind: "iriss", title: "IRISS A/B vērtējums r2, auto 17 (M340i G21): „285 kW apšaubāma (M340i ir 275 kW)”", accessed: "2026-10-17" },
    ],
    appliesTo: { anyOf: ["M340i", "M\\s?340i"] },
    contradictions: [
      {
        subject: ["kW", "jaud", "ZS", "\\bhp\\b"],
        contradicts: ["\\b285\\s*kW", "\\b387\\s*(ZS|hp|PS)", "\\b382\\s*(ZS|hp|PS)"],
        unless: ["Austrālij", "ASV"],
        level: "W",
        message: "Eiropas M340i jauda ir 275 kW (374 ZS); 285 kW/387 ZS ir citu tirgu dati. Salīdzini ar CSDD kW.",
      },
    ],
    addedAt: "2026-10-17",
  },

  // ── Tesla eMMC ──────────────────────────────────────────────────────────────────────
  {
    id: "tesla_emmc_recall_21v035",
    unitKind: "recall",
    codes: ["21V-035", "SB-21-21-001", "MCU1", "eMMC"],
    topic: "recall_scope",
    statementLv:
      "Tesla 8 GB eMMC (MCU1, NVIDIA Tegra 3) atsaukums NHTSA 21V-035 / SB-21-21-001 attiecas tikai uz Model S (2012–2018) un Model X (2016–2018). Model 3 un Model Y uz to neattiecas.",
    status: "verified",
    sources: [
      {
        kind: "authority",
        title: "NHTSA recall acknowledgement 21V-035 (Tesla Model S 2012–2018, Model X 2016–2018)",
        url: "https://static.nhtsa.gov/odi/rcl/2021/RCAK-21V035-5245.pdf",
        accessed: "2026-10-17",
      },
      {
        kind: "authority",
        title: "NHTSA Part 573 report 21V-035",
        url: "https://static.nhtsa.gov/odi/rcl/2021/RCLRPT-21V035-4682.PDF",
        accessed: "2026-10-17",
      },
      { kind: "iriss", title: "IRISS A/B vērtējums r2, auto 1 (Model 3): „eMMC problēma attiecas uz Model S/X MCU1”", accessed: "2026-10-17" },
    ],
    appliesTo: { anyOf: ["Model\\s?3", "Model\\s?Y"], andAnyOf: ["Tesla"] },
    contradictions: [
      {
        subject: ["eMMC", "MCU\\s?1", "21V-?035", "Tegra"],
        contradicts: ["."],
        unless: ["neattiecas", "tikai\\s+(uz\\s+)?Model\\s?S", "Model\\s?S\\s*(un|/)\\s*X"],
        message: "eMMC/MCU1 atsaukums (21V-035) attiecas tikai uz Model S/X, ne Model 3/Y.",
      },
    ],
    addedAt: "2026-10-17",
  },

  // ── VW 48VS ─────────────────────────────────────────────────────────────────────────
  {
    id: "vw_recall_48vs_scope",
    unitKind: "recall",
    codes: ["48VS"],
    topic: "recall_scope",
    statementLv:
      "VW atsaukums 48VS (stūres mehānisma stiprinājuma skrūves korozija): VW DK nosauc Tiguan, Touran, Golf un Caddy, bet konkrēta VIN piederība STRĪDĪGA (IRISS: 2022 Tiguan visticamāk neattiecas). Piederību nosaka tikai pēc VIN pie VW dīlera.",
    status: "disputed",
    sources: [
      {
        kind: "authority",
        title: "Volkswagen Danmark — Tilbagekaldelse Aktion 48VS (publ. 14.10.2026): Tiguan MY2016–2024, Touran MY2016–2024, Golf MY2014–2024, Caddy MY2021–2025 (DK: tikai importēti)",
        url: "https://www.volkswagen.dk/da/vaerksted/nyttig-viden/tilbagekaldelser/aktion48vs.html",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "Fischer Auto (VW partneris, DE) — VW Rückruf 48VS",
        url: "https://fischer-auto.de/vw-rueckrufaktion-48vs",
        accessed: "2026-10-17",
      },
      {
        kind: "iriss",
        title: "IRISS A/B vērtējums r2, auto 12: „48VS, visticamāk, uz 2022 Tiguan neattiecas”",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["Tiguan", "Touran", "Golf", "Caddy"] },
    touches: [
      "48VS[^.]{0,220}(neattiecas|nav\\s+attiecin)",
      "(neattiecas|nav\\s+attiecin)[^.]{0,220}(48VS|Tiguan|Touran|Golf|Caddy)",
      "attiecas\\s+tikai\\s+uz\\s+Caddy",
    ],
    note: "IRISS r2 auto 12 pret VW DK oficiālo lapu. Līdz Nila/IRISS lēmumam pārbaude tikai brīdina, nekad nesaka, kurš pareizs.",
    addedAt: "2026-10-17",
  },
  {
    id: "vw_recall_48vs_other_models",
    unitKind: "recall",
    codes: ["48VS"],
    topic: "recall_scope",
    statementLv: "48VS nav zināms citiem modeļiem kā Tiguan, Touran, Golf, Caddy.",
    status: "verified",
    sources: [
      {
        kind: "authority",
        title: "Volkswagen Danmark — Aktion 48VS",
        url: "https://www.volkswagen.dk/da/vaerksted/nyttig-viden/tilbagekaldelser/aktion48vs.html",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: {
      anyOf: ["Volkswagen", "\\bVW\\b", "Škoda", "Skoda", "SEAT", "Cupra", "Audi"],
      noneOf: ["Tiguan", "Touran", "Golf", "Caddy"],
    },
    contradictions: [
      {
        subject: ["48VS"],
        contradicts: ["."],
        unless: ["neattiecas", "nav\\s+attiecin"],
        message: "48VS ir Tiguan/Touran/Golf/Caddy kampaņa; šim modelim to nepiemin bez dīlera apstiprinājuma pēc VIN.",
      },
    ],
    addedAt: "2026-10-17",
  },

  // ── Mercedes A12/00346/20 ───────────────────────────────────────────────────────────
  {
    id: "mb_recall_a12_00346_20",
    unitKind: "recall",
    codes: ["A12/00346/20", "9190204"],
    topic: "recall_scope",
    statementLv:
      "EU Safety Gate A12/00346/20 (Mercedes kampaņa 9190204): A, B klase un CLA, priekšējā pasažiera sēdekļa klasifikācijas sistēmas kalibrācija (drošības spilvena aktivizācija).",
    status: "verified",
    sources: [
      {
        kind: "authority",
        title: "EU Safety Gate alert A12/00346/20 (publ. 06.03.2020, Vācija)",
        url: "https://ec.europa.eu/safety-gate-alerts/screen/webReport",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "CarsMultiverse — Safety Gate A12/00346/20 kopija (ražotāja kods 9190204)",
        url: "https://carsmultiverse.com/the-european-alerts/alert-a12-00346-20/",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["A12/00346/20", "9190204"] },
    note: "Ja pasūtījuma datos ir šis kods, teksts nedrīkst teikt „atsaukumu nav” (vispārējais noteikums recall_denied).",
    addedAt: "2026-10-17",
  },

  // ── BMW N63 Customer Care Package ───────────────────────────────────────────────────
  {
    id: "bmw_n63_customer_care_scope",
    unitKind: "recall",
    codes: ["SIB 11 06 14", "N63 Customer Care Package"],
    topic: "recall_scope",
    statementLv: "BMW N63 Customer Care Package (SIB 11 06 14) attiecas tikai uz N63 dzinēju, nevis N63TU (N63B44O1/O2).",
    status: "verified",
    sources: [
      {
        kind: "authority",
        title: "BMW SIB 11 06 14 N63 Engine: Customer Care Package (NHTSA TSB kopija)",
        url: "https://static.nhtsa.gov/odi/tsbs/2025/MC-11016414-0001.pdf",
        accessed: "2026-10-17",
      },
      { kind: "iriss", title: "IRISS A/B vērtējums r2, auto 4 (650i): „N63 Customer Care Package uz N63TU neattiecas”", accessed: "2026-10-17" },
    ],
    appliesTo: { anyOf: ["N63TU", "N63B44O1", "N63B44O2", "N63B44T"] },
    contradictions: [
      {
        subject: ["Customer\\s+Care"],
        contradicts: ["."],
        unless: ["neattiecas", "nav\\s+attiecin"],
        message: "N63 Customer Care Package neattiecas uz N63TU.",
      },
    ],
    addedAt: "2026-10-17",
  },

  // ── Volvo D5 ────────────────────────────────────────────────────────────────────────
  {
    id: "volvo_d5244t15_twin_turbo",
    unitKind: "engine",
    codes: ["D5244T15", "D5 215"],
    topic: "turbo_layout",
    statementLv: "Volvo D5 2.4 (D5244T15, 158 kW/215 ZS, no 2011) ir ar secīgu divu turbokompresoru sistēmu.",
    status: "verified",
    sources: [
      {
        kind: "oem_press",
        title: "Volvo Cars Media 12.04.2011 — Upgraded D5 engine (215 hp, sequential twin-turbo)",
        url: "https://www.media.volvocars.com/global/en-gb/media/pressreleases/37375",
        accessed: "2026-10-17",
      },
      {
        kind: "oem_doc",
        title: "Volvo Cars Global Media — 2015 S60 Technical Data",
        url: "https://www.media.volvocars.com/global/en-gb/models/old-s60/2015/specifications",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["D5244T15"] },
    contradictions: [
      {
        subject: ["turb"],
        contradicts: ["vien(a|s)\\s+turb", "bez\\s+divu\\s+turb", "single\\s+turbo", "viinturb"],
        message: "D5244T15 ir divu turbokompresoru (biturbo) dzinējs.",
      },
    ],
    addedAt: "2026-10-17",
  },
  {
    id: "volvo_d5244t5_single_turbo",
    unitKind: "engine",
    codes: ["D5244T5"],
    topic: "turbo_layout",
    statementLv: "Volvo D5244T5 ir viena turbokompresora 2.4D.",
    status: "pending_nils",
    sources: [{ kind: "specialist", title: "Andra izpēte B3 (zinasanas/01-agregatu-tabula.md)", accessed: "2026-10-17" }],
    appliesTo: { anyOf: ["D5244T5\\b"] },
    note: "B3 — jāizrunā ar Nilu pirms ieslēgšanas.",
    addedAt: "2026-10-17",
  },

  // ── VAG EA288 zobsiksna ─────────────────────────────────────────────────────────────
  {
    id: "vag_ea288_timing_belt_210k",
    unitKind: "engine",
    codes: ["EA288", "CRLB", "CRBC", "CUNA", "DFGA", "DFFA", "DFSF", "DTUA", "DPCA"],
    topic: "service_interval",
    statementLv: "VAG EA288 2.0/1.6 TDI zobsiksnas maiņas intervāls pēc ražotāja ir 210 000 km.",
    status: "verified",
    sources: [
      {
        kind: "supplier",
        title: "Gates — VAG timing system replacement intervals (TechTips #020)",
        url: "https://www.techtips.ie/Gates/vag-timing-system-replacement-intervals.pdf",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "RWC Motorsport — VW TDI maintenance schedule by engine code",
        url: "https://www.rwcmotorsport.com/tech/tdi-maintenance.php",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["EA288", "\\b(CRLB|CRBC|CUNA|DFGA|DFFA|DFSF|DTUA|DPCA|DCXA|DETA|DFBA)\\b"] },
    contradictions: [
      {
        subject: ["zobsiksn"],
        contradicts: [
          "(intervāl|ik\\s+pēc|ik\\s|katr\\w*|jāmaina\\s+pie|maiņ\\w*\\s+pie)[^.]{0,40}\\b(1[2-9]\\d|2[02-9]\\d)[\\s\\u00a0]?000\\s*km",
          "(intervāl|ik\\s+pēc|ik\\s|katr\\w*)[^.]{0,40}\\b(1[2-9]\\d|2[02-9]\\d)\\s*tūkst",
        ],
        unless: ["210[\\s\\u00a0]?000", "210\\s*tūkst", "neatkarīg", "iesaka\\s+agrāk"],
        level: "W",
        message: "EA288 zobsiksnas ražotāja intervāls ir 210 000 km.",
      },
    ],
    note: "EA189 (piem. CFHF) šeit NAV iekļauts; tam savs intervāls.",
    addedAt: "2026-10-17",
  },

  // ── BMW N47 / MB OM651 ķēde aizmugurē ───────────────────────────────────────────────
  {
    id: "bmw_n47_chain_rear",
    unitKind: "engine",
    codes: ["N47D20", "N47D20A", "N47D20C", "N47D20D", "N47D16"],
    topic: "timing_drive",
    statementLv: "BMW N47 sadales ķēde ir dzinēja aizmugurē (kārbas/spararata pusē); maiņai parasti jāizceļ dzinējs.",
    status: "verified",
    sources: [
      {
        kind: "specialist",
        title: "Burch Motor Works — N47 timing chain replacement",
        url: "https://burchmotorworks.co.uk/performance-and-maintenance/timing-chain-replacement/",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "ScegliAuto — changing the chains of a BMW N47 without removing the engine is not possible",
        url: "https://www.scegliauto.com/en/video/bmw/tutorial/87666/",
        accessed: "2026-10-17",
      },
      { kind: "specialist", title: "Andra izpēte: 9 PROVIN atskaites vienprātīgi (zinasanas/01)", accessed: "2026-10-17" },
    ],
    appliesTo: { anyOf: ["\\bN47"] },
    contradictions: [
      {
        subject: CHAIN,
        contradicts: ["dzinēja\\s+priekš", "priekšpusē", "priekšējā\\s+daļā", "front\\s+of\\s+the\\s+engine"],
        unless: ["aizmugur"],
        message: "N47 sadales ķēde ir aizmugurē (kārbas pusē).",
      },
    ],
    addedAt: "2026-10-17",
  },
  {
    id: "mb_om651_chain_rear",
    unitKind: "engine",
    codes: ["OM651"],
    topic: "timing_drive",
    statementLv: "Mercedes OM651 sadales ķēde ir dzinēja aizmugurē (spararata pusē).",
    status: "verified",
    sources: [
      {
        kind: "oem_doc",
        title: "Mercedes-Benz OM651 Service Manual (ManualMachine kopija)",
        url: "https://manualmachine.com/mercedes/om651/28654484-service-manual/",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "MOTOR-TALK — OM651 Steuerkette-Wechsel ohne Getriebe- & Motorausbau",
        url: "https://www.motor-talk.de/forum/om651-steuerkette-wechsel-ohne-getriebe-motorausbau-t7149228.html",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["OM\\s?651", "\\b651\\.\\d{3}\\b"] },
    contradictions: [
      {
        subject: CHAIN,
        contradicts: ["dzinēja\\s+priekš", "priekšpusē", "priekšējā\\s+daļā"],
        unless: ["aizmugur"],
        message: "OM651 sadales ķēde ir aizmugurē (spararata pusē).",
      },
    ],
    addedAt: "2026-10-17",
  },

  // ── VAG DQ381 intervāls (strīdīgs) ──────────────────────────────────────────────────
  {
    id: "vag_dq381_service_interval",
    unitKind: "gearbox",
    codes: ["DQ381", "0GC"],
    topic: "service_interval",
    statementLv:
      "VAG DQ381 (0GC) eļļas un filtra maiņas intervāls STRĪDĪGS: ES avoti 120 000 km vai 5 gadi; VW 2026 ASV grāmata 128 748 km, smagos apstākļos 96 561 km. Konkrētam auto jāpārbauda pēc VIN.",
    status: "disputed",
    sources: [
      {
        kind: "oem_doc",
        title: "VW Owners Literature 2026 VW Service (US): 0GC 128 748 km; smagie apstākļi 96 561 km",
        url: "https://ownersliterature.vw.com/owners-literature-service/v1/document/d063309f-f793-4d23-8799-a4ff5ffb3850",
        accessed: "2026-10-17",
        note: "ASV grāmata. Intervāli pārrēķināti uz km.",
      },
      {
        kind: "supplier",
        title: "VAICO/Vierol: DQ381 intervāls pagarināts no 60 000 km (DQ250) uz 120 000 km un 5 gadiem",
        url: "https://blog.vierol-shop.de/vw-7-gang-doppelkupplungsgetriebe-dsg-0gc-dq381/",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "HIXA: DQ381 120 000 km / 5 gadi, G 055 529 A2",
        url: "https://hixa.eu/blog/dq381-oil-change-interval-capacity-cost",
        accessed: "2026-10-17",
      },
      { kind: "specialist", title: "Andra KB data/kb/vag-DQ381.yaml (draft)", accessed: "2026-10-17" },
    ],
    appliesTo: { anyOf: ["DQ381", "\\b0GC\\b"] },
    touches: [
      "(DQ381|0GC|DSG|kārb)[^.]{0,120}(intervāl|ik\\s+pēc)",
      "(intervāl|ik\\s+pēc)[^.]{0,120}(DQ381|0GC|DSG|kārb)",
    ],
    note: "Paliek disputed līdz ES erWin/ELSA pēc VIN. 4Motion smagais intervāls (96 561 km no ASV grāmatas): nav apstiprināts ES.",
    addedAt: "2026-10-17",
  },
  {
    id: "vag_30tdi_ea897evo_three_chains",
    unitKind: "engine",
    codes: ["EA897evo", "DEND", "DHXA", "DCPC"],
    topic: "timing_drive",
    statementLv:
      "3.0 V6 TDI EA897 evo (Generation 2, no 2018, piem. Touareg CR7 DEND): sadales ķēde, atsevišķa augstspiediena sūkņa ķēde un eļļas/vakuuma sūkņa ķēde dzinēja priekšpusē.",
    status: "draft",
    sources: [
      {
        kind: "oem_doc",
        title: "VW SSP 581: 3.0-l V6 TDI EA897 (Generation 2), sadaļa Chain drive",
        url: "https://www.motor-talk.de/forum/aktion/Attachment.html?attachmentId=832492",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "Clonck: VW repair manual CR7 DEND satura rādītājs (camshaft timing chains / HP pump / oil pump)",
        url: "https://home.clonck.com/en/manuals/6-cylinder_common_rail_engine_%283.0_l%2C_4V%2C_EA_897_Gen_II%2C_turbocharger%29-CR7-538/",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["\\bDEND\\b", "EA897\\s*evo"] },
    note: "draft: evo kodu saraksts nav pilnībā pārbaudīts. Netiek ievadīts promptā.",
    addedAt: "2026-10-17",
  },
  {
    id: "bmw_n57_b47_egr_cooler_campaign",
    unitKind: "recall",
    codes: ["N57", "B47", "N47", "B37", "B57", "18V-755", "21V-907"],
    topic: "recall_scope",
    statementLv:
      "BMW dīzeļiem (t.sk. N57, B47) ir AGR dzesētāja tehniskā kampaņa: glikola noplūde un kvēpi var izkausēt ieplūdes kolektoru, retos gadījumos aizdegšanās. Piederību nosaka pēc VIN.",
    status: "verified",
    sources: [
      {
        kind: "oem_press",
        title: "BMW Group 07.08.2018: Technische Aktion AGR-Modul",
        url: "https://www.press.bmwgroup.com/deutschland/article/detail/T0283855DE/die-bmw-group-informiert-ueber-eine-freiwillige-technische-aktion?language=de",
        accessed: "2026-10-17",
      },
      {
        kind: "oem_press",
        title: "BMW Group 23.10.2018: expands technical campaign (ražoti 08/2010-08/2017)",
        url: "https://www.press.bmwgroup.com/global/article/detail/T0286151EN/bmw-group-expands-technical-campaign?language=en",
        accessed: "2026-10-17",
      },
      {
        kind: "authority",
        title: "NHTSA 18V-755 / 21V-907: EGR cooler",
        url: "https://www.nhtsa.gov/recalls?nhtsaId=21V907",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["\\bN57", "\\bB47", "\\bN47", "\\bB37", "\\bB57"] },
    contradictions: [
      {
        subject: ["AGR", "EGR"],
        contradicts: ["atsauk\\w*\\s+nav", "nav\\s+atsauk", "kampaņ\\w*\\s+nav"],
        unless: ["pēc\\s+VIN", "VIN", "veikt", "izpildīt"],
        level: "W",
        message: "BMW AGR dzesētāja kampaņa skar N47/N57/B37/B47/B57; atsaukumu nav drīkst teikt tikai pēc VIN pārbaudes.",
      },
    ],
    addedAt: "2026-10-17",
  },
  {
    id: "bmw_n57_b47_chain_rear",
    unitKind: "engine",
    codes: ["N57", "N57D30", "B47", "B47D20"],
    topic: "timing_drive",
    statementLv: "BMW N57 un B47 sadales ķēde ir dzinēja aizmugurē (kārbas/spararata pusē); BMW maiņas intervālu nenosaka.",
    status: "verified",
    sources: [
      {
        kind: "specialist",
        title: "bmwengines.uk: N57 timing chain, rear-mounted, no scheduled interval",
        url: "https://bmwengines.uk/technical/n57-timing-chain-or-belt",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "PowerUP: BMW N47/B47 timing chains (rear)",
        url: "https://powerupszczecin.pl/en/bmw-n47-and-b47-timing-chains-symptoms-and-replacement/",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "Meksta: BMW B47 (chain at flywheel end)",
        url: "https://meksta.com/en/engines/bmw-b47",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["\\bN57", "\\bB47"] },
    contradictions: [
      {
        subject: CHAIN,
        contradicts: ["dzinēja\\s+priekš", "priekšpusē", "priekšējā\\s+daļā"],
        unless: ["aizmugur", "M57"],
        message: "N57/B47 sadales ķēde ir aizmugurē (kārbas pusē).",
      },
    ],
    addedAt: "2026-10-17",
  },
  {
    id: "bmw_n57_conrod_bearings",
    unitKind: "engine",
    codes: ["N57", "N57D30"],
    topic: "known_issue",
    statementLv:
      "BMW N57 dzinējiem klaņa gultņu noberze ir zināma tipiska kaite. Nav ražotāja TSB; avots ir īpašnieka apstiprinājums.",
    status: "verified",
    sources: [
      {
        kind: "nils",
        title: "Nils 2026-10-17: N57 klaņa gultņu noberze ir apstiprināta tipiska kaite (īpašnieka apstiprinājums)",
        accessed: "2026-10-17",
      },
      {
        kind: "iriss",
        title: "PROVIN owner seed ki_owner_n57_conrod_bearings",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["\\bN57"] },
    contradictions: [
      {
        subject: ["klaņ", "šāl", "gultņ"],
        contradicts: ["nav tipisk", "nav sistēmisk", "neattiecas", "nav zinām"],
        unless: ["M57"],
        message: "N57 klaņa gultņu noberze ir apstiprināta tipiska kaite.",
      },
    ],
    note: "Nav oficiāla ražotāja avota. Statuss paliek verified, jo Nils to apstiprināja kā tipisku kaiti (M14).",
    addedAt: "2026-10-17",
  },
  {
    id: "bmw_m57_chain_front_swirl",
    unitKind: "engine",
    codes: ["M57", "M57TU", "M57TU2", "M57D30"],
    topic: "known_issue",
    statementLv:
      "BMW M57/M57TU sadales ķēde ir dzinēja priekšpusē. Zināma kaite: ieplūdes virpuļvārstu (swirl flaps) atdalīšanās, kas var sabojāt dzinēju.",
    status: "verified",
    sources: [
      {
        kind: "specialist",
        title: "bmwengines.uk: M57 timing chain (front)",
        url: "https://bmwengines.uk/technical/m57-timing-chain-or-belt",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "cargeek: BMW M57 specs and common faults",
        url: "https://cargeek.org/engines/bmw-m57",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "Prestige German Engines: BMW swirl flap failure",
        url: "https://prestige-german-engines.co.uk/engine-issues/bmw-swirl-flap-failure/",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "PMW Ltd: Swirl flaps",
        url: "https://www.pmwltd.co.uk/swirl_flaps.pdf",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["\\bM57"] },
    note: "ASV M57TU2 (X5 35d 2009-2013): NHTSA 18V-336 rullīša skrūve, 13V-339 degvielas filtra sildītājs. Kaites nobraukums: nav apstiprināts.",
    addedAt: "2026-10-17",
  },
  {
    id: "mb_om642_chain_stretch_tsb",
    unitKind: "engine",
    codes: ["OM642", "LI05.10-P-049909"],
    topic: "known_issue",
    statementLv:
      "Mercedes OM642 ir sadales ķēde bez maiņas intervāla. MB servisa informācija LI05.10-P-049909: grabēšana 2-5 s pēc palaišanas var nozīmēt ķēdes izstiepšanos, kas jāizmēra ar speciālu instrumentu.",
    status: "verified",
    sources: [
      {
        kind: "oem_doc",
        title: "MB LI05.10-P-049909: Engine 642 noises after engine start",
        url: "https://dot.report/bulletins/10135867",
        accessed: "2026-10-17",
      },
      {
        kind: "oem_doc",
        title: "Chrysler/Jeep WK OM642 3.0 CRD service information: chain-driven DOHC",
        url: "https://johnmeister.com/jeep/WK-old/WK-OM642-TECH/OM642-WK-CRD-engine.pdf",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["OM\\s?642", "\\b642\\.\\d{3}\\b"] },
    addedAt: "2026-10-17",
  },
  {
    id: "mb_7gtronic_7229_fluid_interval",
    unitKind: "gearbox",
    codes: ["722.9", "7G-Tronic", "7G-Tronic Plus", "NAG2", "236.14", "236.15"],
    topic: "service_interval",
    statementLv:
      "Mercedes 7G-Tronic 722.9: līdz kārbas Nr. 2834526 sarkanā ATF 134 (MB 236.14), no Nr. 2834527 zilā FE-ATF 134 (MB 236.15). 7G-Tronic Plus (no 09.2010) eļļas maiņa ik 125 000 km (agrāk vienreiz pie 50 000 km).",
    status: "verified",
    sources: [
      {
        kind: "oem_doc",
        title: "Daimler/Mercedes-Benz Service: 7G-TRONIC/7G-TRONIC PLUS (722.9) in the Workshop, Tips and Tricks (2013), 52.-53. lpp.",
        url: "https://site-td63gwwa.wsecdn1.websitecdn.com/uploads/79aa675ed38543468843cf19149f43a2.pdf",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["722\\.9", "7G-?Tronic"] },
    contradictions: [
      {
        subject: ["722\\.9", "7G-?Tronic"],
        contradicts: ["mūža\\s+eļļ", "lifetime", "nav\\s+jāmaina"],
        level: "W",
        message: "722.9 eļļa nav mūža: 7G-Tronic Plus ik 125 000 km (MB).",
      },
    ],
    addedAt: "2026-10-17",
  },
  {
    id: "vag_ea189_20cr_timing_belt",
    unitKind: "engine",
    codes: ["EA189", "CBDB", "CBAB", "CFFB", "CFHC", "CBBB"],
    topic: "service_interval",
    statementLv:
      "VW EA189 2.0 TDI common rail zobsiksna: modeļiem līdz 2009 180 000 km; Golf VI, Scirocco/Jetta no 2010: siksna un spriegotājs ik 210 000 km (pēc VW ieteikuma).",
    status: "verified",
    sources: [
      {
        kind: "supplier",
        title: "ContiTech: VW 2.0L CBDB common rail timing belt guide (VW intervāli)",
        url: "https://www.techtips.ie/Contitech/vw-20l-cbdb-common-rail-engines-timing-belt-guide-1.pdf",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "RWC Motorsport: VW TDI maintenance schedule by engine code",
        url: "https://www.rwcmotorsport.com/tech/tdi-maintenance.php",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["EA189", "\\b(CBDB|CBAB|CFFB|CFHC|CBBB|CFGB|CLCB|CJAA)\\b"] },
    note: "1.6 TDI (CAY*) intervāls šajā pārbaudē nav apstiprināts.",
    addedAt: "2026-10-17",
  },
  {
    id: "vag_ea189_nox_action_23q7",
    unitKind: "recall",
    codes: ["EA189", "23Q7"],
    topic: "recall_scope",
    statementLv:
      "VW EA189 dīzeļiem KBA apstiprināts NOx pasākums (VW akcija 23Q7): 1.6 TDI: plūsmas taisngriezis pirms gaisa masas mērītāja un programmatūra; 1.2 un 2.0 TDI: programmatūra. Izpildi pārbauda pēc VIN.",
    status: "verified",
    sources: [
      {
        kind: "oem_doc",
        title: "Volkswagen Österreich: Aktuelle Informationen zum EA189 Dieselmotor",
        url: "https://www.volkswagen.at/service-zubehoer/ueber-dein-auto/rueckrufaktionen/diesel-info",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["EA189"] },
    note: "KBA kods 23R7: tikai juristu lapās, nav apstiprināts no OEM/KBA.",
    addedAt: "2026-10-17",
  },
  {
    id: "vag_dq200_no_oil_interval",
    unitKind: "gearbox",
    codes: ["DQ200", "0AM", "0CW"],
    topic: "service_interval",
    statementLv:
      "VW DQ200 (0AM/0CW, 7 pak. sausā DSG) rūpnīcas plānā kārbas eļļas maiņa nav paredzēta; zobratu eļļa un mehatronikas eļļa ir atsevišķas.",
    status: "verified",
    sources: [
      {
        kind: "specialist",
        title: "TPS (VW Group UK): DQ200 0CW, no service interval",
        url: "https://tps.trade/insider/dsg-servicing/",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "VWG Specialists: DQ200, no scheduled change",
        url: "https://vwgspecialist.com/services/dsg-gearbox-oil-changes/",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["DQ200", "\\b0AM\\b", "\\b0CW\\b"] },
    contradictions: [
      {
        subject: ["DQ200", "\\b0AM\\b", "\\b0CW\\b"],
        contradicts: ["(eļļ\\w*\\s+maiņ\\w*|maina)[^.]{0,40}ik\\s"],
        unless: ["nav\\s+paredz", "ieteicam", "neobligāt"],
        level: "W",
        message: "DQ200 rūpnīcas plānā kārbas eļļas maiņas intervāla nav.",
      },
    ],
    addedAt: "2026-10-17",
  },
  {
    id: "vag_dq250_service_interval",
    unitKind: "gearbox",
    codes: ["DQ250", "02E", "0D9"],
    topic: "service_interval",
    statementLv: "VW DQ250 (02E/0D9, 6 pak. mitrā DSG): eļļas (G 052 182 A2) un filtra maiņa ik 60 000 km.",
    status: "verified",
    sources: [
      {
        kind: "specialist",
        title: "TPS (VW Group UK): DQ250 0D9, 64 374 km fluid and filter",
        url: "https://tps.trade/insider/dsg-servicing/",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "AZ-Teile: DQ250 alle 60.000 km mit Filter",
        url: "https://www.az-teile.de/dsg-oelwechsel-dq200-dq250-dq381-dq500/",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["DQ250", "\\b02E\\b", "\\b0D9\\b"] },
    note: "Laika robeža (gadi) nav apstiprināta. ASV NHTSA 09V-333: DSG temperatūras sensora vadi (MY2009-2010).",
    addedAt: "2026-10-17",
  },
  {
    id: "ford_ecoblue20_wet_belt_interval",
    unitKind: "engine",
    codes: ["EcoBlue", "2.0 EcoBlue", "Panther"],
    topic: "service_interval",
    statementLv:
      "Ford 2.0 EcoBlue (Transit, Transit Custom, Tourneo): zobsiksna eļļā; Ford samazināja maiņas intervālu no 10 gadiem/240 000 km uz 6 gadiem vai 160 000 km (siksna, spriegotājs, vadrullīši) eļļas atšķaidīšanās dēļ.",
    status: "verified",
    sources: [
      {
        kind: "specialist",
        title: "Fleet News 13.08.2024: Ford revises timing belt service interval (Ford paziņojums)",
        url: "https://www.fleetnews.co.uk/news/ford-ecoblue-timing-belt-change",
        accessed: "2026-10-17",
      },
      {
        kind: "specialist",
        title: "Palmers Garage: Ford UK 6 years or 160 934 km",
        url: "https://palmersgarage.co.uk/2024/01/17/ford-2-0l-ecoblue-timing-wet-belt-replacement-revised-service-interval/",
        accessed: "2026-10-17",
      },
      {
        kind: "oem_doc",
        title: "Ford DE: Serviceintervall für Zahnriemen 2.0L EcoBlue (Transit/Tourneo)",
        url: "https://www.ford.de/hilfe/anleitungen/vehicle-models/transit/warum-hat-ford-das-serviceintervall-fuer-zahnriemen-bei-allen-transit-und-tourneo-fahrzeugen-mit-dem-2-0l-ecoblue-motor-geaendert",
        accessed: "2026-10-17",
      },
      {
        kind: "supplier",
        title: "Dayco (OE): EcoBlue BIO, diesel in oil, belt debris, oil pump strainer",
        url: "https://www.dayco.com/techhub/dayco-highlights-issues-with-ford-transit-2-0-litre-diesel-ecoblue-timing-belt-replacement/",
        accessed: "2026-10-17",
      },
    ],
    appliesTo: { anyOf: ["EcoBlue"], andAnyOf: ["Transit", "Tourneo"] },
    contradictions: [
      {
        subject: ["zobsiksn", "siksn"],
        contradicts: ["240[\\s\\u00a0]?000\\s*km", "240\\s*tūkst", "10\\s+gad"],
        unless: ["agrāk", "iepriekš", "samazin"],
        level: "W",
        message: "2.0 EcoBlue (Transit/Tourneo) zobsiksnas intervāls tagad ir 6 gadi vai 160 000 km.",
      },
    ],
    note: "Vieglajām (Focus/Kuga/Mondeo 2.0 EcoBlue) nav apstiprināts.",
    addedAt: "2026-10-17",
  },
];
