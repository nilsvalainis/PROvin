import { B2bPartnerHero } from "@/components/b2b/B2bPartnerHero";
import { B2bPartnerCatalog } from "@/components/b2b/B2bPartnerCatalog";
import { homeFooterColumnClass } from "@/lib/home-layout";

export function B2bPartnerPreview() {
  return (
    <>
      <B2bPartnerHero />
      <div className={homeFooterColumnClass}>
        <B2bPartnerCatalog plan="business" />
      </div>
    </>
  );
}
