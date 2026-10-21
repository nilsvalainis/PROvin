"use client";

import { IrissWaybillGauges } from "@/components/admin/IrissWaybillGauges";

/** Datora sānjosla: tās pašas 3 pavadzīmes kā telefona izvēlnē (apļi, 48 h skala, detaļas pēc klikšķa). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `limit` vairs nav vajadzīgs: vienmēr 3 zīmes
export function IrissPavadzimesSidebarCard(_props: { limit?: number } = {}) {
  return <IrissWaybillGauges size="sidebar" />;
}
