import { generateB2bDemoPassword, isUsableB2bDemoPassword } from "@/lib/b2b-demo-users";
import { isValidOrderEmail } from "@/lib/order-field-validation";
import { normalizeB2bDemoEmail } from "@/lib/b2b-demo-ids";

const DEV_SEED_EMAIL = "demo@provin.lv";

let cachedDevSeedPassword: string | null = null;

function isProductionRuntime(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production" && env.VERCEL_ENV === "production";
}

function isProductionLike(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

function resolveDevOnlySeedPassword(): string {
  if (!cachedDevSeedPassword) {
    cachedDevSeedPassword = generateB2bDemoPassword();
    console.info("[b2b-demo] B2B_DEMO_SEED_PASSWORD is unset; using a random dev-only seed password.");
  }
  return cachedDevSeedPassword;
}

export function readB2bDemoSeedCredentials(env: NodeJS.ProcessEnv = process.env): {
  email: string;
  password: string;
  companyName: string;
} | null {
  const email = normalizeB2bDemoEmail(env.B2B_DEMO_SEED_EMAIL ?? "");
  const password = env.B2B_DEMO_SEED_PASSWORD ?? "";
  if (email && isValidOrderEmail(email) && isUsableB2bDemoPassword(password)) {
    return {
      email,
      password,
      companyName: (env.B2B_DEMO_SEED_COMPANY ?? "").trim() || "Demo dīleris",
    };
  }
  if (isProductionRuntime(env)) return null;
  if (isProductionLike(env) && env.VERCEL_ENV === "production") return null;
  if (env.NODE_ENV === "production" && env.VERCEL_ENV === "preview" && env.B2B_DEMO_PREVIEW_SEED !== "1") {
    return null;
  }
  if (!isProductionLike(env)) {
    return { email: DEV_SEED_EMAIL, password: resolveDevOnlySeedPassword(), companyName: "Demo dīleris" };
  }
  return null;
}

export function b2bDemoDevLoginPrefill(env: NodeJS.ProcessEnv = process.env): { email: string; password: string } | null {
  if (isProductionLike(env)) return null;
  const seed = readB2bDemoSeedCredentials(env);
  return seed ? { email: seed.email, password: seed.password } : null;
}
