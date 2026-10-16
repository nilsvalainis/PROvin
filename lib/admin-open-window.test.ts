import { afterEach, describe, expect, it, vi } from "vitest";
import { isStandaloneDisplayMode, openPrintHtmlAfterReady, openWindowSyncThen, schedulePrintOnWindow } from "@/lib/admin-open-window";

type FakeWindow = {
  closed: boolean;
  location: { href: string; assign: (url: string) => void };
  document: { open: () => void; write: (html: string) => void; close: () => void; html: string };
  close: () => void;
  open: ReturnType<typeof vi.fn>;
  matchMedia: (q: string) => { matches: boolean };
  navigator: Navigator & { standalone?: boolean };
  addEventListener?: ReturnType<typeof vi.fn>;
  focus?: ReturnType<typeof vi.fn>;
  print?: ReturnType<typeof vi.fn>;
};

function installWindow(opts: { popup: FakeWindow | null; standalone?: boolean }) {
  const assigned: string[] = [];
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
    matchMedia: () => ({ matches: opts.standalone === true }),
    navigator: { standalone: opts.standalone === true } as Navigator & { standalone?: boolean },
  };
  vi.stubGlobal("window", host);
  vi.stubGlobal("document", host.document);
  return { host, assigned };
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
});

describe("openPrintHtmlAfterReady", () => {
  it("atver logu tikai ar gatavu HTML, nevis tukšu about:blank pirms satura", () => {
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
      addEventListener: vi.fn(),
      focus: vi.fn(),
      print: vi.fn(),
    };
    const { host } = installWindow({ popup });
    host.open = vi.fn(() => popup);
    const w = openPrintHtmlAfterReady("<p>Atskaite</p>");
    expect(host.open).toHaveBeenCalledWith("", "_blank");
    expect(host.open).not.toHaveBeenCalledWith("about:blank", "_blank");
    expect(popup.document.html).toBe("<p>Atskaite</p>");
    expect(w).toBe(popup);
    schedulePrintOnWindow(w as unknown as Window, "Captur.pdf");
    expect(popup.addEventListener).toHaveBeenCalled();
  });
});
