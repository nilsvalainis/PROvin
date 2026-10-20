/**
 * CSDD raw fixtures: imported cars where PDF only has „Pirmā reģistrācija Latvijā”.
 */

/** BMW 640i, VIN WBALW3C59CC891863 - būvēts 2011, ASV 01.2012, LV 02.10.2026. */
export const BMW_640I_VIN = "WBALW3C59CC891863";

export const BMW_640I_CSDD_RAW = `
Reģistrācijas numurs AB1234
Statuss Uzskaitē
Marka Modelis BMW 640I
VIN ${BMW_640I_VIN}
Izlaiduma gads 2011
Degviela Benzīns
Iepriekšējās reģistrācijas valsts LIETUVA
Transportlīdzekļa reģistrācija
02.10.2026 - Pirmā reģistrācija Latvijā
Pēdējā tehniskā apskate
TA datums 02.10.2026
Nākošā TA 02.10.2028
Odometra rādījums 192100
Nobraukuma vēsture
Nobraukums, datums
192100- 02.10.2026
`.trim();

/** Porsche Panamera, VIN WP0ZZZ97ZLL145664 - izlaiduma gads 2020, LV pēc importa. */
export const PANAMERA_VIN = "WP0ZZZ97ZLL145664";

export const PANAMERA_CSDD_RAW = `
Reģistrācijas numurs CD5678
Statuss Uzskaitē
Marka Modelis PORSCHE PANAMERA
VIN ${PANAMERA_VIN}
Izlaiduma gads 2020
Degviela Benzīns
Iepriekšējās reģistrācijas valsts VĀCIJA
Transportlīdzekļa reģistrācija
15.03.2025 - Pirmā reģistrācija Latvijā
15.06.2025 - Īpašnieka maiņa
Pēdējā tehniskā apskate
TA datums 15.03.2025
Nākošā TA 15.03.2027
Odometra rādījums 68400
Nobraukuma vēsture
Nobraukums, datums
68400- 15.03.2025
`.trim();
