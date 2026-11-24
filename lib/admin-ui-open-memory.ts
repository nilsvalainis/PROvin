/**
 * Atvērtais / sakļautais UI stāvoklis, kamēr lapa atvērta (Nils 24.11: pēc FLASH MAX, «Saglabāt»
 * vai vedņa soļa maiņas avotu bloki un pogas sakļāvās, jo komponente tika uzstādīta no jauna).
 * Glabā atmiņā (ne localStorage): jauna lapas ielāde = noklusējums (23.11 telefona likums).
 */
const memory = new Map<string, boolean>();

export function adminUiOpenKey(sessionId: string, id: string): string {
  return `${sessionId}::${id}`;
}

export function readAdminUiOpen(key: string): boolean | undefined {
  return memory.get(key);
}

export function writeAdminUiOpen(key: string, value: boolean): void {
  memory.set(key, value);
}

export function clearAdminUiOpenMemoryForTests(): void {
  memory.clear();
}
