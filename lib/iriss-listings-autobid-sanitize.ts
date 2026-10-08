/**
 * Autobid ielogotā `__NUXT_DATA__` satur JWT / Bearer un konta laukus.
 * Izgriežam pirms raw saglabāšanas (aizsardzība, ja relejs vēl nav atjaunināts).
 *
 * devalue masīvs deduplicē slotus: viena virkne var būt gan nickname, gan items[].name.
 * Tukšot izmesta atslēgas apakškoku nozīmē tukšot kopīgos slotus. Tāpēc vispirms
 * pārraujam atsauces (izmestā atslēga rāda uz jaunu "" slotu), tad atstājam to, kas
 * sasniedzams no saknes, un tukšojam tikai nesasniedzamos.
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
  "nickname",
  "surname",
  "contactperson",
  "addressbook",
  "extendeddata",
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

const WRAPPERS = new Set(["Reactive", "ShallowReactive", "Ref", "ShallowRef", "EmptyRef", "EmptyShallowRef", "NuxtError"]);

const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

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
  return s.replace(JWT_RE, "").replace(BEARER_RE, "").replace(EMAIL_RE, "").trim();
}

function isDroppedKey(k: string): boolean {
  const kn = keyNorm(k);
  return SECRET_KEYS.has(kn) || ACCOUNT_KEYS.has(kn) || ACCOUNT_OBJECT_KEYS.has(kn);
}

function isSlotRef(n: unknown, len: number): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n < len;
}

function eachChildRef(value: unknown, visit: (ref: unknown, key?: string, rec?: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    if (value.length >= 1 && typeof value[0] === "string") {
      const tag = value[0];
      if (WRAPPERS.has(tag)) {
        if (tag.startsWith("Empty") && typeof value[1] === "string") return;
        visit(value[1]);
        return;
      }
      if (tag === "Date" || tag === "BigInt") return;
      if (tag === "Set" || tag === "Map") {
        for (let i = 1; i < value.length; i++) visit(value[i]);
        return;
      }
    }
    for (const x of value) visit(x);
    return;
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) visit(v, k, rec);
  }
}

/** Pārrauj izmestās atslēgas, saglabā sasniedzamos slotus, tukšo pārējos. */
function cutUnreachableAccountSlots(flat: unknown[]): void {
  let emptyIdx = -1;
  const emptyRef = (): number => {
    if (emptyIdx < 0) {
      emptyIdx = flat.length;
      flat.push("");
    }
    return emptyIdx;
  };
  const reachable = new Set<number>();
  const walk = (ref: unknown, depth: number): void => {
    if (depth > 80 || !isSlotRef(ref, flat.length) || reachable.has(ref)) return;
    reachable.add(ref);
    const value = flat[ref];
    eachChildRef(value, (child, key, rec) => {
      if (key != null && rec && isDroppedKey(key)) {
        rec[key] = emptyRef();
        reachable.add(emptyRef());
        return;
      }
      walk(child, depth + 1);
    });
  };
  walk(0, 0);
  for (let i = 0; i < flat.length; i++) {
    if (reachable.has(i)) continue;
    const v = flat[i];
    if (typeof v === "string") flat[i] = "";
    else if (Array.isArray(v)) flat[i] = [];
    else if (v && typeof v === "object") flat[i] = {};
    else flat[i] = "";
  }
}

function walkAllStrings(node: unknown, depth: number): void {
  if (depth > 50 || node == null) return;
  if (typeof node === "string") return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      if (typeof node[i] === "string") {
        const next = scrubString(node[i] as string);
        if (next !== node[i]) node[i] = next;
      } else walkAllStrings(node[i], depth + 1);
    }
    return;
  }
  if (typeof node === "object") {
    const rec = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) {
      if (typeof v === "string") {
        const next = scrubString(v);
        if (next !== v) rec[k] = next;
      } else walkAllStrings(v, depth + 1);
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
  if (Array.isArray(data)) cutUnreachableAccountSlots(data);
  walkAllStrings(data, 0);
  return JSON.stringify(data);
}

export function sanitizeAutobidNuxtPages(pages: string[]): string[] {
  return pages.map((p) => sanitizeAutobidNuxtJson(p));
}
