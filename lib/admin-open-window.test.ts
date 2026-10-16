import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isStandaloneDisplayMode,
  openGeneratedFileUrl,
  openGeneratedHtmlDocument,
  openWindowSyncThen,
} from "@/lib/admin-open-window";

type FakeWindow = {
  closed: boolean;
  location: { href: string; assign: (url: string) => void };
  document: { open: () => void; write: (html: string) => void; close: () => void; html: string };
  close: () => void;
  open: ReturnType<typeof vi.fn>;
  setTimeout?: typeof setTimeout;
  matchMedia: (q: string) => { matches: boolean };
  navigator: Navigator & { standalone?: boolean };
};

function installWindow(opts: { popup: FakeWindow | null; standalone?: boolean }) {
  const assigned: string[] = [];
  const downloads: string[] = [];
  const host: FakeWindow = {
    closed: false,
    location: {
      href: "https://provin.lv/admin",
      assign(url: string) {
        assigned.push(url);
        this.href = url;
      },
    },
    document: {
      html: "",
      open() {},
      write(html: string) {
        this.html = html;
      },
      close() {},
    },
    close() {
      this.closed = true;
    },
    open: vi.fn(() => opts.popup),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    matchMedia: () => ({ matches: opts.standalone === true }),
    navigator: { standalone: opts.standalone === true } as Navigator & { standalone?: boolean },
  };
  const fakeDoc = {
    ...host.document,
    body: {
      appendChild(el: { click?: () => void }) {
        return el;
      },
    },
    createElement(tag: string) {
      const el = {
        href: "",
        download: "",
        rel: "",
        target: "",
        click() {
          if (tag === "a") downloads.push(el.download || el.href);
        },
        remove() {},
      };
      return el;
    },
  };
  vi.stubGlobal("window", { ...host, URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} } });
  vi.stubGlobal("document", fakeDoc);
  vi.stubGlobal("URL", { createObjectURL: () => "blob:test", revokeObjectURL() {} });
  return { host, assigned, downloads };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("openWindowSyncThen", () => {
  it("atver tukšu logu sinhroni un pēc tam iestata URL", () => {
    const popup: FakeWindow = {
      closed: false,
      location: { href: "about:blank", assign: vi.fn() },
      document: { html: "", open() {}, write() {}, close() {} },
      close: vi.fn(),
      open: vi.fn(),
      matchMedia: () => ({ matches: false }),
      navigator: {} as Navigator,
    };
    const { host } = installWindow({ popup });
    const opened = openWindowSyncThen();
    expect(host.open).toHaveBeenCalledWith("about:blank", "_blank");
    opened.navigate("https://wa.me/37120000000");
    expect(popup.location.href).toBe("https://wa.me/37120000000");
  });

  it("standalone PWA bez loga lieto location.assign", () => {
    const { host, assigned } = installWindow({ popup: null, standalone: true });
    expect(isStandaloneDisplayMode()).toBe(true);
    const opened = openWindowSyncThen();
    opened.navigate("https://wa.me/37061234567");
    expect(assigned).toEqual(["https://wa.me/37061234567"]);
    expect(host.location.href).toBe("https://wa.me/37061234567");
  });

  it("bez standalone un bez loga URL neaizstāj pašreizējo lapu", () => {
    const { host, assigned } = installWindow({ popup: null, standalone: false });
    const opened = openWindowSyncThen();
    opened.navigate("https://wa.me/4915112345678");
    expect(assigned).toEqual([]);
    expect(host.location.href).toBe("https://provin.lv/admin");
    expect(host.open).toHaveBeenCalledTimes(2);
  });

  it("ieraksta HTML iepriekš atvērtajā logā", () => {
    const popup: FakeWindow = {
      closed: false,
      location: { href: "about:blank", assign: vi.fn() },
      document: {
        html: "",
        open() {},
        write(html: string) {
          this.html = html;
        },
        close() {},
      },
      close() {
        this.closed = true;
      },
      open: vi.fn(),
      matchMedia: () => ({ matches: false }),
      navigator: {} as Navigator,
    };
    installWindow({ popup });
    const opened = openWindowSyncThen();
    expect(opened.writeHtml("<p>PDF</p>")).toBe(true);
    expect(popup.document.html).toBe("<p>PDF</p>");
    opened.close();
    expect(popup.closed).toBe(true);
  });

  it("standalone PWA bez loga neaizstāj admin lapu ar writeHtml", () => {
    const { host, assigned } = installWindow({ popup: null, standalone: true });
    const opened = openWindowSyncThen();
    expect(opened.writeHtml("<p>PDF</p>")).toBe(false);
    expect(assigned).toEqual([]);
    expect(host.location.href).toBe("https://provin.lv/admin");
  });
});

describe("openGeneratedHtmlDocument", () => {
  it("ģenerē, tad raksta jaunā logā, bez about:blank pirms satura", () => {
    const popup: FakeWindow = {
      closed: false,
      location: { href: "about:blank", assign: vi.fn() },
      document: {
        html: "",
        open() {},
        write(html: string) {
          this.html = html;
        },
        close() {},
      },
      close: vi.fn(),
      open: vi.fn(),
      matchMedia: () => ({ matches: false }),
      navigator: {} as Navigator,
    };
    const { host } = installWindow({ popup });
    const opened = openGeneratedHtmlDocument("<p>Atskaites HTML</p>", "atskaite.html");
    expect(host.open).toHaveBeenCalledWith("", "_blank");
    expect(opened.opened).toBe(true);
    expect(popup.document.html).toBe("<p>Atskaites HTML</p>");
  });

  it("standalone PWA bez loga lejupielādē un neaizstāj admin lapu", () => {
    const { host, assigned, downloads } = installWindow({ popup: null, standalone: true });
    const opened = openGeneratedHtmlDocument("<p>PDF</p>", "atskaite.html");
    expect(opened.opened).toBe(true);
    expect(opened.window).toBeNull();
    expect(assigned).toEqual([]);
    expect(host.location.href).toBe("https://provin.lv/admin");
    expect(downloads).toEqual(["atskaite.html"]);
  });
});

describe("openGeneratedFileUrl", () => {
  it("atver gatavu URL jaunā logā", () => {
    const popup: FakeWindow = {
      closed: false,
      location: { href: "about:blank", assign: vi.fn() },
      document: { html: "", open() {}, write() {}, close() {} },
      close: vi.fn(),
      open: vi.fn(),
      matchMedia: () => ({ matches: false }),
      navigator: {} as Navigator,
    };
    const { host } = installWindow({ popup });
    expect(openGeneratedFileUrl("blob:pdf")).toBe(true);
    expect(host.open).toHaveBeenCalledWith("blob:pdf", "_blank");
  });
});
