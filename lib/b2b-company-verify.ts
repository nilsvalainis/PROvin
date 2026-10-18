/** Deterministiska B2B uzņēmuma pārbaude (UR + VIES + e-pasta domēns). Bez AI. */

export type CompanyVerifyCheckId =
  | "ur_exists"
  | "ur_active"
  | "ur_name"
  | "ur_address"
  | "ur_officer"
  | "vies_valid"
  | "vies_name"
  | "email_domain";

export type CompanyVerifyTone = "green" | "yellow" | "red" | "unavailable";
export type CompanyVerifyOverall = "derigs" | "saubigs";
export type CompanyVerifyDecision = "pending" | "approved" | "rejected";
export type CompanyVerifySubjectKind = "lead" | "partner";

export type CompanyVerifyInput = {
  companyName: string;
  companyReg: string;
  companyAddress: string;
  vatNumber: string;
  contactName: string;
  email: string;
};

export type CompanyVerifyCheck = {
  id: CompanyVerifyCheckId;
  tone: CompanyVerifyTone;
  detail: string;
};

export type CompanyVerifyUrCompany = {
  regcode: string;
  name: string;
  address: string;
  registered: string;
  terminated: string;
  closed: string;
  type: string;
};

export type CompanyVerifyOfficer = {
  name: string;
  governingBody: string;
  position: string;
};

export type CompanyVerifyVies = {
  country: string;
  vatNumber: string;
  valid: boolean;
  name: string;
  address: string;
};

export type CompanyVerifySourceStatus = "ok" | "unavailable" | "skipped";

export type CompanyVerifySources = {
  urCompany: { status: CompanyVerifySourceStatus; record: CompanyVerifyUrCompany | null };
  urOfficers: { status: CompanyVerifySourceStatus; officers: CompanyVerifyOfficer[] };
  vies: { status: CompanyVerifySourceStatus; record: CompanyVerifyVies | null };
};

export type CompanyVerifyReport = {
  overall: CompanyVerifyOverall;
  checks: CompanyVerifyCheck[];
  fetchedAt: string;
  sources: {
    urCompany: CompanyVerifySourceStatus;
    urOfficers: CompanyVerifySourceStatus;
    vies: CompanyVerifySourceStatus;
  };
  ur: CompanyVerifyUrCompany | null;
  vies: CompanyVerifyVies | null;
  officers: CompanyVerifyOfficer[];
};

export type CompanyVerifyView = {
  kind: CompanyVerifySubjectKind;
  id: string;
  input: CompanyVerifyInput;
  report: CompanyVerifyReport;
  decision: CompanyVerifyDecision;
  decidedAt: string | null;
  cached: boolean;
};

export const COMPANY_VERIFY_CHECK_ORDER: CompanyVerifyCheckId[] = [
  "ur_exists",
  "ur_active",
  "ur_name",
  "ur_address",
  "ur_officer",
  "vies_valid",
  "vies_name",
  "email_domain",
];

export const COMPANY_VERIFY_CHECK_LABELS: Record<CompanyVerifyCheckId, string> = {
  ur_exists: "UR: uzņēmums pastāv",
  ur_active: "UR: aktīvs, nav likvidēts",
  ur_name: "UR: nosaukums",
  ur_address: "UR: juridiskā adrese",
  ur_officer: "UR: kontaktpersona valdē",
  vies_valid: "VIES: PVN derīgs",
  vies_name: "VIES: nosaukums",
  email_domain: "E-pasta domēns",
};

export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.de",
  "outlook.com",
  "outlook.de",
  "hotmail.com",
  "hotmail.co.uk",
  "hotmail.de",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "inbox.lv",
  "inbox.eu",
  "inbox.com",
  "inbox.lt",
  "mail.lv",
  "apollo.lv",
  "one.lv",
  "tvnet.lv",
  "latnet.lv",
  "balticom.lv",
  "mail.ru",
  "inbox.ru",
  "bk.ru",
  "list.ru",
  "yandex.ru",
  "yandex.com",
  "ya.ru",
  "zoho.com",
  "gmx.com",
  "gmx.de",
  "web.de",
  "t-online.de",
  "freenet.de",
  "email.com",
  "mail.com",
  "tutanota.com",
  "tutamail.com",
  "fastmail.com",
]);

const LEGAL_FORM_RE =
  /\b(sia|as|ik|ks|ps|ltd|llc|gmbh|oy|ab|uab|ou|sro|zv|sabiedriba ar ierobezotu atbildibu|akciju sabiedriba|individualais komersants|sp z o o|sp zoo)\b/gi;

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export function foldVerifyText(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[øØ]/g, "o")
    .toLowerCase();
}

