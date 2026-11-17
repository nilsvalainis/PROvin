import { describe, expect, it } from "vitest";
import { cargoExitConfirmText, cargoExitNotice } from "@/lib/iriss-logistics-cargo-exit";

describe("Kravas «Uz ▾» -> Autoparks / Cita SIA", () => {
  it("apstiprinājumā nosauc auto vai skaitu", () => {
    expect(cargoExitConfirmText("autoparks", ["Audi A4"])).toBe("Pārvietot Audi A4 uz Autoparku? Loģistikā auto aizies uz arhīvu.");
    expect(cargoExitConfirmText("other_company", ["A", "B", "C"])).toContain("Dzēst 3 auto no Loģistikas?");
    expect(cargoExitConfirmText("other_company", ["A"])).toContain('"Cita SIA"');
  });

  it("paziņojums saka, cik izdevās un cik ne", () => {
    expect(cargoExitNotice("autoparks", 1, 0)).toBe("Auto ir Autoparkā.");
    expect(cargoExitNotice("autoparks", 3, 0)).toBe("3 auto pārvietoti uz Autoparku.");
    expect(cargoExitNotice("other_company", 2, 1)).toBe("2 auto pārvietoti uz arhīvu (Cita SIA). 1 neizdevās, mēģini vēlreiz.");
    expect(cargoExitNotice("autoparks", 0, 2)).toBe("Neizdevās pārvietot uz Autoparku.");
  });
});
