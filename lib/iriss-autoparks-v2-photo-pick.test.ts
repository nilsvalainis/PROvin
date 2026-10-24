import { describe, expect, it } from "vitest";
import { pickStockMainPhoto } from "@/lib/iriss-autoparks-v2-photo-pick";

const f = (id: string, name: string) => ({ id, name });

describe("pickStockMainPhoto (J29 A)", () => {
  it("bez semantiska nosaukuma (telefona kadri) - pirmā pēc nosaukuma, kā iepriekš", () => {
    expect(pickStockMainPhoto([f("3", "IMG_10.jpg"), f("1", "IMG_1.jpg"), f("2", "IMG_2.jpg")])?.id).toBe("1");
    expect(pickStockMainPhoto([f("1", "01.jpg"), f("2", "02.jpg")])?.id).toBe("1");
  });

  it("izlaiž interjeru, motoru, dokumentus, VIN/numuru un aizmuguri, ja ir labāks kandidāts", () => {
    const files = [f("a", "00_interior.jpg"), f("b", "01_dashboard.jpg"), f("c", "02_front.jpg"), f("d", "03_rear.jpg"), f("e", "04_engine.jpg")];
    expect(pickStockMainPhoto(files)?.id).toBe("c");
  });

  it("izlaiž VIN uzlīmes un dokumentu foto, kas alfabētiski ir pirmie", () => {
    const files = [f("a", "00_vin_plate.jpg"), f("b", "00_dokumenti.jpg"), f("c", "05.jpg")];
    expect(pickStockMainPhoto(files)?.id).toBe("c");
  });

  it("ja VISI nosaukumi liecina par neatbilstošu kadru - krīt atpakaļ uz pirmo (nekad null, kamēr ir bilde)", () => {
    const files = [f("a", "interior.jpg"), f("b", "engine.jpg")];
    expect(pickStockMainPhoto(files)?.id).toBe("b");
  });

  it("tukšs sarakts -> null; bez id izmet", () => {
    expect(pickStockMainPhoto([])).toBeNull();
    expect(pickStockMainPhoto([{ id: "", name: "a.jpg" }])).toBeNull();
  });
});
