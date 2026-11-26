/**
 * Papildu ražotāju atsaukumu «Atvērt pārlūkā» saites (26.11): Kia, Škoda, Audi, SEAT, Stellantis, Ford.
 * Tikai saites tai markai, ko rāda WMI; serveris šīs lapas nelasa (formas ar JS / bot aizsardzību,
 * noteikumi paredz personīgu lietošanu). Tīra loģika (klients + serveris).
 */

export type OemRecallLinkBrand = "kia" | "skoda" | "audi" | "seat" | "stellantis" | "ford";

const OEM_LINK_WMI: Record<OemRecallLinkBrand, readonly string[]> = {
  kia: ["KNA", "KNC", "KND", "KNE", "KNH", "KNJ", "U5Y", "U6Y", "5XX", "5XY", "3KP"],
  skoda: ["TMB"],
  audi: ["WAU", "WUA", "WA1", "TRU"],
  seat: ["VSS"],
  stellantis: [
    // Peugeot, Citroën, DS
    "VF3", "VR3", "VF7", "VR7", "VR1",
    // Opel / Vauxhall
    "W0L", "W0V", "VXK", "VXE",
    // Fiat, Alfa Romeo, Lancia, Jeep (ES)
    "ZFA", "ZAR", "ZLA", "ZAC",
  ],
  ford: ["WF0", "WF1", "NM0", "MAJ", "1FA", "1FB", "1FC", "1FD", "1FM", "1FT", "2FA", "2FM", "2FT", "3FA", "3FM", "3FT"],
};

export function oemRecallLinkBrandForVin(vin: string): OemRecallLinkBrand | null {
  const wmi = vin.trim().toUpperCase().slice(0, 3);
  for (const brand of Object.keys(OEM_LINK_WMI) as OemRecallLinkBrand[]) {
    if (OEM_LINK_WMI[brand].includes(wmi)) return brand;
  }
  return null;
}

/**
 * VIN pievieno kā `?vin=` (tāpat kā pārējās VIN SCAN saites): lapas parametru ignorē vai aizpilda formu,
 * operators redz, kuram VIN saite atvērta.
 */
export function withVinParam(url: string, vin: string): string {
  const clean = vin.trim().toUpperCase();
  if (!clean) return url;
  return `${url}${url.includes("?") ? "&" : "?"}vin=${encodeURIComponent(clean)}`;
}

function wmiOf(vin: string): string {
  return vin.trim().toUpperCase().slice(0, 3);
}

/** Kia Europe atsaukumu pārbaude (VIN ievada lapā). */
export function kiaRecallCheckUrl(vin: string): string {
  return withVinParam("https://www.kia.com/eu/service/kia-overview/service-and-maintenance/kia-recalls.html", vin);
}

/** Škoda oficiālā atsaukumu kampaņu pārbaude Latvijas importētājam (VIN ievada lapā). */
export function skodaRecallCheckUrl(vin: string): string {
  return withVinParam("https://recall.skoda-auto.com/411/lv-lv", vin);
}

/** Audi UK: drošības spilvenu atsaukuma VIN pārbaude. Pārējie VW grupas atsaukumi - GOV.UK (recall_vw). */
export function audiRecallCheckUrl(vin: string): string {
  return withVinParam("https://www.audi.co.uk/en/assistance/airbag-safety-recall/", vin);
}

/** SEAT / Cupra UK: drošības spilvenu atsaukuma VIN pārbaude. */
export function seatRecallCheckUrl(vin: string): string {
  return withVinParam("https://www.seat.co.uk/owners/airbag-safety-recall", vin);
}

/** The Motor Ombudsman (UK): vairāku marku atsaukumu pārbaude pēc VIN. */
export const MOTOR_OMBUDSMAN_RECALLS_URL = "https://www.themotorombudsman.org/vehicle-recalls";

/**
 * Stellantis: Peugeot un Citroën/DS UK atsaukumu kampaņu VIN pārbaude; Opel/Vauxhall, Fiat, Alfa Romeo,
 * Lancia, Jeep - The Motor Ombudsman vairāku marku pārbaude. Stellantis rīku rezultāti nav vienmēr pilni.
 */
export function stellantisRecallCheckUrl(vin: string): string {
  const wmi = wmiOf(vin);
  if (wmi === "VF3" || wmi === "VR3") return withVinParam("https://www.peugeot.co.uk/tools/recall-campaigns.html", vin);
  if (wmi === "VF7" || wmi === "VR7" || wmi === "VR1") return withVinParam("https://www.citroen.co.uk/owners/Recall-campaigns.html", vin);
  return withVinParam(MOTOR_OMBUDSMAN_RECALLS_URL, vin);
}

/** Ford: ASV VIN - ford.com atsaukumu meklēšana; Eiropas VIN - Ford UK atsaukumu pārbaude. */
export function fordRecallCheckUrl(vin: string): string {
  const first = vin.trim().toUpperCase().charAt(0);
  if (first >= "1" && first <= "5") return withVinParam("https://www.ford.com/support/recalls/", vin);
  return withVinParam("https://www.ford.co.uk/owners/recalls", vin);
}

/** Kanādas policijas (RCMP) CPIC zagto auto meklēšana. Noteikumi jāapstiprina pašam katrā vaicājumā. */
export function cpicStolenVehicleUrl(vin: string): string {
  return withVinParam("https://www.cpic-cipc.ca/sve-rve-eng.htm", vin);
}

/** IBC VIN Verify (Kanādas apdrošinātāji): plūdi / ugunsgrēks / salvage. Noteikumi jāapstiprina pašam. */
export function ibcVinVerifyUrl(vin: string): string {
  return withVinParam("https://www.ibc.ca/industry-resources/insurance-data-tools/vin-verify", vin);
}
