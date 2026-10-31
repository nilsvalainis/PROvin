import { afterEach, describe, expect, it } from "vitest";
import { isolateElementForPrint, LOGISTICS_PRINT_HOST_CLASS } from "@/lib/iriss-logistics-map-print";

/** Minimāls DOM bez jsdom: tikai tas, ko lieto isolateElementForPrint. */
class FakeEl {
  className = "";
  children: FakeEl[] = [];
  parentElement: FakeEl | null = null;
  constructor(public tagName = "DIV") {}
  get parentNode() {
    return this.parentElement;
  }
  get nextSibling(): FakeEl | null {
    const p = this.parentElement;
    if (!p) return null;
    return p.children[p.children.indexOf(this) + 1] ?? null;
  }
  appendChild(child: FakeEl) {
    child.parentElement?.removeChild(child);
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  insertBefore(child: FakeEl, ref: FakeEl | null) {
    child.parentElement?.removeChild(child);
    child.parentElement = this;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(child);
    else this.children.splice(i, 0, child);
    return child;
  }
  removeChild(child: FakeEl) {
    this.children = this.children.filter((c) => c !== child);
    child.parentElement = null;
  }
  remove() {
    this.parentElement?.removeChild(this);
  }
}

const g = globalThis as unknown as { document?: unknown };
const prevDocument = g.document;
afterEach(() => {
  g.document = prevDocument;
});

describe("Nils 31.10: Loģistikas druka - karte ārpus admin čaulas", () => {
  it("drukas laikā bloks ir tieši zem <body>, pēc drukas atgriežas tajā pašā vietā", () => {
    const body = new FakeEl("BODY");
    const shell = body.appendChild(new FakeEl());
    const card = shell.appendChild(new FakeEl());
    const toolbar = card.appendChild(new FakeEl());
    const root = card.appendChild(new FakeEl());
    const after = card.appendChild(new FakeEl());
    g.document = { body, createElement: (t: string) => new FakeEl(t.toUpperCase()) };

    const restore = isolateElementForPrint(root as unknown as HTMLElement);
    const host = body.children.at(-1)!;
    expect(host.className).toBe(LOGISTICS_PRINT_HOST_CLASS);
    expect(root.parentElement).toBe(host);
    expect(card.children).toEqual([toolbar, after]);

    restore();
    expect(card.children).toEqual([toolbar, root, after]);
    expect(body.children).toEqual([shell]);
  });
});
