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
  /** Vai visi trīs lauki aizpildīti */
  isComplete: boolean;
};

export function getCompanyLegal(): CompanyLegal {
  const legalName = process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME?.trim() ?? "";
  const regNo = process.env.NEXT_PUBLIC_COMPANY_REG_NO?.trim() ?? "";
  const legalAddress = process.env.NEXT_PUBLIC_COMPANY_LEGAL_ADDRESS?.trim() ?? "";
  const isComplete = Boolean(legalName && regNo && legalAddress);
  return { legalName, regNo, legalAddress, isComplete };
}
