import {
  collectCustomerEmails,
  collectCustomerPhoneKeys,
  paidProductLabel,
} from "@/lib/admin-customer-identity";

export type ListingPeekConversionPeekInput = {
  id: string;
  email: string;
  phone: string;
  createdAt: string;
  commentSentAt?: string;
};

export type ListingPeekConversionPaidInput = {
  id: string;
  created: number;
  amountTotal: number | null;
  checkoutLine?: string | null;
  isDemo?: boolean;
  emails: Array<string | null | undefined>;
  phones: Array<string | null | undefined>;
};

export type ListingPeekConversionProductRow = {
  label: string;
  people: number;
};

export type ListingPeekConversionStats = {
  peekCount: number;
  skippedPeeks: number;
  commentSentPeeks: number;
  uniquePeople: number;
  convertedPeople: number;
  conversionRatePct: number | null;
  orderCount: number;
  revenueCents: number;
  byProduct: ListingPeekConversionProductRow[];
};

type Options = {
  skipPeek?: (peek: ListingPeekConversionPeekInput) => boolean;
};

function peekMs(createdAt: string): number | null {
  const ms = Date.parse(createdAt);
  return Number.isFinite(ms) ? ms : null;
}

function paidMs(createdUnixSec: number): number | null {
  if (!Number.isFinite(createdUnixSec) || createdUnixSec <= 0) return null;
  return createdUnixSec < 1_000_000_000_000 ? createdUnixSec * 1000 : createdUnixSec;
}

function contactKeys(emails: Array<string | null | undefined>, phones: Array<string | null | undefined>): string[] {
  const keys: string[] = [];
  for (const e of collectCustomerEmails(emails)) keys.push(`e:${e}`);
  for (const p of collectCustomerPhoneKeys(phones)) keys.push(`p:${p}`);
  return keys;
}

function createUnionFind() {
  const parent = new Map<string, string>();
  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    const p = parent.get(x)!;
    if (p !== x) {
      const root = find(p);
      parent.set(x, root);
      return root;
    }
    return p;
  }
  function union(a: string, b: string) {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent.set(pa, pb);
  }
  return { find, union };
}

export function emptyListingPeekConversionStats(): ListingPeekConversionStats {
  return {
    peekCount: 0,
    skippedPeeks: 0,
    commentSentPeeks: 0,
    uniquePeople: 0,
    convertedPeople: 0,
    conversionRatePct: null,
    orderCount: 0,
    revenueCents: 0,
    byProduct: [],
  };
}

/**
 * Unikāli ātro vērtējumu klienti, kas pēc iesūtījuma apmaksājuši kādu PROVIN pakalpojumu
 * (e-pasta vai tālruņa sakritība; demo un testa konti ārā). Visi pieprasījumi, ne tikai atbildētie.
 */
export function buildListingPeekConversionStats(
  peeks: ListingPeekConversionPeekInput[],
  paid: ListingPeekConversionPaidInput[],
  options?: Options,
): ListingPeekConversionStats {
  const skipPeek = options?.skipPeek;
  let skippedPeeks = 0;
  const kept: Array<ListingPeekConversionPeekInput & { ms: number; keys: string[] }> = [];

  for (const peek of peeks) {
    if (skipPeek?.(peek)) {
      skippedPeeks += 1;
      continue;
    }
    const ms = peekMs(peek.createdAt);
    const keys = contactKeys([peek.email], [peek.phone]);
    if (ms == null || keys.length === 0) {
      skippedPeeks += 1;
      continue;
    }
    kept.push({ ...peek, ms, keys });
  }

  const uf = createUnionFind();
  const people = new Map<string, { firstPeekMs: number }>();

  for (const peek of kept) {
    const personKey = `peek:${peek.id}`;
    uf.union(personKey, peek.keys[0]!);
    for (let i = 1; i < peek.keys.length; i++) uf.union(personKey, peek.keys[i]!);
  }

  for (const peek of kept) {
    const root = uf.find(`peek:${peek.id}`);
    const existing = people.get(root);
    if (!existing) {
      people.set(root, { firstPeekMs: peek.ms });
    } else if (peek.ms < existing.firstPeekMs) {
      existing.firstPeekMs = peek.ms;
    }
  }

  const keyToRoot = new Map<string, string>();
  for (const peek of kept) {
    const root = uf.find(`peek:${peek.id}`);
    for (const key of peek.keys) keyToRoot.set(key, root);
  }

  type PersonOrders = {
    firstPeekMs: number;
    orders: Array<{ createdMs: number; amount: number; label: string }>;
  };
  const ordersByPerson = new Map<string, PersonOrders>();
  for (const [root, person] of people) {
    ordersByPerson.set(root, { firstPeekMs: person.firstPeekMs, orders: [] });
  }

  for (const row of paid) {
    if (row.isDemo) continue;
    const createdMs = paidMs(row.created);
    if (createdMs == null) continue;
    const keys = contactKeys(row.emails, row.phones);
    const roots = new Set<string>();
    for (const key of keys) {
      const root = keyToRoot.get(key);
      if (root) roots.add(root);
    }
    if (roots.size === 0) continue;
    const amount = typeof row.amountTotal === "number" && Number.isFinite(row.amountTotal) ? row.amountTotal : 0;
    const label = paidProductLabel({
      checkoutLine: row.checkoutLine,
      amountTotalCents: row.amountTotal,
    });
    for (const root of roots) {
      const bucket = ordersByPerson.get(root);
      if (!bucket || createdMs < bucket.firstPeekMs) continue;
      bucket.orders.push({ createdMs, amount, label });
    }
  }

  const productPeople = new Map<string, number>();
  let convertedPeople = 0;
  let orderCount = 0;
  let revenueCents = 0;

  for (const bucket of ordersByPerson.values()) {
    const after = bucket.orders.filter((o) => o.createdMs >= bucket.firstPeekMs);
    if (after.length === 0) continue;
    convertedPeople += 1;
    orderCount += after.length;
    for (const o of after) revenueCents += o.amount;
    after.sort((a, b) => a.createdMs - b.createdMs);
    const firstLabel = after[0]!.label;
    productPeople.set(firstLabel, (productPeople.get(firstLabel) ?? 0) + 1);
  }

  const uniquePeople = people.size;
  const commentSentPeeks = kept.filter((p) => Boolean(p.commentSentAt?.trim())).length;
  const byProduct = [...productPeople.entries()]
    .map(([label, count]) => ({ label, people: count }))
    .sort((a, b) => b.people - a.people || a.label.localeCompare(b.label, "lv"));

  return {
    peekCount: kept.length,
    skippedPeeks,
    commentSentPeeks,
    uniquePeople,
    convertedPeople,
    conversionRatePct:
      uniquePeople > 0 ? Math.round((convertedPeople / uniquePeople) * 1000) / 10 : null,
    orderCount,
    revenueCents,
    byProduct,
  };
}
