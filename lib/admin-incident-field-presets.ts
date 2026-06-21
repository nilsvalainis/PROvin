/** Admin negadījumu tabulu lauku ātrā aizpildīšana, kad avots neatgriež datus. */
export const ADMIN_INCIDENT_DATA_UNAVAILABLE = "Dati nav pieejami";

export function isIncidentDataUnavailableText(value: string): boolean {
  return value.trim() === ADMIN_INCIDENT_DATA_UNAVAILABLE;
}
