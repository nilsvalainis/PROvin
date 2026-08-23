import { readFileSync } from "node:fs";
import { join } from "node:path";

let cached: string | null = null;

/** Fotoreālistiskais auto no augšas — viena data-URI PDF CSS. */
export function damageCarTopDataUri(): string {
  if (cached) return cached;
  const file = join(process.cwd(), "public/brand/damage-car-top.jpg");
  cached = `data:image/jpeg;base64,${readFileSync(file).toString("base64")}`;
  return cached;
}

export const DAMAGE_CAR_TOP_PUBLIC_HREF = "/brand/damage-car-top.jpg";
