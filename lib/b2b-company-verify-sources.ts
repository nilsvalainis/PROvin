import {
  digitsOnlyReg,
  parseVatHint,
  type CompanyVerifyInput,
  type CompanyVerifyOfficer,
  type CompanyVerifySources,
  type CompanyVerifyUrCompany,
  type CompanyVerifyVies,
} from "@/lib/b2b-company-verify";

export const UR_DATASTORE_URL = "https://data.gov.lv/dati/lv/api/action/datastore_search";
export const UR_COMPANIES_RESOURCE = "25e80bf3-f107-4ab4-89ef-251b5b9374e9";
export const UR_OFFICERS_RESOURCE = "e665114a-73c2-4375-9470-55874b4cfa6b";
export const VIES_REST_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms";

export const COMPANY_VERIFY_TIMEOUT_MS = 8_000;

export type CompanyVerifyFetch = (url: string, init: RequestInit) => Promise<Response>;

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
}

function textField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function parseUrCompanyRecord(raw: unknown): CompanyVerifyUrCompany | null {
  const row = asRecord(raw);
  if (!row) return null;
  const regcode = textField(row, "regcode");
  const name = textField(row, "name");
  if (!regcode && !name) return null;
  return {
    regcode,
    name,
    address: textField(row, "address"),
    registered: textField(row, "registered"),
    terminated: textField(row, "terminated"),
    closed: textField(row, "closed"),
    type: textField(row, "type") || textField(row, "type_text"),
  };
}

export function parseUrOfficerRecord(raw: unknown): CompanyVerifyOfficer | null {
  const row = asRecord(raw);
  if (!row) return null;
  const name = textField(row, "name");
  if (!name) return null;
  return {
    name,
    governingBody: textField(row, "governing_body"),
    position: textField(row, "position"),
  };
}

export function parseViesResponse(raw: unknown, country: string, vatNumber: string): CompanyVerifyVies | null {
  const row = asRecord(raw);
  if (!row) return null;
  const userError = textField(row, "userError").toUpperCase();
  if (userError && userError !== "VALID" && userError !== "INVALID") return null;
  return {
    country,
    vatNumber,
    valid: row.isValid === true,
    name: textField(row, "name"),
    address: textField(row, "address"),
  };
}

async function fetchJson(
  fetchImpl: CompanyVerifyFetch,
  url: string,
  timeoutMs: number,
): Promise<unknown> {
  const res = await fetchImpl(url, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.json();
}

function datastoreRecords(raw: unknown): unknown[] {
  const root = asRecord(raw);
  const result = asRecord(root?.result);
  return Array.isArray(result?.records) ? result.records : [];
}

export async function fetchUrCompany(
  input: CompanyVerifyInput,
  fetchImpl: CompanyVerifyFetch = fetch,
  timeoutMs = COMPANY_VERIFY_TIMEOUT_MS,
): Promise<CompanyVerifySources["urCompany"]> {
  try {
    const url = new URL(UR_DATASTORE_URL);
    url.searchParams.set("resource_id", UR_COMPANIES_RESOURCE);
    url.searchParams.set("limit", "5");
    const digits = digitsOnlyReg(input.companyReg);
    if (digits.length >= 8) {
      url.searchParams.set("filters", JSON.stringify({ regcode: Number(digits) || digits }));
    } else if (input.companyName) {
      url.searchParams.set("q", input.companyName);
    } else {
      return { status: "skipped", record: null };
    }
    const records = datastoreRecords(await fetchJson(fetchImpl, url.toString(), timeoutMs));
    const parsed = records.map(parseUrCompanyRecord).filter((row): row is CompanyVerifyUrCompany => Boolean(row));
    if (digits.length >= 8) {
      const exact = parsed.find((row) => digitsOnlyReg(row.regcode) === digits);
      return { status: "ok", record: exact ?? parsed[0] ?? null };
    }
    return { status: "ok", record: parsed[0] ?? null };
  } catch {
    return { status: "unavailable", record: null };
  }
}

export async function fetchUrOfficers(
  companyReg: string,
  fetchImpl: CompanyVerifyFetch = fetch,
  timeoutMs = COMPANY_VERIFY_TIMEOUT_MS,
): Promise<CompanyVerifySources["urOfficers"]> {
  const digits = digitsOnlyReg(companyReg);
  if (digits.length < 8) return { status: "skipped", officers: [] };
  try {
    const url = new URL(UR_DATASTORE_URL);
    url.searchParams.set("resource_id", UR_OFFICERS_RESOURCE);
    url.searchParams.set("limit", "50");
    url.searchParams.set(
      "filters",
      JSON.stringify({ at_legal_entity_registration_number: Number(digits) || digits }),
    );
    const records = datastoreRecords(await fetchJson(fetchImpl, url.toString(), timeoutMs));
    return {
      status: "ok",
      officers: records.map(parseUrOfficerRecord).filter((row): row is CompanyVerifyOfficer => Boolean(row)),
    };
  } catch {
    return { status: "unavailable", officers: [] };
  }
}

export async function fetchViesVat(
  input: CompanyVerifyInput,
  fetchImpl: CompanyVerifyFetch = fetch,
  timeoutMs = COMPANY_VERIFY_TIMEOUT_MS,
): Promise<CompanyVerifySources["vies"]> {
  const vat = parseVatHint(input.vatNumber, input.companyReg);
  if (!vat) return { status: "skipped", record: null };
  try {
    const url = `${VIES_REST_URL}/${encodeURIComponent(vat.country)}/vat/${encodeURIComponent(vat.number)}`;
    const raw = await fetchJson(fetchImpl, url, timeoutMs);
    const record = parseViesResponse(raw, vat.country, vat.number);
    if (!record) return { status: "unavailable", record: null };
    return { status: "ok", record };
  } catch {
    return { status: "unavailable", record: null };
  }
}

export async function fetchCompanyVerifySources(
  input: CompanyVerifyInput,
  fetchImpl: CompanyVerifyFetch = fetch,
  timeoutMs = COMPANY_VERIFY_TIMEOUT_MS,
): Promise<CompanyVerifySources> {
  const [urCompany, vies] = await Promise.all([
    fetchUrCompany(input, fetchImpl, timeoutMs),
    fetchViesVat(input, fetchImpl, timeoutMs),
  ]);
  const officerReg = urCompany.record?.regcode || input.companyReg;
  const urOfficers = await fetchUrOfficers(officerReg, fetchImpl, timeoutMs);
  return { urCompany, urOfficers, vies };
}
