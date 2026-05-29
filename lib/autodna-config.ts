import "server-only";

export type AutodnaConfig = {
  baseUrl: string;
  email: string;
  apiKey: string;
};

/** Vai produkcijā ir aizpildīti visi autoDNA API env (bez izsaukuma). */
export function isAutodnaApiConfigured(): boolean {
  return readAutodnaEnvConfig() !== null;
}

export function readAutodnaEnvConfig(): AutodnaConfig | null {
  const baseRaw = process.env.AUTODNA_API_URL?.trim();
  const email = process.env.AUTODNA_EMAIL?.trim();
  const apiKey = process.env.AUTODNA_API_KEY?.trim();
  if (!baseRaw || !email || !apiKey) return null;
  const baseUrl = baseRaw.endsWith("/") ? baseRaw : `${baseRaw}/`;
  return { baseUrl, email, apiKey };
}
