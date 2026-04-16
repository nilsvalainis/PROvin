import "server-only";

/**
 * Publiskās / admin statistikas saites no env — bez slepenām atslēgām.
 * `NEXT_PUBLIC_ANALYTICS_EMBED_URL` — https iframe (piem. Plausible „share” / embed).
 */

function safeHttpsUrl(raw: string | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function getAnalyticsDashboardUrl(): string | null {
  return safeHttpsUrl(process.env.NEXT_PUBLIC_ANALYTICS_DASHBOARD_URL);
}

export function getAnalyticsEmbedUrl(): string | null {
  return safeHttpsUrl(process.env.NEXT_PUBLIC_ANALYTICS_EMBED_URL);
}

export function isVercelDeployment(): boolean {
  return process.env.VERCEL === "1";
}
