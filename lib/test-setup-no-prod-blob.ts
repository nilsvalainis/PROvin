/**
 * Vitest: testi NEKAD neraksta produkcijas Vercel Blob krātuvē.
 * 07.11 atrasti 206 testa darbinieki (@example.lv) produkcijā - lib/staff-store.test.ts
 * tika palaists vidē ar īstu BLOB_READ_WRITE_TOKEN. Testi, kam vajag tokenu, to iestata paši (viltotu).
 * Apzināta izņēmuma gadījumā: VITEST_ALLOW_PROD_BLOB=1.
 */
if (process.env.VITEST_ALLOW_PROD_BLOB !== "1") {
  delete process.env.BLOB_READ_WRITE_TOKEN;
  // Tas pats citām prod blakusefektu atslēgām (Redis, pasts, maksājumi) - testi iestata viltotas paši.
  for (const key of [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "KV_URL",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
    "RESEND_API_KEY",
    "STRIPE_SECRET_KEY",
  ]) {
    delete process.env[key];
  }
  // Ja kods redz Vercel vidi, JSON krātuves raksta /tmp, nevis repo .data - abos gadījumos ne produkcijā.
}

const thecarapiOriginalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : typeof Request !== "undefined" && input instanceof Request
          ? input.url
          : String(input);
  if (url.includes("api.thecarapi.com")) {
    throw new Error("thecarapi_network_forbidden_in_tests");
  }
  return thecarapiOriginalFetch(input, init);
}) as typeof fetch;

export {};
