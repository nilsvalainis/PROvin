/**
 * Atkopšanas momentuzņēmums — Artis Miļicins PROVIN SELECT (2026-05-21 PDF).
 * Servera melnraksta atjaunošanai (Artis Miļicins) vai `scripts/restore-consultation-artis.mjs`.
 */
import type {
  ConsultationDraftOrderEdits,
  ConsultationDraftState,
  ConsultationDraftWorkspaceBody,
} from "@/lib/admin-consultation-draft-types";
import { CONSULTATION_SLOT_COUNT, defaultConsultationWorkspace } from "@/lib/admin-consultation-draft-types";
import { createDefaultSourceBlocks, emptyCsddFields, emptyLtabBlock } from "@/lib/admin-source-blocks";
import { adminRichHtmlToPlainText, plainTextToMinimalRichHtml } from "@/lib/admin-rich-comment-html";
import { DEFAULT_PDF_VISIBILITY } from "@/lib/pdf-visibility";

export const RECOVERY_ARTIS_EMAIL = "milicins80@gmail.com";

const IETEIKUMI_PLAIN = `Virsbūves korozija (Rūsa): Lai gan Audi virsbūves ir cinkotas, 14 gadus vecam auto (pat braucot Latvijā tikai gadu) ir obligāti jāpārbauda tipiskās riska vietas. Īpaša uzmanība jāpievērš riteņu arkām, sliekšņu apakšējām malām (vietās, kur lido akmeņi no riteņiem) un bagāžnieka vāka malai ap numura zīmes apgaismojumu.

Divmasu spararata nolietojums (DSG kārbas otra puse): Šī ir šo automātisko kārbu dilstošā detaļa. Apskates laikā tai jāvelta īpaša uzmanība:

Kā pārbaudīt: Auto ir jāiedarbina (aukstais starts). Notupjoties pie auto šofera puses priekšējā riteņa, ir uzmanīgi jāklausās dzinēja skaņa tukšgaitā. Ja ir dzirdama specifiska, metāliska klaboņa, klaudzēšana vai nevienmērīgs ritms, kas pazūd, kad auto uzsilst vai tiek ielikts ātrumā – spararats ir savu laiku nodzīvojis un prasīs drīzu maiņu.

Haldex pilnpiedziņas sistēmas stāvoklis: Audi Q3 izmanto elektronisko Haldex sajūgu aizmugurējā tiltā. Ja iepriekšējais īpašnieks nav regulāri mainījis eļļu un tīrījis sistēmas sūkņa sietiņu, pilnpiedziņa var vienkārši nedarboties, padarot auto par parastu priekšpiedziņu.

Kā pārbaudīt: Testa brauciena laikā ir jāatrod vieta ar mīkstāku segumu (piemēram, grants vai zālājs). Veicot asāku uzsākšanu no vietas ar pagrieztiem riteņiem, ir jājūt, ka aizmugurējais tilts pieslēdzas acumirklī bez aiztures, sitieniem vai krakšķiem.

Piezīme: Par to, kur un kā tieši šīs lietas skatīties, kurā brīdī klausīties un kā pareizi "sajust" pilnpiedziņas darbību testa braucienā – es Jūs varu detalizēti pakonsultēt telefoniski tieši pirms pašas auto apskates.`;

