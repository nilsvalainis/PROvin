import { describe, expect, it } from "vitest";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { IRISS_EMPTY_NEW_ORDER_MSG, irissPasutijumsHasOperatorContent } from "@/lib/iriss-pasutijumi-save-safety";

/** FABLE v3 F6: tukša jauna pasūtījuma «Saglabāt» rādīja «Kļūda 400 - empty_record - {…}» + sarkanu «Mēģināt vēlreiz». */
describe("tukšs jauns IRISS pasūtījums", () => {
  it("nav operatora satura - klients nesūta POST", () => {
    expect(irissPasutijumsHasOperatorContent(emptyIrissPasutijums("x", "2026-10-26T10:00:00.000Z"))).toBe(false);
  });
  it("ziņa ir cilvēcīga un neieslēdz kļūdas stāvokli (useSaveMessageState /neizdev|kļūd/)", () => {
    expect(IRISS_EMPTY_NEW_ORDER_MSG).not.toMatch(/neizdev|kļūd|empty_record|\{/i);
  });
});
