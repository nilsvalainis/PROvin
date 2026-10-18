import "server-only";

import { isSafeB2bPartnerId } from "@/lib/b2b-partner-account";
import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import { emptyB2bWallet, parseB2bWallet, type B2bWallet } from "@/lib/b2b-wallet";

const store = createJsonDocStore<B2bWallet>({
  blobPrefix: "b2b-partner-wallets/",
  dirName: "b2b-partner-wallets",
  isSafeKey: isSafeB2bPartnerId,
  parse: parseB2bWallet,
  empty: emptyB2bWallet,
});

export function readB2bWallet(partnerId: string): Promise<B2bWallet> {
  return store.read(partnerId);
}

/** Atomāra maka mutācija. `next` nav = nekas netiek rakstīts. */
export function updateB2bWallet<R>(
  partnerId: string,
  mutate: (wallet: B2bWallet) => Promise<{ value: R; next?: B2bWallet }> | { value: R; next?: B2bWallet },
): Promise<R> {
  return store.update(partnerId, mutate);
}