const KOPSAVILKUMS_PLAIN = `Audi Q3 2.0 TDI S-Line (2012.g.)

Kopumā šis sludinājums un auto izpētes fons izskatās loģisks un uzmanības vērts. Zemāk ir strukturēti visi "par" un "pret", kas palīdzēs pieņemt gala lēmumu.

Plusi (Kāpēc šis auto ir laba izvēle):

Vienkārša un saprotama mehānika (VW Tiguan bāze): Konstruktīvi Audi Q3 ir uzbūvēts uz pārbaudītās PQ35 platformas. Tas nozīmē, ka ritošā daļa, dzinējs un pilnpiedziņa (4x4 Haldex sistēma, līdzīgi kā Volvo vai VW) ir maksimāli vienkārša, lēta remontos un jebkuram Latvijas servisam labi saprotama.

Latvijas ekspluatācijā (1–2 gadi): Tas, ka auto Latvijā ir aptuveni gadu, ir finansiāli izdevīgākais pirkums. Tikko ievestiem auto gandrīz vienmēr ir augstāka cena un uzreiz ir jāveic lielā apkope (zobsiksna, eļļas, bremzes, bieži arī dārgais divmasu spararats). Šajā gadījumā, ja iepriekšējais saimnieks to jau ir izdarījis (un ir saglabājušies rēķini), iespējams auto būs bez tūlītējiem ieguldījumiem. Tajā pašā laikā 1 gads ir pārāk mazs laiks, lai Latvijas sāls un ziemas paspētu sabojāt auto virsbūvi klimata īpatnību dēļ.

Caurspīdīga vēsture un nobraukums: CSDD datubāzē redzamais fiksētais ārvalstu nobraukums pirms reģistrācijas Latvijā dod augstu ticamību, ka odometra rādījums ir īsts. Tas šāda gada dīzeļiem ir liels retums.

2012. gada dzinēja un DPF konteksts: Šajā gadā nāca diezgan uzticams 2.0 TDI dzinējs ar 130 kW jaudu. Tas ir tehniski vienkāršāks un krietni mazāk cimperlīgs, salīdzinot ar jaunākiem Euro 6 dzinējiem pēc 2015. gada. Pie kam šis būs bez AdBlue sistēmas.

Laba komplektācija: Sludinājumā redzamais auto nav "pliks" – tam ir pilna S-Line pakotne, ādas Recaro salons ar apsildi, melnie griesti un augstākās klases Bang & Olufsen audio sistēma. Šādu auto nākotnē būs daudz vieglāk pārdot tālāk.

Mīnusi un riska faktori (Kam jāpievērš uzmanība):

DSG (S-Tronic) kārbas mezgli: Šim auto ir uzstādīta 7-pakāpju slapjā DSG ātrumkārba (DQ500). Tā ir strukturāli daudz izturīgāka un labāka nekā lielākā Audi Q5 kārba, tomēr ap šo nobraukumu ir jārēķinās ar divām lietām:

Divmasu spararats: Ja tas sāk klabēt (īpaši aukstam dzinējam), maiņa maksās ap 500–700 €.

Mehatroniks (vadības bloks): Ja kārba pārslēdzas ar grūdieniem vai "raustās" korķos, tas var liecināt par mehatronika nogurumu. Apskatot auto, jāpārliecinās, vai eļļa kārbā ir mainīta ik pēc 60 000 km.

Kompaktākas salona dimensijas: Q3 ir vizuāli un fiziski mazāks nekā Audi Q5 vai Volvo XC60. Bagāžnieka ietilpība un vieta aizmugurē sēdošajiem ir salīdzināma ar parastu VW Golf, tikai auto ir augstāks. Ja ir liela ģimene vai bieži jāved apjomīgas mantas, tas var šķist par šauru.

Rīcības ieteikums klientam klātienes apskatei:

Auto ir pelnījis klātienes diagnostiku. Svarīgākais uzdevums – palūgt iepriekšējā gada apkopes rēķinus Latvijā, lai pārliecinātos, kas tieši ir nomainīts (zobsiksna, kārbas eļļa, spararats). Klātienē veikt testa braucienu, lai pārliecinātos, ka kārba pārslēdzas pilnīgi plūdeni.

Noteikti jāskatās un rūpīgi jāmeklē arī rūsu, bet ņemot vērā visu, ko šobrīd izdevās noskaidrot, ir cerība, ka auto ir labs.`;

const CSDD_RAW = `Tehniskie dati
Pārbaudes veids:	Pamatpārbaude
Reģistrācijas statuss:	Uzskaitē
Marka, modelis:	AUDI Q3
Reģistrācijas numurs:	OB5377
Pirmās reģistrācijas datums:	14.11.2012
Emisiju standarts:	Euro 5 F
Nākamās apskates datums:	17.03.2027
Odometra rādījums:	220831
Novērtējums:	1 - Ar pieļaujamiem defektiem
CO2:	156
CO2 NEDC:	156
Dūmainības koeficients (m-1):	0.09
Degvielas veids:	Dīzeļdegviela
Motora maksimālā jauda (kW):	130
Motora tilpums (cm3):	1968
Pilna masa (kg):	2185
Pašmasa (kg):	1660

Detalizētais vērtējums
Kods	Novērtējums:	Trūkumi vai bojājumi
3.2.	1	Redzamību vai izturību būtiski neietekmējoši stiklojuma bojājumi.
4.1.1.	1	Labais galvenais lukturis viegli aizsvīdis.

Nobraukuma vēsture LV

Datums:	Odometrs	Nobraukums
17.03.2026	220831	21754
15.03.2025	199077	199077

Nobraukums ārvalstīs
Datums:	Nobraukums	Valsts
15.12.2023	183490 km	VĀCIJA
09.11.2021	149105 km	VĀCIJA
29.11.2019	106550 km	VĀCIJA
17.11.2017	65113 km	VĀCIJA`;

const IRISS_PLAIN = `Uz šo brīdi neatrodu nevienu ievērības cienīgu un budžetā atbilstošu VW T-ROC/Škoda Karoq/Seat Ateca ar pilnpiedziņu un automātisko ātrumkārbu.`;

