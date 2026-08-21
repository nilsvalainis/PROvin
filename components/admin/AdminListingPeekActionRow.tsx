"use client";

import { AdminAdifyHistoryButton } from "@/components/admin/AdminAdifyHistoryButton";
import { adminActionPillBase } from "@/components/admin/adminActionPill";
import { AdminWhatsAppOpenButton } from "@/components/admin/AdminWhatsAppOpenButton";
import { SOURCE_BLOCK_EXTERNAL_URL } from "@/lib/admin-source-blocks";
import { canonicalizeListingUrl } from "@/lib/order-field-validation";

type Props = {
  listingUrl: string;
  phone: string;
};

export function AdminListingPeekActionRow({ listingUrl, phone }: Props) {
  const url = canonicalizeListingUrl(listingUrl);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <a
        href={SOURCE_BLOCK_EXTERNAL_URL.csdd}
        target="_blank"
        rel="noopener noreferrer"
        className={`${adminActionPillBase} bg-emerald-800 hover:bg-emerald-900 focus-visible:ring-emerald-700`}
        title="e.csdd.lv — transportlīdzekļa dati"
      >
        CSDD
      </a>
      <a
        href={SOURCE_BLOCK_EXTERNAL_URL.ltab}
        target="_blank"
        rel="noopener noreferrer"
        className={`${adminActionPillBase} bg-red-800 hover:bg-red-900 focus-visible:ring-red-700`}
        title="LTAB — OCTA un zaudējumu dati"
      >
        LTAB
      </a>
      <AdminAdifyHistoryButton listingUrl={url} />
      <AdminWhatsAppOpenButton phone={phone} variant="pill" />
    </div>
  );
}
