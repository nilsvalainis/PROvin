/**
 * Vitest: testi NEKAD neraksta produkcijas Vercel Blob krātuvē.
 * 07.11 atrasti 206 testa darbinieki (@example.lv) produkcijā - lib/staff-store.test.ts
 * tika palaists vidē ar īstu BLOB_READ_WRITE_TOKEN. Testi, kam vajag tokenu, to iestata paši (viltotu).
 * Apzināta izņēmuma gadījumā: VITEST_ALLOW_PROD_BLOB=1.
 */
if (process.env.VITEST_ALLOW_PROD_BLOB !== "1") {
  delete process.env.BLOB_READ_WRITE_TOKEN;
  // Ja kods redz Vercel vidi, JSON krātuves raksta /tmp, nevis repo .data - abos gadījumos ne produkcijā.
}
export {};
