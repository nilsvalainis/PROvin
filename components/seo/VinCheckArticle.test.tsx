import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { VinCheckArticle } from "@/components/seo/VinCheckArticle";
import { PublicTopicLinks } from "@/components/seo/PublicTopicLinks";
import { renderHtml, renderText } from "@/lib/test-render";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("VinCheckArticle", () => {
  it("renders history-check copy and locale-safe internal links", () => {
    const html = renderHtml(
      <VinCheckArticle
        h1="VIN koda pārbaude pirms auto pirkuma"
        lead="VIN ir 17 zīmju rūpnīcas identifikācijas numurs."
        sections={[
          { title: "Kas ir VIN koda pārbaude?", body: "VIN koda pārbaude ir auto vēstures pārbaude." },
          { title: "Ko nozīmē auto vēstures pārbaude", body: "Nobraukums, negadījumi un reģistri." },
          { title: "Kur atrast VIN kodu", body: "Vējstikls, durvju aile vai reģistrācijas apliecība." },
        ]}
        links={[
          { href: "/#home-hero", label: "Pasūtīt VIN pārbaudi", primary: true },
          { href: "/pakalpojumi", label: "Skatīt pakalpojumus un cenas" },
          { href: "/vin-dekoders", label: "Bezmaksas VIN dekoders" },
          { href: "/biezi-jautajumi", label: "Biežāk uzdotie jautājumi" },
        ]}
      />,
    );
    const text = renderText(
      <VinCheckArticle
        h1="VIN koda pārbaude pirms auto pirkuma"
        lead="VIN ir 17 zīmju rūpnīcas identifikācijas numurs."
        sections={[
          { title: "Kas ir VIN koda pārbaude?", body: "VIN koda pārbaude ir auto vēstures pārbaude." },
          { title: "Ko nozīmē auto vēstures pārbaude", body: "Nobraukums, negadījumi un reģistri." },
        ]}
        links={[{ href: "/vin-dekoders", label: "Bezmaksas VIN dekoders" }]}
      />,
    );

    expect(text).toContain("VIN koda pārbaude pirms auto pirkuma");
    expect(text).toContain("Ko nozīmē auto vēstures pārbaude");
    expect(html).toContain('href="/vin-dekoders"');
    expect(html).toContain('href="/pakalpojumi"');
    expect(html).toContain('href="/biezi-jautajumi"');
    expect(html).not.toContain("http://");
    expect(html).not.toContain("provin.lv");
    expect(html).not.toContain("/paraugi");
  });
});

describe("PublicTopicLinks", () => {
  it("points the homepage VIN guide at the locale-safe path", () => {
    const html = renderHtml(
      <PublicTopicLinks
        links={[
          { href: "/vin-koda-parbaude", label: "Kā notiek VIN koda pārbaude", primary: true },
          { href: "/vin-koda-parbaude", label: "Auto vēstures pārbaude" },
        ]}
      />,
    );
    expect(html).toContain('href="/vin-koda-parbaude"');
    expect(html).toContain("Auto vēstures pārbaude");
    expect(html).not.toContain("https://provin.lv");
    expect(html).not.toContain("http://");
  });
});
