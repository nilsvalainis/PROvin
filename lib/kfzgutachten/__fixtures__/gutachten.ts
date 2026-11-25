/** Izdomāts §57a atzinums (struktūra kā kfzgutachten.at PDF, dati izdomāti). */
export const FAKE_VIN = "WVWZZZ1KZ6W000001";

export const GUTACHTEN_LINES = `Adresse:   Tel.:   ZVR Nummer:
 E-Mail:   Fax:   (9)   Bgst. Nr.
 Gutachten gemäß § 57a Abs. 4 KFG 1967   Gutachten-Nr.   11112222
 Die Prüfung des Fahrzeuges erfolgte ohne Zerlegungsarbeiten.
 1   /   1
 Letzte Begutachtung:   Gutachten-Nr.   10001000   Datum   02.10.2021   KM-Stand   151200
 (2)   Kennzeichen   GU 123AB   Marke   VW   Hubraum   1968 ccm
 (1)   Fahrgestell-Nr.   ${FAKE_VIN}   Type   1K   (4)   KM-Stand   163450
 (5)   Fahrzeugklasse   M1   Erstzulassung   15.03.2006
 Zulassungsbesitzer   Prüfgewicht   1450 kg   Techn. zul. Gesamtmasse   0 kg
 (6)   An ihrem Fahrzeug wurden folgende Daten und Mängel festgestellt
 1.2 Betriebsbremse Wirkung und Wirksamkeit
 Achse   Wirkung (kN)   Achse   Wirkung (kN)   Eigengewicht   Wirkung (%)
 1   L 3,10   R 3,05   2   L 2,00   R 2,10   BBA   70,10
 1.1 Mechanischer Zustand und Funktion / 1.1.14 Bremsscheiben   schwerer Mangel
 (10)   Bemerkung:   Bremsscheibe hinten stark verschlissen
 5.1 Achsen / 5.1.1 Achsen / Achskörper
 (10)   Bemerkung:   angerostet
 5.3 Aufhängung / 5.3.4 Aufhängungsgelenke   leichter Mangel
 (10)   Bemerkung:   Abdichtung porös
 Prüfumfang gemäß PBStV Anlage 6
 (7)   Das Fahrzeug entspricht den Erfordernissen der Umwelt,
 der Verkehrs- und Betriebssicherheit:   schwere Mängel
 Das Fahrzeug erhält folgende Begutachtungsplakette:   Farbe:   grün   Nr.: TST0001
 (8)   Nächste Begutachtung   10.2023   (9)   Erstellt durch
 (3)   Prüfort
 (3)   Druckdatum/Zeit   05.10.2022 10:15
 (9)   Prüfstelle
`;

/** Tas pats, kā pdf-parse to salīmē (bez atstarpēm). */
export const GUTACHTEN_GLUED = GUTACHTEN_LINES.split("\n")
  .map((l) => l.replace(/\s+/g, ""))
  .join("\n");

/** Otrs izdomāts atzinums ar citu numurzīmi (vienā PDF ar pirmo). */
export const GUTACHTEN_OLDER = GUTACHTEN_LINES.replace("11112222", "10001000")
  .replace(/Letzte Begutachtung:[^\n]*\n/, "")
  .replace("GU 123AB", "W 55555X")
  .replace("163450", "151200")
  .replace("05.10.2022 10:15", "02.10.2021 09:00")
  .replace("schwere Mängel", "leichte Mängel")
  .replace(/ 1\.1 Mechanischer[^\n]*\n[^\n]*\n/, "");
