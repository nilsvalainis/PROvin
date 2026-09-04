"use client";

import { B2bPartnerCatalog } from "@/components/b2b/B2bPartnerCatalog";
import { B2bPartnerHero } from "@/components/b2b/B2bPartnerHero";

export function B2bPartnerPreview() {
  return (
    <>
      <B2bPartnerHero />
      <B2bPartnerCatalog />
    </>
  );
}
