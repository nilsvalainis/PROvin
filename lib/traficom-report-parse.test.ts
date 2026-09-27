import { describe, expect, it } from "vitest";
import {
  applyTraficomReportToBlock,
  looksLikeTraficomReport,
  parseTraficomReport,
} from "@/lib/traficom-report-parse";
import { emptyVinRegistryBlock } from "@/lib/admin-source-blocks";

const SAMPLE = `Vehicle information
Source: Transport Register
26.09.2026 22:27
Page 1/6

The vehicle is under a prohibition of driving or use.

Vehicle identification number (VIN)
WVGZZZE2ZNP009103

Vehicle status
Decommissioned

Next inspection period
8.11.2021–10.11.2025

Tax status
No unpaid vehicle tax
No unpaid additional tax

Restrictions
Periodic inspection not performed/approved
Vehicle decommissioning (Deregistrated due to a damage)

Pending data
There is a notification of transfer entry for the vehicle

Basic information
Make
Volkswagen, VW
Commercial name
ID.4 GTX 220 KW
Vehicle category
M1 / Car
Registration number
XPS-379
Date of entry into service
8.11.2021
First registration in Finland
8.11.2021

Notification of transfer information
Date of transfer
14.8.2025
Type of transfer
Notification of transfer

Owners and holders
Owner(s)
Starting from
17.1.2025
Owner(s)
Euro Insurances Designated Activity Company

Owner history
Period
Name
Ownership Type
8.11.2021-1.11.2024 Drivalia Lease Finland Oy First owner
1.11.2024-25.11.2024 Klaravik Finland Oy First operator
25.11.2024-5.12.2024 Anttila Mika Jaakko Juhana Other operator
5.12.2024-17.1.2025 Metso Finland Oy First owner

Engine details
Driving power
Electricity

Insurance history
Company
Start date
End date
IF 1.1.2025 12.12.2024
Euro Insurances 8.11.2021 31.12.2024

Finnish Transport and Communications Agency
PO Box 320, 00059 TRAFICOM • www.traficom.fi • Business ID 2924753-3

Use history
Use
Start date
Private 3.12.2024
Sales storage 5.11.2024
Private 8.11.2021

Decommissioning history
Reason for decommissioning
Time period
Deregistrated due to a damage 12.12.2024-
`;

describe("looksLikeTraficomReport", () => {
  it("detects the Traficom footer/header signature", () => {
    expect(looksLikeTraficomReport(SAMPLE)).toBe(true);
    expect(looksLikeTraficomReport("random tjekbil dump")).toBe(false);
  });
});

describe("parseTraficomReport", () => {
  it("extracts owner chain with a Somija owner-count line", () => {
    const parsed = parseTraficomReport(SAMPLE);
    expect(parsed).not.toBeNull();
    expect(parsed!.ownersSummary).toContain("Drivalia Lease Finland Oy");
    expect(parsed!.ownersSummary).toContain("Metso Finland Oy");
    expect(parsed!.ownersSummary).toContain("Euro Insurances Designated Activity Company");
    // Pirmais īpašnieks Drivalia + Pirmais īpašnieks Metso + spēkā esošais Euro Insurances = 3 unikāli.
    expect(parsed!.ownersSummary).toContain("Īpašnieku skaits Somijā: 3.");
  });

  it("never invents a mileage row (Somijas reģistrs nepublicē km)", () => {
    const parsed = parseTraficomReport(SAMPLE);
    expect(parsed).not.toBeNull();
    expect((parsed as unknown as { mileage?: unknown[] }).mileage).toBeUndefined();
  });

  it("flags decommissioning-due-to-damage and driving prohibition as notes", () => {
    const parsed = parseTraficomReport(SAMPLE);
    expect(parsed).not.toBeNull();
    expect(parsed!.autoNotes).toContain("Auto noņemts no reģistra.");
    expect(parsed!.autoNotes).toContain("braukšanas / lietošanas aizliegums");
    expect(parsed!.autoNotes).toContain("bojājuma dēļ");
    expect(parsed!.incidents.some((r) => r.date === "12.12.2024" && /bojāj/i.test(r.note))).toBe(true);
  });

  it("builds a timeline with entry-into-service, transfer, owner and use-history rows", () => {
    const parsed = parseTraficomReport(SAMPLE);
    expect(parsed).not.toBeNull();
    const events = parsed!.timeline.map((r) => r.event);
    expect(events).toContain("Nodošana ekspluatācijā");
    expect(events).toContain("Paziņojums par īpašnieka maiņu");
    expect(events.some((e) => e.includes("Drivalia Lease Finland Oy"))).toBe(true);
    expect(events.some((e) => e.includes("Lietošanas veids: Privāta lietošana"))).toBe(true);
    expect(events.some((e) => e.includes("Lietošanas veids: Pārdošanā"))).toBe(true);
    expect(events.some((e) => /Noņemts no reģistra bojājuma dēļ/.test(e))).toBe(true);
    expect(events.some((e) => e.includes("Apdrošināšana:"))).toBe(true);
    for (const row of parsed!.timeline) {
      expect(row.country).toBe("Somija");
    }
  });

  it("returns null for unrelated text", () => {
    expect(parseTraficomReport("nothing here")).toBeNull();
  });
});