/** Virsraksti treknrakstā admin / PDF. */
function richWithBoldHeadings(plain: string): string {
  const lines = plain.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  const boldRe =
    /^(Virsbūves korozija|Divmasu spararats|Haldex pilnpiedziņas|Kā pārbaudīt:|Piezīme:|Audi Q3 2\.0|Plusi \(|Mīnusi un riska|Rīcības ieteikums|DSG \(S-Tronic\)|Divmasu spararats:|Mehatroniks|Kompaktākas salona)/;
  for (const line of lines) {
    const t = line.trimEnd();
    if (!t) {
      out.push("<br />");
      continue;
    }
    const esc = t
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    if (boldRe.test(t)) {
      out.push(`<strong>${esc}</strong>`);
    } else {
      out.push(esc);
    }
    out.push("<br />");
  }
  return out.join("").replace(/(<br \/>)+$/g, "");
}

export function buildArtisMilicinsRecoveryOrderEdits(): ConsultationDraftOrderEdits {
  return {
    customerName: "Artis Miļicins",
    customerEmail: RECOVERY_ARTIS_EMAIL,
    customerPhone: "25135328",
    notes: "Sveiki, meklēju auto 4*4\nautomāts, dīzelis. Cenu kategorija 10000 - 14000 €",
  };
}

export function buildArtisMilicinsRecoveryWorkspace(): ConsultationDraftWorkspaceBody {
  const ws = defaultConsultationWorkspace();
  const blocks = createDefaultSourceBlocks();
  blocks.csdd = {
    ...emptyCsddFields(),
    makeModel: "AUDI Q3",
    registrationNumber: "OB5377",
    firstRegistration: "2012-11-14",
    nextInspectionDate: "2027-03-17",
    prevInspectionDate: "2026-03-17",
    engineDisplacementCm3: "1968",
    enginePowerKw: "130",
    fuelType: "Dīzeļdegviela",
    emissionStandard: "Euro 5 F",
    grossMassKg: "2185",
    curbMassKg: "1660",
    registrationStatus: "Uzskaitē",
    opacityCoefficient: "0.09",
    particulateMatter: "",
    rawUnprocessedData: CSDD_RAW,
    mileageHistory: [
      { date: "17.03.2026", odometer: "220831", country: "Latvija" },
      { date: "15.03.2025", odometer: "199077", country: "Latvija" },
      { date: "15.12.2023", odometer: "183490", country: "VĀCIJA" },
      { date: "09.11.2021", odometer: "149105", country: "VĀCIJA" },
      { date: "29.11.2019", odometer: "106550", country: "VĀCIJA" },
      { date: "17.11.2017", odometer: "65113", country: "VĀCIJA" },
    ],
    comments: "",
    pdfChecklist: {
      incidents: false,
      mileageHistory: true,
      mileageLine: true,
    },
  };
  blocks.ltab = emptyLtabBlock();

  ws.slots[0] = {
    listingUrl: "https://www.ss.lv/msg/lv/transport/cars/audi/q3/cbbcjp.html",
    salePrice: "11000",
    sourceBlocks: blocks,
    ieteikumiApskatei: richWithBoldHeadings(IETEIKUMI_PLAIN),
    cenasAtbilstiba: "",
    kopsavilkums: richWithBoldHeadings(KOPSAVILKUMS_PLAIN),
    photos: [],
  };

  for (let i = 1; i < CONSULTATION_SLOT_COUNT; i++) {
    ws.slots[i] = {
      listingUrl: "",
      salePrice: "",
      sourceBlocks: createDefaultSourceBlocks(),
      ieteikumiApskatei: "",
      cenasAtbilstiba: "",
      kopsavilkums: "",
      photos: [],
    };
  }

  ws.irissApproved = plainTextToMinimalRichHtml(IRISS_PLAIN);
  ws.previewConfirmed = true;
  ws.pdfVisibility = { ...DEFAULT_PDF_VISIBILITY };
  return ws;
}

/** Ja Nr.1 saturs pazudis — atkopšana no PDF momentuzņēmuma. */
export function artisMilicinsRecoveryShouldApply(
  workspace: ConsultationDraftWorkspaceBody | null | undefined,
): boolean {
  if (!workspace?.slots?.[0]) return true;
  const s0 = workspace.slots[0];
  const hasListing = s0.listingUrl.includes("cbcjp");
  const hasSummary = adminRichHtmlToPlainText(s0.kopsavilkums).includes("Audi Q3");
  return !(hasListing && hasSummary);
}

export function buildArtisMilicinsConsultationDraft(sessionId: string): ConsultationDraftState {
  return {
    sessionId,
    orderEdits: buildArtisMilicinsRecoveryOrderEdits(),
    workspace: buildArtisMilicinsRecoveryWorkspace(),
    updatedAt: new Date().toISOString(),
  };
}
