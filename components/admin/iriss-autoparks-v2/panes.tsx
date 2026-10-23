"use client";

import type { CabinetPanes } from "./AutoparksV2Cabinet";
import { AutoparksV2Iegade } from "./AutoparksV2Iegade";

/** Kabineta cilnes pa fāzēm; cilne parādās tikai, ja te ir komponente UN lietotājam ir tiesība. */
export const CABINET_PANES: CabinetPanes = {
  iegade: (p) => <AutoparksV2Iegade {...p} />,
};
