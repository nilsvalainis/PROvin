/**
 * «Vārds, uzvārds» viens lauks → clientFirstName + clientLastName.
 * Rakstot nedrīkst nogriezt beigu atstarpi: «FABLE » jāpaliek, citādi nākamais burts
 * pielīp («FABLEDEMO»). Viena beigu atstarpe tiek glabāta pēdējā daļā līdz nākamajam burtam.
 */
export function splitIrissClientNameInput(value: string): { clientFirstName: string; clientLastName: string } {
  const collapsed = value.replace(/\s+/g, " ").replace(/^ /, "");
  if (!collapsed.trim()) return { clientFirstName: "", clientLastName: "" };
  const space = collapsed.indexOf(" ");
  if (space < 0) return { clientFirstName: collapsed, clientLastName: "" };
  const first = collapsed.slice(0, space);
  const rest = collapsed.slice(space + 1);
  if (!rest) return { clientFirstName: `${first} `, clientLastName: "" };
  return { clientFirstName: first, clientLastName: rest };
}

export function irissClientNameInputValue(rec: { clientFirstName: string; clientLastName: string }): string {
  return [rec.clientFirstName, rec.clientLastName].filter(Boolean).join(" ");
}
