import "server-only";

import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import {
  B2B_INVITE_TTL_MS,
  isB2bInviteOpen,
  isSafeB2bInviteToken,
  newB2bInviteToken,
  parseB2bInviteRecord,
  type B2bPartnerInviteRecord,
} from "@/lib/b2b-partner-invite";

const DOC_KEY = "invites";

export type B2bInviteDoc = {
  version: 1;
  updatedAt: string;
  invites: B2bPartnerInviteRecord[];
};

export function emptyB2bInviteDoc(): B2bInviteDoc {
  return { version: 1, updatedAt: new Date().toISOString(), invites: [] };
}

export function parseB2bInviteDoc(raw: unknown): B2bInviteDoc {
  if (!raw || typeof raw !== "object") {
    throw new Error("invalid_invite_doc");
  }
  const p = raw as Partial<B2bInviteDoc>;
  const invites: B2bPartnerInviteRecord[] = [];
  if (Array.isArray(p.invites)) {
    for (const item of p.invites) {
      const row = parseB2bInviteRecord(item);
      if (row) invites.push(row);
    }
  }
  return {
    version: 1,
    updatedAt:
      typeof p.updatedAt === "string" && p.updatedAt.trim() ? p.updatedAt.trim() : new Date().toISOString(),
    invites,
  };
}

const store = createJsonDocStore<B2bInviteDoc>({
  blobPrefix: "b2b-partners/",
  dirName: "b2b-partner-invites",
  isSafeKey: (key) => key === DOC_KEY,
  parse: parseB2bInviteDoc,
  empty: emptyB2bInviteDoc,
});

let writeChain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function mutateInvites<R>(
  mutate: (doc: B2bInviteDoc) => { value: R; next?: B2bInviteDoc } | Promise<{ value: R; next?: B2bInviteDoc }>,
): Promise<R> {
  return withLock(() =>
    store.update(DOC_KEY, async (doc) => {
      const decision = await mutate(doc);
      if (decision.next === undefined) return { value: decision.value };
      return {
        value: decision.value,
        next: { ...decision.next, updatedAt: new Date().toISOString() },
      };
    }),
  );
}

export async function listOpenB2bInvites(): Promise<B2bPartnerInviteRecord[]> {
  const doc = await store.read(DOC_KEY);
  return doc.invites.filter((row) => isB2bInviteOpen(row));
}

export async function createB2bInvite(): Promise<B2bPartnerInviteRecord> {
  return mutateInvites(async (doc) => {
    const now = Date.now();
    const record: B2bPartnerInviteRecord = {
      token: newB2bInviteToken(),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + B2B_INVITE_TTL_MS).toISOString(),
      usedAt: null,
      usedPartnerId: null,
    };
    return { value: record, next: { ...doc, invites: [...doc.invites, record] } };
  });
}

export async function getOpenB2bInvite(token: string): Promise<B2bPartnerInviteRecord | null> {
  if (!isSafeB2bInviteToken(token)) return null;
  const doc = await store.read(DOC_KEY);
  const row = doc.invites.find((item) => item.token === token.trim()) ?? null;
  if (!row || !isB2bInviteOpen(row)) return null;
  return row;
}

export async function consumeB2bInvite(token: string, partnerId: string): Promise<boolean> {
  return mutateInvites(async (doc) => {
    const idx = doc.invites.findIndex((item) => item.token === token.trim());
    if (idx < 0) return { value: false };
    const prev = doc.invites[idx]!;
    if (!isB2bInviteOpen(prev)) return { value: false };
    const invites = doc.invites.slice();
    invites[idx] = {
      ...prev,
      usedAt: new Date().toISOString(),
      usedPartnerId: partnerId,
    };
    return { value: true, next: { ...doc, invites } };
  });
}
