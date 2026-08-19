/**
 * Servisa darba nosaukums (latviski, pēc `service-work-term-lv.ts` tulkojuma) → ikona
 * kompaktai PDF „SERVISA UN REMONTU VĒSTURE” tabulai (`lib/section-icons.ts`).
 *
 * Secība ir svarīga: pārbaudam specifiskāko kategoriju vispirms, lai „Eļļas filtra komplekts”
 * dabū filtra, ne eļļas piliena ikonu.
 */
import type { SectionIconId } from "@/lib/section-icons";

const ICON_RULES: { re: RegExp; icon: SectionIconId }[] = [
  { re: /filtr/i, icon: "filter" },
  { re: /bremž|bremzes/i, icon: "brakeDisc" },
  { re: /riep|riteņ|balansē/i, icon: "tire" },
  { re: /akumulators/i, icon: "battery" },
  { re: /dzesēšan|kondicionētāj|dzesētājvielu|dzesētājviela/i, icon: "coolant" },
  { re: /eļļ/i, icon: "oilDrop" },
  { re: /spuldze|lukturis/i, icon: "bulb" },
];

/** Ikona darba nosaukumam vai `null`, ja nav pazīstamas kategorijas (nekas neizdomāts). */
export function serviceWorkIconId(workLv: string): SectionIconId | null {
  const hit = ICON_RULES.find(({ re }) => re.test(workLv));
  return hit ? hit.icon : null;
}
