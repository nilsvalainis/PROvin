/**
 * Volvo XC90 RAW oficiālā dīlera žurnāls (VIN YV1LCA4BCG1067242).
 * Jaukts EN/DE, saplēsti umlauti (`?`), TJ/Symptom/Diagnose/Aktion, CAPS detaļas ar numuriem.
 * Tikai testi; pasūtījumus nemaina.
 */
export const VOLVO_XC90_VIN = "YV1LCA4BCG1067242";

export const VOLVO_XC90_HEADER = "Transmission MANUAL";

export const VOLVO_XC90_QB_COOLING =
  "Connector park acc. To QB S29975. TJ:kein Symptom:offene QB S29975. Diagnose:QB ist f?llig. Aktion:QB durchgef?hrt. SERVICE KIT (32252963) Cooling system modifying acc. QB R29945.";

export const VOLVO_XC90_QB_FUEL_LINE =
  "SET (32139148) Fuel line replace acc. To: QB-29904. TJ:kein Symptom:offene QB. Diagnose:QB. Aktion:Arbeiten nach QB durchgef?hrt.";

export const VOLVO_XC90_QB_BLEED_AND_CHARGE_AIR_HOSE =
  "BLEEDER HOSE (32252211) Bleed hose cooling system replace acc. To QB S 29846. CHARGE AIR HOSE (32222271) Inlet hose charge air cooler replace. Symptom: Redurierte Motorleistung. Diagnose:Ladeluftschlauch defekt. Aktion:Ladeluftschlauch ersetzt.";

export const VOLVO_XC90_WARRANTY_SEAL_TIMING_BELT =
  "Diagnose: Kurbelwellensimmerring undicht, Zahnriemen. Ver?lt Aktion: Kurbelwellendichtung und Zahnriemen erneuert. Garantiearbeiten. Aktion:Ersatzwagen. SEALING RING (30735126) Sealing ring right drive shaft front rep. Symptom:?lleckage an der rechten Antriebswelle. COVER (31375715) Crankshaft seal front replace. Motor?lleckage an der Kurbelwelle.";

export const VOLVO_XC90_SOFTWARE_DOWNLOAD = "Software control module downloading";

export const VOLVO_XC90_TOTAL_UPGRADE = "TOTAL UPGRADE (31483292)";

export const VOLVO_XC90_VCM_UPGRADE = "VCM/CMQ UPGRADE";

export const VOLVO_XC90_SUNROOF_DEFLECTOR = "Wind deflector sun roof replace";

export const VOLVO_XC90_SUNROOF_MECHANISM =
  "FRAME (31484960) Mechanism sun roof replace. Dachkasette und Motoren erneuert.";

export const VOLVO_XC90_UPHOLSTERY = "UPHOLSTERY (39824637) Sitzkissenbezug erneuert";

export const VOLVO_XC90_CLIMATE_DRAIN_NO_FAULT =
  "Drain hose climate unit check. Diagnose: Ohne Befund. Aktion:Ohne Befund.";

export const VOLVO_XC90_TJ_BOILERPLATE = "TJ:kein Symptom:offene QB. TJ:kein Symptom:offene QB.";

export const VOLVO_XC90_RAW_ROWS: readonly {
  date: string;
  odometer: string;
  works: string;
}[] = [
  { date: "16.12.2019", odometer: "76061", works: VOLVO_XC90_QB_COOLING },
  { date: "11.02.2019", odometer: "59282", works: VOLVO_XC90_QB_FUEL_LINE },
  { date: "11.10.2018", odometer: "50159", works: VOLVO_XC90_QB_BLEED_AND_CHARGE_AIR_HOSE },
  { date: "20.02.2018", odometer: "38059", works: VOLVO_XC90_WARRANTY_SEAL_TIMING_BELT },
  { date: "15.01.2018", odometer: "35000", works: VOLVO_XC90_SOFTWARE_DOWNLOAD },
  { date: "10.01.2018", odometer: "34000", works: VOLVO_XC90_TOTAL_UPGRADE },
  { date: "05.01.2018", odometer: "33000", works: VOLVO_XC90_VCM_UPGRADE },
  { date: "29.11.2017", odometer: "28000", works: VOLVO_XC90_SUNROOF_DEFLECTOR },
  { date: "29.08.2016", odometer: "18000", works: VOLVO_XC90_SUNROOF_MECHANISM },
  { date: "12.06.2016", odometer: "15000", works: VOLVO_XC90_UPHOLSTERY },
  { date: "01.03.2016", odometer: "12000", works: VOLVO_XC90_CLIMATE_DRAIN_NO_FAULT },
];
