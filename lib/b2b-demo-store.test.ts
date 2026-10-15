import { describe, expect, it } from "vitest";
import { B2bDemoIsolationError } from "./b2b-demo-isolation";
import {
  addB2bDemoTenantEmployee,
  addB2bDemoTenantOrder,
  createB2bDemoTenantWithOwner,
  createMemoryB2bDemoRepository,
  listB2bDemoTenantOrders,
  writeB2bDemoTenantSettings,
} from "./b2b-demo-store";

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
    await addB2bDemoTenantOrder(a.tenant.tenantId, { clientName: "Klients A", brandModel: "BMW" }, repo);
    await addB2bDemoTenantOrder(b.tenant.tenantId, { clientName: "Klients B", brandModel: "Audi" }, repo);

    const aOrders = await listB2bDemoTenantOrders(a.tenant.tenantId, repo);
    const bOrders = await listB2bDemoTenantOrders(b.tenant.tenantId, repo);
    expect(aOrders).toHaveLength(1);
    expect(aOrders[0]?.clientName).toBe("Klients A");
    expect(aOrders[0]?.tenantId).toBe(a.tenant.tenantId);
    expect(bOrders[0]?.clientName).toBe("Klients B");
    expect(aOrders.some((o) => o.tenantId === b.tenant.tenantId)).toBe(false);

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
});
