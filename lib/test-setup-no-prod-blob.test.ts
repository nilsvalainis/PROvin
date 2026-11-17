import { describe, expect, it } from "vitest";

describe("testu vide bez produkcijas Blob", () => {
  it("BLOB_READ_WRITE_TOKEN nav pieejams testiem (ja nav apzināti atļauts)", () => {
    if (process.env.VITEST_ALLOW_PROD_BLOB === "1") return;
    expect(process.env.BLOB_READ_WRITE_TOKEN).toBeUndefined();
  });
});

describe("testu vide bez citām prod blakusefektu atslēgām", () => {
  it("Redis, pasta un maksājumu atslēgas nav pieejamas testiem", () => {
    for (const key of ["UPSTASH_REDIS_REST_TOKEN", "SMTP_PASS", "STRIPE_SECRET_KEY", "KV_REST_API_TOKEN"]) {
      expect(process.env[key], key).toBeUndefined();
    }
  });
});
