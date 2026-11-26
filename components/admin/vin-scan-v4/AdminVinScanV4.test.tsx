import { describe, expect, it } from "vitest";

import { AdminVinScanV4, type VinScanV4Row, type VinScanV4SmartId } from "@/components/admin/vin-scan-v4/AdminVinScanV4";
import { VinScanV4CsddSms, VinScanV4PaidRow, VinScanV4PaidServices } from "@/components/admin/vin-scan-v4/VinScanV4Paid";
import { vinScanV4PaidServices } from "@/lib/vin-scan/v4-paid-services";
import { renderHtml, renderText } from "@/lib/test-render";
import { emptyCsddTechData } from "@/lib/csdd-tech-data";
import { LTAB_SKIP_REASON_LV } from "@/lib/ltab-query-target";
import { ECSDD_RAW_LONG_HISTORY } from "@/lib/vin-scan/__fixtures__/ecsdd-smartid-2026-11-26";

const VIN = "WAUZZZF2XKN104417";
const row = (p: Partial<VinScanV4Row> & { id: string }): VinScanV4Row => ({ label: p.id, country: "", status: "found", summary: "", ...p });

const ROWS: VinScanV4Row[] = [
  row({ id: "eu_safety_gate", label: "ES Safety Gate", summary: "dzesēšanas sūknis", recalls: [{ title: "Dzesēšanas sūknis", date: "2022-12-01" }] }),
  row({ id: "thecarapi_eu", label: "EU izsoles (TheCarApi)", summary: "14.03.2024 · 151 800 km" }),
  row({ id: "carinfo", label: "car.info", summary: "SE · 2 īpašnieki", mileage: [{ date: "2023-10-11", odometer: "146 300 km", source: "car.info" }] }),
  row({ id: "autodna_precheck", label: "AutoDNA (priekšskatījums)", summary: "16 ieraksti" }),
  row({ id: "vin_decode", label: "WMI", summary: "AUDI AG" }),
  row({ id: "mnt_ee", label: "mnt.ee", status: "none" }),
  row({ id: "dsb", label: "Digital Servicebook", status: "unknown", summary: "kļūda 503" }),
  row({ id: "stat_vin", label: "stat.vin", status: "idle", openUrl: "https://stat.vin/cars/" + VIN }),
];

const SMART: VinScanV4SmartId = {
  ecsdd: { state: "awaiting_smartid", verificationCode: "4821", updatedAt: "2026-11-26T08:41:00Z" },
  ltab: { state: "no_claims", updatedAt: "2026-11-26T08:42:00Z" },
  ecsddConfigured: true,
  ltabConfigured: true,
  sessionCode: "",
  starting: false,
  hasPlate: true,
};

