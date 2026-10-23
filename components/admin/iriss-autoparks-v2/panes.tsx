"use client";

import type { CabinetPanes } from "./AutoparksV2Cabinet";
import { AutoparksV2Iegade } from "./AutoparksV2Iegade";
import { AutoparksV2CenuLapa } from "./AutoparksV2CenuLapa";
import { AutoparksV2Izdevumi } from "./AutoparksV2Izdevumi";
import { AutoparksV2Serviss } from "./AutoparksV2Serviss";

/** Kabineta cilnes pa fāzēm; cilne parādās tikai, ja te ir komponente UN lietotājam ir tiesība. */
export const CABINET_PANES: CabinetPanes = {
  iegade: (p) => <AutoparksV2Iegade {...p} />,
  serviss: (p) => <AutoparksV2Serviss {...p} />,
  izdevumi: (p) => <AutoparksV2Izdevumi {...p} />,
  cenu_lapa: (p) => <AutoparksV2CenuLapa {...p} />,
};
