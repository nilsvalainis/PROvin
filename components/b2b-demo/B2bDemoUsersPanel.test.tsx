import { describe, expect, it } from "vitest";
import { B2bDemoUsersPanel } from "@/components/b2b-demo/B2bDemoUsersPanel";
import { renderHtml, renderText } from "@/lib/test-render";

describe("B2B demo lietotāju saraksts", () => {
  it("bez lietotājiem rāda «Nav lietotāju»", () => {
    expect(renderHtml(<B2bDemoUsersPanel users={[]} />)).toContain('data-testid="b2b-users-empty"');
    expect(renderText(<B2bDemoUsersPanel users={[]} />)).toContain("Nav lietotāju");
  });

  it("ar lietotājiem tukšā stāvokļa nav", () => {
    const users = [{ userId: "u1", email: "tests@example.com", name: "TESTS Lietotājs", role: "owner" }] as Parameters<typeof B2bDemoUsersPanel>[0]["users"];
    const text = renderText(<B2bDemoUsersPanel users={users} />);
    expect(text).toContain("TESTS Lietotājs");
    expect(text).not.toContain("Nav lietotāju");
  });
});
