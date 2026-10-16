import { describe, expect, it } from "vitest";
import { B2bDemoIsolationError } from "./b2b-demo-isolation";
import { emptyB2bDemoIndex, removeTenantFromB2bDemoIndex } from "./b2b-demo-repository";
import {
  addB2bDemoTenantEmployee,
  addB2bDemoTenantOrder,
  addB2bDemoTenantOwner,
  adminCreateB2bDemoTenant,
  createB2bDemoTenantWithOwner,
  createMemoryB2bDemoRepository,
  deleteB2bDemoTenant,
  deleteB2bDemoTenantOrder,
  getB2bDemoTenantOrder,
  listB2bDemoAdminTenants,
  listB2bDemoTenantOrderPage,
  listB2bDemoTenantOrders,
  listB2bDemoTenantUsers,
  lookupB2bDemoUserByEmail,
  readB2bDemoTenant,
  readB2bDemoTenantSettings,
  writeB2bDemoTenantSettings,
} from "./b2b-demo-store";
import type { MemoryB2bDemoRepository } from "./b2b-demo-repository";
import { verifyB2bDemoPassword } from "./b2b-demo-users";

describe("b2b demo store isolation", () => {
  it("neatdod otra dīlera pasūtījumus un iestatījumus", async () => {
    const repo = createMemoryB2bDemoRepository();
    const a = await createB2bDemoTenantWithOwner(
      {
        name: "A Auto",
        slug: "a-auto",
        ownerEmail: "a@demo.lv",
        ownerName: "A",
        ownerPassword: "password1",
      },
      repo,
    );
    const b = await createB2bDemoTenantWithOwner(
      {
        name: "B Auto",
        slug: "b-auto",
        ownerEmail: "b@demo.lv",
        ownerName: "B",
        ownerPassword: "password2",
      },
      repo,
    );
    const orderA = await addB2bDemoTenantOrder(a.tenant.tenantId, { clientName: "Klients A", brandModel: "BMW" }, repo);
    const orderB = await addB2bDemoTenantOrder(b.tenant.tenantId, { clientName: "Klients B", brandModel: "Audi" }, repo);

    const aOrders = await listB2bDemoTenantOrders(a.tenant.tenantId, repo);
    const bOrders = await listB2bDemoTenantOrders(b.tenant.tenantId, repo);
    expect(aOrders).toHaveLength(1);
    expect(aOrders[0]?.clientName).toBe("Klients A");
    expect(aOrders[0]?.tenantId).toBe(a.tenant.tenantId);
    expect(bOrders[0]?.clientName).toBe("Klients B");
    expect(aOrders.some((o) => o.tenantId === b.tenant.tenantId)).toBe(false);
    expect(await getB2bDemoTenantOrder(a.tenant.tenantId, orderB.orderId, repo)).toBeNull();
    expect(await getB2bDemoTenantOrder(b.tenant.tenantId, orderA.orderId, repo)).toBeNull();
    expect((await getB2bDemoTenantOrder(a.tenant.tenantId, orderA.orderId, repo))?.brandModel).toBe("BMW");

    await expect(
      writeB2bDemoTenantSettings(a.tenant.tenantId, "owner", { companyName: "X" }, b.tenant.tenantId, repo),
    ).rejects.toBeInstanceOf(B2bDemoIsolationError);

    await expect(
      addB2bDemoTenantEmployee(a.tenant.tenantId, "employee", {
        email: "c@demo.lv",
        name: "C",
        password: "password3",
      }, repo),
    ).rejects.toBeInstanceOf(B2bDemoIsolationError);
  });

  it("jauns tenants sāk ar tukšiem iestatījumiem, bez ĪRISS skaitļiem", async () => {
    const repo = createMemoryB2bDemoRepository();
    const created = await adminCreateB2bDemoTenant(
      {
        name: "Jauns Auto",
        slug: "jauns-auto",
        ownerEmail: "owner@demo.lv",
      },
      repo,
    );
    expect(created.generatedPassword).toBeTruthy();
    expect(created.generatedPassword!.length).toBeGreaterThanOrEqual(8);
    expect(created.owner).not.toHaveProperty("passwordHash");
    const settings = await readB2bDemoTenantSettings(created.tenant.tenantId, repo);
    expect(settings?.commissionEur).toBe(0);
    expect(settings?.transportEur).toBe(0);
    expect(settings?.auctionFeeEur).toBe(0);
    expect(settings?.unexpectedEur).toBe(0);
    expect(settings?.companyName).toBe("");
    const found = await lookupB2bDemoUserByEmail("owner@demo.lv", repo);
    expect(found).not.toBeNull();
    expect(verifyB2bDemoPassword(created.generatedPassword!, found!.user.passwordHash)).toBe(true);

    const withGiven = await adminCreateB2bDemoTenant(
      {
        name: "Dots Auto",
        slug: "dots-auto",
        ownerEmail: "given@demo.lv",
        ownerPassword: "given-pass-99",
      },
      repo,
    );
    expect(withGiven.generatedPassword).toBeNull();
    const givenFound = await lookupB2bDemoUserByEmail("given@demo.lv", repo);
    expect(verifyB2bDemoPassword("given-pass-99", givenFound!.user.passwordHash)).toBe(true);
  });

  it("admin īpašnieks paliek savā tenantā un dzēšana nenoņem otra indeksu", async () => {
    const repo = createMemoryB2bDemoRepository();
    const a = await createB2bDemoTenantWithOwner(
      {
        name: "A Auto",
        slug: "a-salon",
        ownerEmail: "a@demo.lv",
        ownerName: "A",
        ownerPassword: "password1",
      },
      repo,
    );
    const b = await createB2bDemoTenantWithOwner(
      {
        name: "B Auto",
        slug: "b-salon",
        ownerEmail: "b@demo.lv",
        ownerName: "B",
        ownerPassword: "password2",
      },
      repo,
    );
    await addB2bDemoTenantOrder(a.tenant.tenantId, { clientName: "Klients A", brandModel: "BMW" }, repo);
    await addB2bDemoTenantOrder(b.tenant.tenantId, { clientName: "Klients B", brandModel: "Audi" }, repo);

    const extra = await addB2bDemoTenantOwner(
      a.tenant.tenantId,
      { email: "a2@demo.lv", name: "A2" },
      repo,
    );
    expect(extra.user.role).toBe("owner");
    expect(extra.user.tenantId).toBe(a.tenant.tenantId);
    expect(extra.generatedPassword).toBeTruthy();
    expect(extra.user).not.toHaveProperty("passwordHash");

    const aUsers = await listB2bDemoTenantUsers(a.tenant.tenantId, repo);
    const bUsers = await listB2bDemoTenantUsers(b.tenant.tenantId, repo);
    expect(aUsers.map((u) => u.email).sort()).toEqual(["a2@demo.lv", "a@demo.lv"]);
    expect(bUsers.map((u) => u.email)).toEqual(["b@demo.lv"]);
    expect(aUsers.every((u) => u.tenantId === a.tenant.tenantId)).toBe(true);

    const listed = await listB2bDemoAdminTenants(repo);
    expect(listed).toHaveLength(2);
    const listedA = listed.find((t) => t.tenantId === a.tenant.tenantId);
    expect(listedA?.users.some((u) => u.email === "b@demo.lv")).toBe(false);

    const deleted = await deleteB2bDemoTenant(a.tenant.tenantId, repo);
    expect(deleted.deletedEmails.sort()).toEqual(["a2@demo.lv", "a@demo.lv"]);
    expect(await readB2bDemoTenant(a.tenant.tenantId, repo)).toBeNull();
    expect(await lookupB2bDemoUserByEmail("a@demo.lv", repo)).toBeNull();
    expect(await lookupB2bDemoUserByEmail("a2@demo.lv", repo)).toBeNull();

    const bStill = await lookupB2bDemoUserByEmail("b@demo.lv", repo);
    expect(bStill?.user.tenantId).toBe(b.tenant.tenantId);
    const bOrders = await listB2bDemoTenantOrders(b.tenant.tenantId, repo);
    expect(bOrders).toHaveLength(1);
    expect(bOrders[0]?.clientName).toBe("Klients B");
    expect(await listB2bDemoAdminTenants(repo)).toEqual([
      expect.objectContaining({ tenantId: b.tenant.tenantId, slug: "b-salon" }),
    ]);
  });

  it("indeksa tīrīšana nenoņem sveša tenanta e-pastus", () => {
    const now = "2026-10-16T00:00:00.000Z";
    const index = emptyB2bDemoIndex(now);
    index.tenants = [
      { tenantId: "tnt_aaaaaa", slug: "a", name: "A" },
      { tenantId: "tnt_bbbbbb", slug: "b", name: "B" },
    ];
    index.emailIndex = {
      "a@demo.lv": { tenantId: "tnt_aaaaaa", userId: "usr_aaaaaa" },
      "b@demo.lv": { tenantId: "tnt_bbbbbb", userId: "usr_bbbbbb" },
    };
    const next = removeTenantFromB2bDemoIndex(index, "tnt_aaaaaa", now);
    expect(next.tenants).toEqual([{ tenantId: "tnt_bbbbbb", slug: "b", name: "B" }]);
    expect(next.emailIndex).toEqual({
      "b@demo.lv": { tenantId: "tnt_bbbbbb", userId: "usr_bbbbbb" },
    });
  });

  it("sarakstu ielādē no vieglā indeksa, bez N+1 order JSON", async () => {
    const repo = createMemoryB2bDemoRepository() as MemoryB2bDemoRepository;
    const a = await createB2bDemoTenantWithOwner(
      {
        name: "A Auto",
        slug: "a-fast",
        ownerEmail: "fast@demo.lv",
        ownerName: "A",
        ownerPassword: "password1",
      },
      repo,
    );
    for (let i = 0; i < 12; i += 1) {
      await addB2bDemoTenantOrder(a.tenant.tenantId, { clientName: `K${i}`, brandModel: "BMW", note: `gara piezīme ${i}` }, repo);
    }
    repo.stats.orderRecordReads = 0;
    repo.stats.ordersIndexReads = 0;
    repo.stats.tenantReads = 0;
    const page = await listB2bDemoTenantOrderPage(a.tenant.tenantId, { page: 1, limit: 10 }, repo);
    expect(page.total).toBe(12);
    expect(page.rows).toHaveLength(10);
    expect(page.rows.every((row) => row.tenantId === a.tenant.tenantId)).toBe(true);
    expect(JSON.stringify(page.rows)).not.toContain("gara piezīme");
    expect(repo.stats.ordersIndexReads).toBe(1);
    expect(repo.stats.orderRecordReads).toBe(0);
    expect(repo.stats.tenantReads).toBe(0);
    const first = page.rows[0]!;
    await deleteB2bDemoTenantOrder(a.tenant.tenantId, first.orderId, repo);
    const after = await listB2bDemoTenantOrderPage(a.tenant.tenantId, { page: 1, limit: 20 }, repo);
    expect(after.total).toBe(11);
    expect(after.rows.some((row) => row.orderId === first.orderId)).toBe(false);
  });
});
