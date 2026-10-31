import { afterEach, describe, expect, it } from "vitest";
import { isolateElementForPrint } from "@/lib/iriss-logistics-map-print";

/** Minimāls DOM bez jsdom: tikai tas, ko lieto isolateElementForPrint. */
class FakeStyle {
  display = "";
  props = new Map<string, string>();
  setProperty(k: string, v: string) {
    this.props.set(k, v);
  }
}
class FakeEl {
  style = new FakeStyle();
  children: FakeEl[] = [];
  parentElement: FakeEl | null = null;
  attrs = new Map<string, string>();
  constructor(public tagName = "DIV") {}
  add(child: FakeEl) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  getAttribute(k: string) {
    return this.attrs.get(k) ?? null;
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
    if (k === "style") this.style = new FakeStyle();
  }
  removeAttribute(k: string) {
    this.attrs.delete(k);
    if (k === "style") this.style = new FakeStyle();
  }
}

const g = globalThis as unknown as { HTMLElement?: unknown; document?: unknown };
const prevHTMLElement = g.HTMLElement;
const prevDocument = g.document;

afterEach(() => {
  g.HTMLElement = prevHTMLElement;
  g.document = prevDocument;
});

describe("Nils 31.10: Loģistikas druka - karte bez admin čaulas atkāpēm", () => {
  it("paslēpj blakus elementus, neitralizē priekštečus un pēc drukas visu atjauno", () => {
    const body = new FakeEl("BODY");
    const shell = body.add(new FakeEl());
    shell.setAttribute("style", "padding-left: 260px");
    const sidebar = shell.add(new FakeEl("ASIDE"));
    const main = shell.add(new FakeEl("MAIN"));
    const root = main.add(new FakeEl());
    const toolbar = main.add(new FakeEl());
    g.HTMLElement = FakeEl;
    g.document = { body };

    const restore = isolateElementForPrint(root as unknown as HTMLElement);
    expect(sidebar.style.display).toBe("none");
    expect(toolbar.style.display).toBe("none");
    expect(main.style.props.get("padding")).toBe("0");
    expect(main.style.props.get("position")).toBe("static");
    expect(shell.style.props.get("background")).toBe("none");
    expect(shell.style.props.get("overflow")).toBe("visible");
    expect(body.style.props.size).toBe(0);

    restore();
    expect(sidebar.style.display).toBe("");
    expect(shell.getAttribute("style")).toBe("padding-left: 260px");
    expect(main.getAttribute("style")).toBeNull();
  });
});