/** Traficom PDF pēc pdftotext -layout (divas kolonnas, vērtība tajā pašā rindā). */
const XPS_379_LAYOUT = `Vehicle information
Source: Transport Register
26.09.2026 22:27
Page 1/6
XPS-379 Car Volkswagen, VW ID.4 GTX 220 KW
The vehicle is under a prohibition of driving or use.
Vehicle identification number (VIN) WVGZZZE2ZNP009103
Vehicle status Decommissioned
Next inspection period 8.11.2021–10.11.2025
Tax status No unpaid vehicle tax
No unpaid additional tax
Restrictions Periodic inspection not performed/approved
Vehicle decommissioning (Deregistrated due to a damage)
Pending data There is a notification of transfer entry for the vehicle
Basic information
Make Volkswagen, VW
Commercial name ID.4 GTX 220 KW
Registration number XPS-379
Date of entry into service 8.11.2021
First registration in Finland 8.11.2021
Notification of transfer information
Date of transfer Type of transfer Name
14.8.2025 Notification of transfer
Owner(s)
Starting from Owner(s)
17.1.2025 Euro Insurances Designated Activity Company
Owner history (information subject to a fee)
Period Name Ownership Type
25.11.2024–17.1.2025 Drivalia Lease Finland Oy First owner
25.11.2024–17.1.2025 Klaravik Finland Oy First operator
25.11.2024–17.1.2025 Anttila, Mika Jaakko Juhana Other operator
1.11.2024–25.11.2024 Drivalia Lease Finland Oy, First owner
8.11.2021–1.11.2024 Drivalia Lease Finland Oy First owner
8.11.2021–1.11.2024 Metso Finland Oy First operator
8.11.2021–1.11.2024 Private individual Other operator
Engine details
Driving power Electricity
Insurance history (information subject to a fee)
Company Start date End date
IF 1.1.2025 12.12.2024
Euro Insurances 8.11.2021 1.11.2024
Use history (information subject to a fee)
Use Start date
Private 3.12.2024
Sales storage 5.11.2024
Private 8.11.2021
Decommissioning history (information subject to a fee)
Reason for decommissioning Time period
Deregistrated due to a damage 12.12.2024–
Finnish Transport and Communications Agency
PO Box 320, 00059 TRAFICOM • www.traficom.fi • Business ID 2924753-3
`;

describe("parseTraficomReport XPS-379 layout", () => {
  it("reads same-line Traficom PDF fields and paid owner history", () => {
    const parsed = parseTraficomReport(XPS_379_LAYOUT);
    expect(parsed).not.toBeNull();
    expect(parsed!.vin).toBe("WVGZZZE2ZNP009103");
    expect(parsed!.plate).toBe("XPS-379");
    expect(parsed!.ownersSummary).toContain("Drivalia Lease Finland Oy");
    expect(parsed!.ownersSummary).toContain("Euro Insurances Designated Activity Company");
    expect(parsed!.ownersSummary).toMatch(/Īpašnieku skaits Somijā: 2\./);
    expect(parsed!.statusRecords).toContain("Numurs: XPS-379");
    expect(parsed!.statusRecords).toMatch(/noņemts no reģistra/i);
    expect(parsed!.autoNotes).toContain("braukšanas / lietošanas aizliegums");
    expect(parsed!.autoNotes).toContain("bojājuma dēļ");
    expect(parsed!.incidents.some((r) => r.date === "12.12.2024")).toBe(true);
    expect(parsed!.timeline.some((r) => r.event === "Pirmā reģistrācija Somijā")).toBe(true);
    expect(parsed!.timeline.some((r) => /Lietošanas veids: Pārdošanā/.test(r.event))).toBe(true);
  });
});

describe("applyTraficomReportToBlock", () => {
  it("merges parsed facts into an empty VinRegistryBlockState", () => {
    const applied = applyTraficomReportToBlock(emptyVinRegistryBlock(), SAMPLE);
    expect(applied).not.toBeNull();
    expect(applied!.block.ownersSummary).toContain("Īpašnieku skaits Somijā:");
    expect(applied!.block.timeline.length).toBeGreaterThan(0);
    expect(applied!.summary).toContain("Somijas reģistrs");
  });

  it("keeps existing aiContextRaw instead of overwriting it", () => {
    const existing = { ...emptyVinRegistryBlock(), aiContextRaw: "manuāli ievadīts konteksts" };
    const applied = applyTraficomReportToBlock(existing, SAMPLE);
    expect(applied!.block.aiContextRaw).toBe("manuāli ievadīts konteksts");
  });
});
