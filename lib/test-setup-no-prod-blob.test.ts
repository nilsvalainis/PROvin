import { describe, expect, it } from "vitest";

describe("testu vide bez produkcijas Blob", () => {
  it("BLOB_READ_WRITE_TOKEN nav pieejams testiem (ja nav apzināti atļauts)", () => {
    if (process.env.VITEST_ALLOW_PROD_BLOB === "1") return;
    expect(process.env.BLOB_READ_WRITE_TOKEN).toBeUndefined();
  });
});