export function stripCompanyQuotes(raw: string): string {
  return raw.replace(/[„“”"'«»`´]/g, " ");
}

export function normalizeCompanyName(raw: string): string {
  return foldVerifyText(stripCompanyQuotes(raw))
    .replace(/[.,;:()/\\&+]/g, " ")
    .replace(LEGAL_FORM_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function companyNamesMatch(a: string, b: string): "exact" | "close" | "none" {
  const left = normalizeCompanyName(a);
  const right = normalizeCompanyName(b);
  if (!left || !right) return "none";
  if (left === right) return "exact";
  if (left.includes(right) || right.includes(left)) return "close";
  const aTokens = new Set(left.split(" ").filter((t) => t.length > 1));
  const bTokens = new Set(right.split(" ").filter((t) => t.length > 1));
  if (aTokens.size === 0 || bTokens.size === 0) return "none";
  let overlap = 0;
  for (const token of aTokens) if (bTokens.has(token)) overlap += 1;
  const min = Math.min(aTokens.size, bTokens.size);
  if (overlap === min && overlap > 0) return "close";
  if (overlap / Math.max(aTokens.size, bTokens.size) >= 0.6) return "close";
  return "none";
}

export function normalizeAddress(raw: string): string {
  return foldVerifyText(raw)
    .replace(/\blv-?\d{4}\b/g, " ")
    .replace(/\b(iela|gatve|bulvaris|laukums|prospekts|aleja|street|str|iela)\b/g, " ")
    .replace(/[.,;:/#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function addressesMatch(a: string, b: string): "exact" | "close" | "none" {
  const left = normalizeAddress(a);
  const right = normalizeAddress(b);
  if (!left || !right) return "none";
  if (left === right) return "exact";
  if (left.includes(right) || right.includes(left)) return "close";
  const aTokens = left.split(" ").filter((t) => t.length > 1);
  const bTokens = new Set(right.split(" ").filter((t) => t.length > 1));
  if (aTokens.length === 0 || bTokens.size === 0) return "none";
  const hit = aTokens.filter((t) => bTokens.has(t)).length;
  if (hit >= Math.min(2, aTokens.length) && hit / aTokens.length >= 0.5) return "close";
  return "none";
}

export function personNameTokens(raw: string): string[] {
  return foldVerifyText(raw)
    .replace(/[-']/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .sort();
}

export function personNamesMatch(contact: string, officer: string): boolean {
  const a = personNameTokens(contact);
  const b = personNameTokens(officer);
  if (a.length < 2 || b.length < 2) return false;
  if (a.join(" ") === b.join(" ")) return true;
  return a.every((token) => b.includes(token));
}

export function officerIsBoard(officer: CompanyVerifyOfficer): boolean {
  const body = officer.governingBody.toUpperCase();
  const position = foldVerifyText(officer.position);
  return (
    body === "EXECUTIVE_BOARD" ||
    body.includes("BOARD") ||
    position.includes("valdes") ||
    position.includes("board")
  );
}

const VAT_COUNTRY_RE = /^([A-Z]{2})([A-Z0-9]{2,12})$/;
const LV_REG_RE = /^(\d{11})$/;

export function digitsOnlyReg(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/^LV/i, "").replace(/\D/g, "");
}

export function parseVatHint(vatNumber: string, companyReg: string): { country: string; number: string } | null {
  const vat = vatNumber.replace(/[\s.-]/g, "").toUpperCase();
  const vatMatch = VAT_COUNTRY_RE.exec(vat);
  if (vatMatch) return { country: vatMatch[1]!, number: vatMatch[2]! };

  const reg = companyReg.replace(/[\s.-]/g, "").toUpperCase();
  const regVat = VAT_COUNTRY_RE.exec(reg);
  if (regVat) return { country: regVat[1]!, number: regVat[2]! };

  const lv = LV_REG_RE.exec(digitsOnlyReg(companyReg));
  if (lv) return { country: "LV", number: lv[1]! };
  return null;
}

export function emailDomainOf(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "";
  return email.slice(at + 1).trim().toLowerCase();
}

export function isFreeEmailDomain(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.has(domain.toLowerCase());
}

export function classifyEmailDomain(email: string): {
  kind: "company" | "free" | "invalid";
  domain: string;
} {
  const domain = emailDomainOf(email);
  if (!domain || !domain.includes(".")) return { kind: "invalid", domain };
  if (isFreeEmailDomain(domain)) return { kind: "free", domain };
  return { kind: "company", domain };
}

export function normalizeCompanyVerifyInput(raw: Partial<CompanyVerifyInput> | Record<string, unknown>): CompanyVerifyInput {
  return {
    companyName: clip(raw.companyName, 200),
    companyReg: clip(raw.companyReg, 32).replace(/\s+/g, ""),
    companyAddress: clip(raw.companyAddress, 300),
    vatNumber: clip(raw.vatNumber, 20).replace(/[\s.-]/g, "").toUpperCase(),
    contactName: clip(raw.contactName, 120),
    email: clip(raw.email, 254).toLowerCase(),
  };
}

export function isCompanyVerifyDecision(value: unknown): value is CompanyVerifyDecision {
  return value === "pending" || value === "approved" || value === "rejected";
}

export function emptyCompanyVerifySources(): CompanyVerifySources {
  return {
    urCompany: { status: "skipped", record: null },
    urOfficers: { status: "skipped", officers: [] },
    vies: { status: "skipped", record: null },
  };
}

function check(
  id: CompanyVerifyCheckId,
  tone: CompanyVerifyTone,
  detail: string,
): CompanyVerifyCheck {
  return { id, tone, detail };
}

export function decideCompanyVerifyOverall(checks: CompanyVerifyCheck[]): CompanyVerifyOverall {
  if (checks.some((row) => row.tone === "red")) return "saubigs";
  const exists = checks.find((row) => row.id === "ur_exists");
  const active = checks.find((row) => row.id === "ur_active");
  const vies = checks.find((row) => row.id === "vies_valid");
  const confirmed =
    exists?.tone === "green" ||
    vies?.tone === "green";
  const notDead = active?.tone !== "red";
  if (confirmed && notDead) return "derigs";
  return "saubigs";
}

export function buildCompanyVerifyReport(
  input: CompanyVerifyInput,
  sources: CompanyVerifySources,
  now = new Date(),
): CompanyVerifyReport {
  const ur = sources.urCompany.record;
  const vies = sources.vies.record;
  const officers = sources.urOfficers.officers;
  const vat = parseVatHint(input.vatNumber, input.companyReg);
  const checks: CompanyVerifyCheck[] = [];

  if (sources.urCompany.status === "unavailable") {
    checks.push(check("ur_exists", "unavailable", "UR atvērtie dati nav pieejami"));
    checks.push(check("ur_active", "unavailable", "UR statusu neizdevās nolasīt"));
    checks.push(check("ur_name", "unavailable", "UR nosaukumu neizdevās salīdzināt"));
    checks.push(check("ur_address", "unavailable", "UR adresi neizdevās salīdzināt"));
  } else if (!ur) {
    const hint = input.companyReg || input.companyName;
    checks.push(
      check(
        "ur_exists",
        hint ? "red" : "yellow",
        hint ? "UR nav šāda uzņēmuma" : "Nav reģ. nr. un nosaukuma, UR nevar meklēt",
      ),
    );
    checks.push(check("ur_active", hint ? "red" : "yellow", "Aktīvo statusu nevar apstiprināt"));
    checks.push(check("ur_name", hint ? "yellow" : "yellow", "UR nosaukuma nav"));
    checks.push(
      check(
        "ur_address",
        input.companyAddress ? "yellow" : "yellow",
        input.companyAddress ? "UR adresi nevar salīdzināt" : "Adrese nav norādīta",
      ),
    );
  } else {
    checks.push(check("ur_exists", "green", `Atrasts UR: ${ur.name} (${ur.regcode})`));
    const dead = Boolean(ur.terminated) || /^l/i.test(ur.closed);
    checks.push(
      check(
        "ur_active",
        dead ? "red" : "green",
        dead
          ? `Izslēgts vai likvidēts${ur.terminated ? ` ${ur.terminated.slice(0, 10)}` : ""}`
          : `Aktīvs${ur.registered ? `, reģistrēts ${ur.registered.slice(0, 10)}` : ""}`,
      ),
    );
    if (!input.companyName) {
      checks.push(check("ur_name", "yellow", "Iesniegtais nosaukums ir tukšs"));
    } else {
      const nameHit = companyNamesMatch(input.companyName, ur.name);
      checks.push(
        check(
          "ur_name",
          nameHit === "exact" ? "green" : nameHit === "close" ? "yellow" : "red",
          nameHit === "exact"
            ? "Nosaukums sakrīt ar UR"
            : nameHit === "close"
              ? `Līdzīgs UR nosaukumam: ${ur.name}`
              : `Nesakrīt ar UR: ${ur.name}`,
        ),
      );
    }
    if (!input.companyAddress) {
      checks.push(check("ur_address", "yellow", "Adrese nav norādīta"));
    } else if (!ur.address) {
      checks.push(check("ur_address", "yellow", "UR adrese nav norādīta"));
    } else {
      const addrHit = addressesMatch(input.companyAddress, ur.address);
      checks.push(
        check(
          "ur_address",
          addrHit === "none" ? "red" : addrHit === "exact" ? "green" : "yellow",
          addrHit === "exact"
            ? "Adrese sakrīt ar UR"
            : addrHit === "close"
              ? `Līdzīga UR adresei: ${ur.address}`
              : `Nesakrīt ar UR: ${ur.address}`,
        ),
      );
    }
  }

  if (sources.urOfficers.status === "unavailable") {
    checks.push(check("ur_officer", "unavailable", "UR amatpersonu saraksts nav pieejams"));
  } else if (!input.contactName) {
    checks.push(check("ur_officer", "yellow", "Kontaktpersona nav norādīta"));
  } else if (officers.length === 0) {
    checks.push(check("ur_officer", "yellow", "UR nav amatpersonu šim reģ. nr."));
  } else {
    const hit = officers.find((row) => personNamesMatch(input.contactName, row.name));
    if (!hit) {
      checks.push(check("ur_officer", "yellow", "Kontaktpersona nav UR amatpersonu sarakstā"));
    } else if (officerIsBoard(hit)) {
      checks.push(check("ur_officer", "green", `${hit.name} ir valdes loceklis`));
    } else {
      checks.push(
        check(
          "ur_officer",
          "yellow",
          `${hit.name} ir amatpersona (${hit.governingBody || hit.position || "cits"}), nav valdē`,
        ),
      );
    }
  }

  if (!vat) {
    checks.push(check("vies_valid", "yellow", "PVN nr. nav norādīts un no reģ. nr. to nevar izsecināt"));
    checks.push(check("vies_name", "yellow", "VIES nosaukumu nevar salīdzināt"));
  } else if (sources.vies.status === "unavailable") {
    checks.push(check("vies_valid", "unavailable", "VIES nav pieejams"));
    checks.push(check("vies_name", "unavailable", "VIES nosaukumu neizdevās nolasīt"));
  } else if (!vies) {
    checks.push(check("vies_valid", "red", `VIES neatbildēja par ${vat.country}${vat.number}`));
    checks.push(check("vies_name", "yellow", "VIES nosaukuma nav"));
  } else if (!vies.valid) {
    checks.push(check("vies_valid", "red", `PVN ${vat.country}${vat.number} VIES nav derīgs`));
    checks.push(check("vies_name", "yellow", "Nederīgam PVN nosaukumu nesalīdzina"));
  } else {
    checks.push(check("vies_valid", "green", `PVN ${vat.country}${vat.number} ir derīgs VIES`));
    const viesName = vies.name.replace(/[-]+/g, "").trim();
    if (!viesName) {
      checks.push(check("vies_name", "yellow", "VIES derīgs, nosaukums nav publicēts"));
    } else if (!input.companyName) {
      checks.push(check("vies_name", "yellow", `VIES nosaukums: ${vies.name}`));
    } else {
      const nameHit = companyNamesMatch(input.companyName, vies.name);
      checks.push(
        check(
          "vies_name",
          nameHit === "none" ? "red" : nameHit === "exact" ? "green" : "yellow",
          nameHit === "exact"
            ? "Nosaukums sakrīt ar VIES"
            : nameHit === "close"
              ? `Līdzīgs VIES nosaukumam: ${vies.name}`
              : `Nesakrīt ar VIES: ${vies.name}`,
        ),
      );
    }
  }

  const mail = classifyEmailDomain(input.email);
  if (mail.kind === "invalid") {
    checks.push(check("email_domain", "red", "E-pasta adrese nav derīga"));
  } else if (mail.kind === "free") {
    checks.push(check("email_domain", "yellow", `Brīvā pasta domēns (${mail.domain})`));
  } else {
    checks.push(check("email_domain", "green", `Uzņēmuma domēns (${mail.domain})`));
  }

  const ordered = COMPANY_VERIFY_CHECK_ORDER.map((id) => checks.find((row) => row.id === id)).filter(
    (row): row is CompanyVerifyCheck => Boolean(row),
  );

  return {
    overall: decideCompanyVerifyOverall(ordered),
    checks: ordered,
    fetchedAt: now.toISOString(),
    sources: {
      urCompany: sources.urCompany.status,
      urOfficers: sources.urOfficers.status,
      vies: sources.vies.status,
    },
    ur,
    vies,
    officers,
  };
}

export function overallLabel(overall: CompanyVerifyOverall): string {
  return overall === "derigs" ? "Derīgs" : "Šaubīgs";
}

export function toneLabel(tone: CompanyVerifyTone): string {
  if (tone === "unavailable") return "Nepieejams";
  if (tone === "green") return "Zaļš";
  if (tone === "yellow") return "Dzeltens";
  return "Sarkans";
}

export function decisionLabel(decision: CompanyVerifyDecision): string {
  if (decision === "approved") return "Apstiprināts";
  if (decision === "rejected") return "Noraidīts";
  return "Gaida lēmumu";
}
