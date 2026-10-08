/**
 * Autobid ielogotā `__NUXT_DATA__` satur JWT / Bearer un konta laukus.
 * Izgriežam pirms raw saglabāšanas (aizsardzība, ja relejs vēl nav atjaunināts).
 */
const SECRET_KEYS = new Set([
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "idtoken",
  "id_token",
  "bearertoken",
  "authorization",
  "jwt",
  "sessiontoken",
  "session_token",
  "csrftoken",
  "csrf_token",
  "password",
  "passwd",
  "secret",
  "apikey",
  "api_key",
]);

const ACCOUNT_KEYS = new Set([
  "email",
  "e-mail",
  "username",
  "login",
  "firstname",
  "lastname",
  "fullname",
  "displayname",
  "phone",
  "telephone",
  "mobile",
  "customernumber",
  "customerid",
  "customer_id",
  "accountid",
  "account_id",
  "userid",
  "user_id",
  "iban",
]);

const ACCOUNT_OBJECT_KEYS = new Set(["user", "account", "profile", "customer", "auth", "session", "me", "currentuser"]);

const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

function keyNorm(k: string): string {
  return k.toLowerCase().replace(/[\s-]/g, "");
}

export function isAutobidSecretString(s: string): boolean {
  if (!s) return false;
  JWT_RE.lastIndex = 0;
  BEARER_RE.lastIndex = 0;
  return JWT_RE.test(s) || BEARER_RE.test(s);
}

function scrubString(s: string): string {
  return s.replace(JWT_RE, "").replace(BEARER_RE, "").trim();
}

function redactSlot(flat: unknown[], ref: unknown): void {
  if (typeof ref !== "number" || ref < 0 || ref >= flat.length) return;
  const v = flat[ref];
  if (typeof v === "string") {
    flat[ref] = "";
    return;
  }
  if (v && typeof v === "object") redactDeep(v, flat, 0);
}

function redactDeep(node: unknown, flat: unknown[], depth: number): void {
  if (depth > 40 || node == null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const x of node) {
      if (typeof x === "number") redactSlot(flat, x);
      else redactDeep(x, flat, depth + 1);
    }
    return;
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const kn = keyNorm(k);
    const drop = SECRET_KEYS.has(kn) || ACCOUNT_KEYS.has(kn) || ACCOUNT_OBJECT_KEYS.has(kn);
    if (typeof v === "number") {
      if (drop) redactSlot(flat, v);
    } else if (typeof v === "string") {
      if (drop || isAutobidSecretString(v)) (node as Record<string, unknown>)[k] = "";
    } else {
      redactDeep(v, flat, depth + 1);
    }
  }
}

function walkAllStrings(node: unknown, depth: number): void {
  if (depth > 50 || node == null) return;
  if (typeof node === "string") return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      if (typeof node[i] === "string" && isAutobidSecretString(node[i] as string)) node[i] = scrubString(node[i] as string);
      else walkAllStrings(node[i], depth + 1);
    }
    return;
  }
  if (typeof node === "object") {
    const rec = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) {
      if (typeof v === "string" && isAutobidSecretString(v)) rec[k] = scrubString(v);
      else walkAllStrings(v, depth + 1);
    }
  }
}

export function sanitizeAutobidNuxtJson(json: string): string {
  if (!json) return json;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return scrubString(json);
  }
  if (Array.isArray(data)) {
    for (const slot of data) {
      if (slot && typeof slot === "object" && !Array.isArray(slot)) {
        for (const [k, v] of Object.entries(slot as Record<string, unknown>)) {
          const kn = keyNorm(k);
          if (SECRET_KEYS.has(kn) || ACCOUNT_KEYS.has(kn) || ACCOUNT_OBJECT_KEYS.has(kn)) redactSlot(data, v);
        }
      }
    }
  }
  walkAllStrings(data, 0);
  return JSON.stringify(data);
}

export function sanitizeAutobidNuxtPages(pages: string[]): string[] {
  return pages.map((p) => sanitizeAutobidNuxtJson(p));
}
