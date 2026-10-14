import "server-only";

import { createB2bDemoTenantWithOwner, lookupB2bDemoUserByEmail, tenantCount } from "@/lib/b2b-demo-store";
import { b2bDemoDevLoginPrefill, readB2bDemoSeedCredentials } from "@/lib/b2b-demo-seed-config";

export { b2bDemoDevLoginPrefill, readB2bDemoSeedCredentials };

export async function ensureB2bDemoSeed(): Promise<{ seeded: boolean; email: string | null }> {
  const seed = readB2bDemoSeedCredentials();
  if (!seed) return { seeded: false, email: null };
  const existing = await lookupB2bDemoUserByEmail(seed.email);
  if (existing) return { seeded: false, email: seed.email };
  const count = await tenantCount();
  if (count > 0) return { seeded: false, email: seed.email };
  await createB2bDemoTenantWithOwner({
    name: seed.companyName,
    slug: "demo",
    ownerEmail: seed.email,
    ownerName: "Īpašnieks",
    ownerPassword: seed.password,
  });
  return { seeded: true, email: seed.email };
}

export async function bootstrapFirstB2bDemoTenant(input: {
  email: string;
  password: string;
  companyName: string;
  ownerName: string;
}): Promise<{ tenantId: string }> {
  const count = await tenantCount();
  if (count > 0) {
    throw new Error("Pirmais dīleris jau ir izveidots.");
  }
  const created = await createB2bDemoTenantWithOwner({
    name: input.companyName,
    slug: "demo",
    ownerEmail: input.email,
    ownerName: input.ownerName,
    ownerPassword: input.password,
  });
  return { tenantId: created.tenant.tenantId };
}
