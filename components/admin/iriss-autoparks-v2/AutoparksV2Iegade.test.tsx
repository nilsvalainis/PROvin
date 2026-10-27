import { describe, expect, it } from "vitest";
import {
  AutoparksV2CsddDocBadge,
  AutoparksV2IegadeFiles,
  CSDD_DOC_BADGE_SRC,
  CSDD_DOC_BADGE_TITLE,
} from "@/components/admin/iriss-autoparks-v2/AutoparksV2Iegade";
import type { V2IegadeFile } from "@/lib/iriss-autoparks-v2-iegade-files";
import { renderHtml, renderText } from "@/lib/test-render";

const file = (extra: Partial<V2IegadeFile> & Pick<V2IegadeFile, "id" | "title" | "csddBadge">): V2IegadeFile => ({
  tag: "Dokuments",
  date: "2026-10-24",
  contentType: "application/pdf",
  link: false,
  editable: false,
  type: "",
  ...extra,
});

const files: V2IegadeFile[] = [
  file({ id: "c:inv", tag: "Rēķins", title: "Auto1 Car Invoice", csddBadge: true, type: "car_invoice" }),
  file({ id: "c:cmr", tag: "CMR", title: "CMR", date: "2026-10-25", csddBadge: false, type: "cmr" }),
  file({ id: "c:pic", tag: "Pickup", title: "Pickup Authorization", csddBadge: false, type: "pickup_pdf" }),
];

function card(html: string, title: string): string {
  return html.split('class="ap2-fl"').find((part) => part.includes(`<b>${title}</b>`)) ?? "";
}

describe("Autoparks v2 Iegādes CSDD badge", () => {
  it("rāda oriģinālo CSDD logo tikai pie Car Invoice nosaukuma", () => {
    const html = renderHtml(<AutoparksV2IegadeFiles files={files} onOpen={() => undefined} />);
    const invoice = card(html, "Auto1 Car Invoice");
    const cmr = card(html, "CMR");
    const pickup = card(html, "Pickup Authorization");

    expect(invoice).toContain(`src="${CSDD_DOC_BADGE_SRC}"`);
    expect(invoice).toContain(`title="${CSDD_DOC_BADGE_TITLE}"`);
    expect(invoice).toContain('alt="CSDD"');
    expect(invoice).toMatch(/ap2-fl-title[\s\S]*Auto1 Car Invoice[\s\S]*ap2-csdd-badge/);
    expect((invoice.split('class="pv"')[1] ?? "").split('class="m"')[0] ?? "").not.toContain("ap2-csdd-badge");

    expect(cmr).toContain("CMR");
    expect(cmr).not.toContain("ap2-csdd-badge");
    expect(pickup).not.toContain("ap2-csdd-badge");
    expect(html.match(/ap2-csdd-badge/g)?.length).toBe(1);
  });

  it("tooltip un redzamais teksts nesaka CSDD ✓", () => {
    const html = renderHtml(<AutoparksV2CsddDocBadge />);
    expect(html).toContain(`title="${CSDD_DOC_BADGE_TITLE}"`);
    expect(renderText(<AutoparksV2IegadeFiles files={files} onOpen={() => undefined} />)).not.toContain("CSDD ✓");
  });
});
