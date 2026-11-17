/** Kravas «Uz ▾» izvēlnes apakšējās darbības: auto aiziet no Loģistikas (Nils 17.11). */
export const CARGO_EXIT_KINDS = ["autoparks", "other_company"] as const;
export type CargoExitKind = (typeof CARGO_EXIT_KINDS)[number];

export const CARGO_EXIT_LV: Record<CargoExitKind, string> = {
  autoparks: "Uz Autoparku",
  other_company: "Dzēst (cita SIA)",
};

/** Apstiprinājuma teksts vienam vai vairākiem auto. */
export function cargoExitConfirmText(kind: CargoExitKind, titles: readonly string[]): string {
  const who = titles.length === 1 ? titles[0]! : `${titles.length} auto`;
  if (kind === "autoparks") return `Pārvietot ${who} uz Autoparku? Loģistikā auto aizies uz arhīvu.`;
  return `Dzēst ${who} no Loģistikas? Auto aizies uz arhīvu ar atzīmi "Cita SIA", to var atjaunot.`;
}

/** Paziņojums pēc darbības: cik izdevās, cik ne. */
export function cargoExitNotice(kind: CargoExitKind, done: number, failed: number): string {
  const what = kind === "autoparks" ? "pārvietoti uz Autoparku" : "pārvietoti uz arhīvu (Cita SIA)";
  if (done === 0) return kind === "autoparks" ? "Neizdevās pārvietot uz Autoparku." : "Neizdevās dzēst.";
  const base = done === 1 ? (kind === "autoparks" ? "Auto ir Autoparkā." : "Auto ir arhīvā (Cita SIA).") : `${done} auto ${what}.`;
  return failed ? `${base} ${failed} neizdevās, mēģini vēlreiz.` : base;
}
