"use client";

import { AdminVendorAvotuSourceBlock } from "@/components/admin/AdminVendorAvotuSourceBlock";
import type { CitiAvotiBlockState } from "@/lib/admin-source-blocks";

type Props = {
  value: CitiAvotiBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: CitiAvotiBlockState) => void;
};

/** Citi avoti — tā pati struktūra kā AutoDNA / CarVertical (nobraukums + negadījumi + komentāri). */
export function AdminCitiAvotiSourceBlock({ value, readOnly, disabled, onChange }: Props) {
  return (
    <AdminVendorAvotuSourceBlock
      blockKey="citi_avoti"
      value={value}
      readOnly={readOnly}
      disabled={disabled}
      onChange={onChange}
    />
  );
}
