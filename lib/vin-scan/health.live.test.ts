import { describe, expect, it } from "vitest";

import { VIN_SCAN_HEALTH_VINS, classifyVinScanHealth } from "@/lib/vin-scan/health";
import { decodeVinLocal } from "@/lib/vin-scan/vin-decode";

const live = Boolean(process.env.VIN_SCAN_HEALTH);

type LiveSource = {
  id: string;
  fetch: (vin: string) => Promise<{ status: string; summary: string }>;
};

/** RDW atvērtie dati (m9d7-ebf2) meklē pēc NL numura. Kolonnas vin nav. dsb paliek kā ir. */
const RDW_PLATE = "1KGB84";

async function httpGet(url: string, timeoutMs = 12_000): Promise<{ ok: boolean; status: number; text: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json, text/html;q=0.8" } });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: e instanceof Error ? e.message : "fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}

function jsonStatus(status: number, text: string, found: boolean, noneHttp = [404]): { status: string; summary: string } {
  if (noneHttp.includes(status)) return { status: "none", summary: `HTTP ${status}` };
  if (status === 0) return { status: "unknown", summary: text.slice(0, 180) };
  if (status >= 400) return { status: "unknown", summary: `HTTP ${status}` };
  if (!text.trim()) return { status: "unknown", summary: "tukša atbilde" };
  return found ? { status: "found", summary: `HTTP ${status}` } : { status: "none", summary: `HTTP ${status}` };
}

const LIVE_SOURCES: LiveSource[] = [
  {
    id: "vin_decode",
    fetch: async (vin) => {
      const local = decodeVinLocal(vin);
      const vpic = await httpGet(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      );
      let make = "";
      try {
        const row = (JSON.parse(vpic.text) as { Results?: { Make?: string; Model?: string }[] }).Results?.[0];
        make = String(row?.Make || "");
      } catch {
        make = "";
      }
      if (local.ok) {
        return { status: "found", summary: [local.year, local.make, make && make !== local.make ? make : "", local.countryName].filter(Boolean).join(" ") };
      }
      return { status: "none", summary: "VIN dekodēt neizdevās" };
    },
  },
  {
    id: "tjekbil",
    fetch: async (vin) => {
      const res = await httpGet(`https://www.tjekbil.dk/api/v3/dmr/vin/${encodeURIComponent(vin)}`);
      return jsonStatus(res.status, res.text, res.status === 200 && /stelNr|maerkeTypeNavn/i.test(res.text));
    },
  },
  {
    id: "esyn",
    fetch: async (vin) => {
      const res = await httpGet(`https://findsynsrapport.esyn.dk/webapi/v1/chassis/${encodeURIComponent(vin)}`);
      return jsonStatus(res.status, res.text, res.status === 200 && !/"error"/i.test(res.text));
    },
  },
  {
    id: "rdw",
    fetch: async (_vin) => {
      const res = await httpGet(
        `https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${encodeURIComponent(RDW_PLATE)}`,
      );
      let found = false;
      try {
        const rows = JSON.parse(res.text) as unknown;
        found = Array.isArray(rows) && rows.length > 0;
      } catch {
        found = false;
      }
      return jsonStatus(res.status, res.text, found, []);
    },
  },
  {
    id: "nhtsa_recalls",
    fetch: async (vin) => {
      const res = await httpGet(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      );
      if (!res.ok) return { status: "unknown", summary: `vPIC HTTP ${res.status}` };
      try {
        const row = (JSON.parse(res.text) as { Results?: { Make?: string }[] }).Results?.[0];
        if (!row?.Make) return { status: "none", summary: "vPIC bez markas" };
        return { status: "found", summary: row.Make };
      } catch {
        return { status: "unknown", summary: "vPIC nav JSON" };
      }
    },
  },
];

describe.skipIf(!live)("VIN SCAN live HTTP veselība", () => {
  it(
    "katrs HTTP avots × testa VIN",
    async () => {
      const lines: string[] = ["source\tvin\tcell\treason"];
      for (const src of LIVE_SOURCES) {
        if (src.id === "rdw") {
          const hit = await src.fetch(RDW_PLATE);
          const cell = classifyVinScanHealth(hit.status, hit.summary);
          lines.push(`rdw\t${RDW_PLATE}\t${cell.cell}\t${cell.reason.replace(/\s+/g, " ").slice(0, 120)}`);
          continue;
        }
        for (const row of VIN_SCAN_HEALTH_VINS) {
          const hit = await src.fetch(row.vin);
          const cell = classifyVinScanHealth(hit.status, hit.summary);
          lines.push(`${src.id}\t${row.vin}\t${cell.cell}\t${cell.reason.replace(/\s+/g, " ").slice(0, 120)}`);
        }
      }
      // eslint-disable-next-line no-console
      console.log(`\n${lines.join("\n")}\n`);
      expect(lines.length).toBeGreaterThan(10);
    },
    180_000,
  );
});
