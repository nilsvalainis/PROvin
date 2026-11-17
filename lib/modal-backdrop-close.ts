/**
 * Modāla fona (backdrop) klikšķa noteikums: aizver TIKAI, ja mousedown UN mouseup abi bija
 * tieši uz fona, nevis uz loga satura. Tas pasargā no gadījuma, kad lietotājs iezīmē/vilk
 * tekstu logā un pele atraujas ārpus loga - pārlūkā šāds "click" notiek uz fona elementa,
 * bet tas nav lietotāja nodoms aizvērt logu.
 */
export function shouldCloseModalBackdrop(input: {
  mouseDownOnBackdrop: boolean;
  mouseUpOnBackdrop: boolean;
  enabled: boolean;
}): boolean {
  return input.enabled && input.mouseDownOnBackdrop && input.mouseUpOnBackdrop;
}
