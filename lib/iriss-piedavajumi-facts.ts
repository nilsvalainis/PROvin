/**
 * Nils 30.10: «NOVĒRTĒJUMS KLIENTAM - nav ielasīta informācija no izsoles līdz galam ... ir jāielasa krāsotie elementi».
 * No Auto1 blokiem aizpilda fakta rindas (tekstu ar skaitļiem un ķeksi). Tikai šablona rindas, kuras admins vēl nav
 * mainījis; paša pievienotās rindas paliek. Viss pārējais - kā līdz šim (admins pārbauda un var labot).
 */

import { IRISS_PD_REPAINT_UM, type IrissPdAuto1Blocks, type IrissPdKv } from "@/lib/iriss-piedavajumi-auto1";
import { IRISS_PD_FACTS_TEMPLATE, type IrissPdCheckItem } from "@/lib/iriss-piedavajumi-types";

const kv = (rows: readonly IrissPdKv[], label: string): string => rows.find((r) => r.label === label)?.value.trim() ?? "";
const isNo = (v: string) => /^(no|nein|nē|ne|none|-)$/i.test(v.trim());
const isYes = (v: string) => /^(yes|ja|jā|available|vorhanden|all|full)$/i.test(v.trim());

function monthYearInFuture(v: string, now: Date): boolean | null {
  const m = v.match(/(\d{1,2})\s*[/.]\s*(\d{4})/);
  if (!m) return null;
  const month = Number(m[1]);
  const year = Number(m[2]);
  if (!month || month > 12) return null;
  // Derīga līdz mēneša beigām.
  return new Date(Date.UTC(year, month, 1)).getTime() > now.getTime();
}

function plural(n: number, one: string, many: string): string {
  return n % 10 === 1 && n % 100 !== 11 ? one : many;
}

/** Krāsojuma rinda no mērījumiem: «Pārkrāsoti 3 elementi (līdz 420 µm)» / «Krāsojums oriģināls (mērījumi līdz 160 µm)». */
export function irissPdPaintFact(paint: IrissPdAuto1Blocks["paint"]): IrissPdCheckItem | null {
  if (!paint) return null;
  const all = [...paint.zones.flatMap((z) => z.readings), ...paint.unassigned];
  if (all.length === 0) return null;
  const max = Math.max(...all);
  const repainted = all.filter((n) => n >= IRISS_PD_REPAINT_UM).length;
  if (repainted === 0) return { text: `Krāsojums oriģināls (${all.length} mērījumi, līdz ${max} µm)`, on: true };
  return { text: `Pārkrāsoti ${repainted} ${plural(repainted, "elements", "elementi")} (līdz ${max} µm)`, on: true };
}

export function irissPdFactsFromAuto1(blocks: IrissPdAuto1Blocks | null, facts: readonly IrissPdCheckItem[], now = new Date()): IrissPdCheckItem[] {
  if (!blocks) return facts.map((f) => ({ ...f }));
  const tpl = new Map(IRISS_PD_FACTS_TEMPLATE.map((t) => [t.text, t]));
  const untouched = (f: IrissPdCheckItem) => tpl.has(f.text) && tpl.get(f.text)!.on === f.on;
  const keys = Number.parseInt(kv(blocks.tech, "Atslēgas"), 10);
  const book = kv(blocks.service, "Servisa grāmata");
  const ta = kv(blocks.tech, "TA līdz");
  const accident = kv(blocks.tech, "Iepriekšējie bojājumi / avārija (pēc iepr. īpašnieka)");
  const paint = irissPdPaintFact(blocks.paint);
  return facts.map((f) => {
    if (!untouched(f)) return { ...f };
    switch (f.text) {
      case "2 atslēgas":
        return Number.isFinite(keys) && keys > 0 ? { text: `${keys} ${plural(keys, "atslēga", "atslēgas")}`, on: true } : { ...f };
      case "Servisa grāmatiņa":
        return book ? { text: isYes(book) ? "Servisa grāmatiņa" : `Servisa grāmatiņa: ${book}`, on: isYes(book) } : { ...f };
      case "TA derīga": {
        const valid = ta ? monthYearInFuture(ta, now) : null;
        return valid == null ? { ...f } : { text: valid ? `TA derīga līdz ${ta}` : `TA beigusies (${ta})`, on: valid };
      }
      case "Nav avārijas vēstures":
        return accident ? { text: "Nav avārijas vēstures", on: isNo(accident) } : { ...f };
      case "Pārkrāsots (kosmētiski)":
        return paint ?? { ...f };
      default:
        return { ...f };
    }
  });
}
