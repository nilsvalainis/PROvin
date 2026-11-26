/**
 * Latviešu skaitļa locījums: «1 īpašnieks», «21 īpašnieks», «2 īpašnieki», «11 īpašnieki».
 * Skaitļi ar pēdējo ciparu 1 (izņemot 11) prasa vienskaitli.
 */
export function lvIsSingularCount(n: number): boolean {
  const k = Math.abs(Math.trunc(n));
  return k % 10 === 1 && k % 100 !== 11;
}

export function lvCount(n: number, one: string, many: string): string {
  return `${n} ${lvIsSingularCount(n) ? one : many}`;
}