describe("AdminVinScanV4", () => {
  it("bloki Nila secībā: Galvenā informācija -> CSDD -> LTAB -> izsoles -> ārvalstu -> maksas -> priekšskati -> citi -> atsaukumi -> tukšie", () => {
    const html = renderHtml(
      <AdminVinScanV4
        vin={VIN}
        rows={ROWS}
        busy={false}
        scannedAt="2026-11-26T08:41:00Z"
        smartId={SMART}
        smsStep={<VinScanV4CsddSms vin={VIN} plate="NK7310" />}
        paidServices={<VinScanV4PaidServices services={vinScanV4PaidServices(VIN)} />}
      />,
    );
    const order = ["galvena", "csdd", "ltab", "izsoles", "arvalstu", "maksas", "prieksskati", "citi", "atsaukumi", "tuksi"].map((id) =>
      html.indexOf(`data-v4-block="${id}"`),
    );
    for (const i of order) expect(i).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("e.csdd gaidot rāda Smart-ID kontrolkodu; LTAB rezultāts; SMS izziņa ar summu; statusā tikai-saites neskaitās", () => {
    const text = renderText(
      <AdminVinScanV4
        vin={VIN}
        rows={ROWS}
        busy={false}
        scannedAt="2026-11-26T08:41:00Z"
        smartId={SMART}
        smsStep={<VinScanV4CsddSms vin={VIN} plate="NK7310" />}
      />,
    );
    expect(text).toContain("4821");
    expect(text).toContain("Apstiprini Smart-ID telefonā");
    expect(text).toContain("Negadījumi nav reģistrēti");
    expect(text).toContain("1,50 €");
    // 7 skaitītas (stat.vin ir saite), 5 ar datiem.
    expect(text).toContain("Ar datiem 5 no 7");
    expect(text).toContain("Tukši 1");
    expect(text).toContain("kļūdas 1");
  });

  it("datu trūkums sarkanā krāsā pēc skenēšanas, «lasa…» skenēšanas laikā", () => {
    const done = renderHtml(<AdminVinScanV4 vin={VIN} rows={[row({ id: "vin_decode", summary: "AUDI" })]} busy={false} scannedAt="" />);
    expect(done).toMatch(/text-\[#b3261e\][^>]*>Nav datu/);
    const busy = renderText(<AdminVinScanV4 vin={VIN} rows={[row({ id: "mnt_ee", status: "checking" })]} busy scannedAt="" />);
    expect(busy).toContain("lasa…");
    expect(busy).toContain("Lasa 0 no 1");
  });

  it("bez Smart-ID (darbinieks) e.csdd un LTAB nav", () => {
    const html = renderHtml(<AdminVinScanV4 vin={VIN} rows={ROWS} busy={false} scannedAt="" smartId={null} />);
    expect(html).not.toContain('data-v4-block="ltab"');
    expect(html).not.toContain('data-v4-step="ecsdd"');
  });
});

describe("VinScanV4PaidRow - maksas tikai pēc apstiprinājuma ar summu", () => {
  const noop = () => undefined;
  it("sākumā tikai cena un poga; apstiprinājumā - summa uz pogas", () => {
    const idle = renderText(
      <VinScanV4PaidRow id="cv" label="carVertical" description="x" price="1 kredīts" state="idle" onAsk={noop} onCancel={noop} onConfirm={noop} />,
    );
    expect(idle).toContain("1 kredīts");
    expect(idle).not.toContain("Apstiprināt");
    const ask = renderText(
      <VinScanV4PaidRow id="cv" label="carVertical" description="x" price="1 kredīts" state="ask" onAsk={noop} onCancel={noop} onConfirm={noop} />,
    );
    expect(ask).toContain("Ielasīt carVertical par 1 kredīts");
    expect(ask).toContain("Apstiprināt 1 kredīts");
    expect(ask).toContain("Atcelt");
  });
});

describe("AdminVinScanV4 - saliktais saraksts", () => {
  it("26.11 S 320 CDI: kļūdas skaita tikai īstās; Austrijas auto - sarkana rinda redzama arī aizvērtā sarakstā", () => {
    const rows: VinScanV4Row[] = [
      row({ id: "vin_decode", label: "WMI", summary: "Mercedes-Benz" }),
      row({ id: "nhtsa_recalls", label: "NHTSA atsaukumi", status: "browser_only", summary: "ASV tirgus, var neattiekties" }),
      row({
        id: "eu_safety_gate",
        label: "ES Safety Gate",
        status: "unknown",
        summary: "ES Safety Gate: Mercedes-Benz nav starp 100 jaunākajiem no 174 rezultātiem, pārbaudi saitē",
      }),
      row({
        id: "carfax_eu",
        label: "CARFAX.eu",
        status: "browser_only",
        summary: "CARFAX.eu: no pārlūka (from browser) · relejs: CARFAX.eu: pēc reCAPTCHA atteikuma pauze līdz 21:09 - pārbaudi pārlūka joslā",
      }),
      row({ id: "kfz_at", label: "Austrija · §57a apskates (kfzgutachten.at)", status: "needs_input", summary: "kfzgutachten.at: vajag precīzu datumu" }),
    ];
    const text = renderText(
      <AdminVinScanV4 vin={VIN} rows={rows} busy={false} scannedAt="2026-11-26T17:57:00Z" kfz={{ previousCountry: "AUSTRIJA", orderId: "cs_live_test123" }} />,
    );
    expect(text).toContain("kļūdas 1");
    expect(text).toContain("Austrija · §57a apskates: nav pārbaudīts (CSDD iepriekšējā valsts Austrija)");
    const html = renderHtml(<AdminVinScanV4 vin={VIN} rows={rows} busy={false} scannedAt="2026-11-26T17:57:00Z" />);
    expect(html).not.toContain("data-v4-kfz-alert");
    expect(html).toMatch(/kļūdas (?:<!-- -->)?1</);
  });

  it("26.11: e.csdd ielasīts -> nobraukums, TA defekti, CSNg kopsavilkumā; LTAB «nav reģistrēts Latvijā» pretrunā ar CSDD netiek rādīts", () => {
    const smart: VinScanV4SmartId = {
      ...SMART,
      ecsdd: { state: "found", rawText: ECSDD_RAW_LONG_HISTORY, updatedAt: "2026-11-26T19:25:16Z", checkedAt: "2026-11-26T19:25:16Z" },
      ltab: { state: "skipped", message: LTAB_SKIP_REASON_LV.not_registered_lv, updatedAt: "2026-11-26T19:25:11Z" },
    };
    const csdd = { ...emptyCsddTechData(), registrationNumber: "CD5678", vin: VIN, make: "BMW", model: "X5", inspectionValidUntilIso: "2027-02-24" };
    // busy=true: lēnais pieprasījums vēl vaļā, bet visi avoti jau atbildējuši -> nekāda «lasa…».
    const text = renderText(<AdminVinScanV4 vin={VIN} rows={[row({ id: "mnt_ee", label: "mnt.ee", status: "none" })]} busy scannedAt="2026-11-26T19:25:00Z" csdd={csdd} smartId={smart} />);
    expect(text).not.toContain("lasa…");
    expect(text).toContain("489 009");
    expect(text).toContain("24.02.2026 · e.csdd");
    expect(text).toContain("23 ieraksti");
    expect(text).toContain("Visi 23 rādījumi");
    expect(text).not.toContain("- km");
    expect(text).toContain("Nav reģistrēti");
    expect(text).toContain("e.csdd CSNg");
    expect(text).toContain("2 defekti");
    expect(text).toContain("TA defekts (1): Virspusēja rāmja vai nesošā elementa korozija.");
    expect(text).not.toContain(LTAB_SKIP_REASON_LV.not_registered_lv);
    expect(text).toContain("CSDD: reģistrēts Latvijā (CD5678)");
  });

  it("26.11: nav nobraukuma datu un skenēšana beigusies -> sarkans «nav datu», nekad «- km»", () => {
    const text = renderText(<AdminVinScanV4 vin={VIN} rows={[row({ id: "mnt_ee", label: "mnt.ee", status: "none" })]} busy={false} scannedAt="2026-11-26T19:25:00Z" />);
    expect(text).toContain("nav datu");
    expect(text).not.toContain("- km");
  });
});
