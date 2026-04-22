/**
 * Uzņēmuma rekvizīti distances līgumam un GDPR (jāaizpilda .env / hosting vidē).
 */
export type CompanyLegal = {
  /** Pilns juridiskais nosaukums (SIA / IK) */
  legalName: string;
  /** Reģistrācijas numurs */
  regNo: string;
  /** Juridiskā adrese viena rindiņā */
  legalAddress: string;
  /** Vai visi trīs lauki aizpildīti no vides mainīgajiem (nevis noklusējumi) */
  isComplete: boolean;
};

const FALLBACK_COMPANY_LEGAL_NAME = "Nils Valainis";
const FALLBACK_COMPANY_REG_NO = "09118711109";
const FALLBACK_COMPANY_LEGAL_ADDRESS = "Jana iela 3, Tukums, LV3101, Latvija";

export function getCompanyLegal(): CompanyLegal {
  const envName = process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME?.trim();
  const envReg = process.env.NEXT_PUBLIC_COMPANY_REG_NO?.trim();
  const envAddr = process.env.NEXT_PUBLIC_COMPANY_LEGAL_ADDRESS?.trim();
  const legalName = envName || FALLBACK_COMPANY_LEGAL_NAME;
  const regNo = envReg || FALLBACK_COMPANY_REG_NO;
  const legalAddress = envAddr || FALLBACK_COMPANY_LEGAL_ADDRESS;
  const isComplete = Boolean(envName && envReg && envAddr);
  return { legalName, regNo, legalAddress, isComplete };
}

/** Publiskais pakalpojuma zīmols (likumiski — blakus jānorāda juridiskā persona rekvizītos). */
export function getCompanyPublicBrand(): string {
  const b = process.env.NEXT_PUBLIC_COMPANY_PUBLIC_BRAND?.trim();
  return b || "PROVIN.LV";
}
