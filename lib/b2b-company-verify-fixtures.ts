import type {
  CompanyVerifyInput,
  CompanyVerifyOfficer,
  CompanyVerifySources,
  CompanyVerifyUrCompany,
  CompanyVerifyVies,
} from "@/lib/b2b-company-verify";

export const FIXTURE_ACTIVE_UR: CompanyVerifyUrCompany = {
  regcode: "40103123456",
  name: 'SIA "Demo Auto"',
  address: "Brīvības iela 1, Rīga, LV-1010",
  registered: "2018-03-12T00:00:00",
  terminated: "",
  closed: "",
  type: "SIA",
};

export const FIXTURE_LIQUIDATED_UR: CompanyVerifyUrCompany = {
  regcode: "40103999999",
  name: 'SIA "Vecais Auto"',
  address: "Maskavas iela 10, Rīga",
  registered: "2005-01-01T00:00:00",
  terminated: "2022-06-01T00:00:00",
  closed: "L",
  type: "SIA",
};

export const FIXTURE_BOARD_OFFICER: CompanyVerifyOfficer = {
  name: "Bērziņš Jānis",
  governingBody: "EXECUTIVE_BOARD",
  position: "",
};

export const FIXTURE_OTHER_OFFICER: CompanyVerifyOfficer = {
  name: "Kalniņa Anna",
  governingBody: "SUPERVISORY_BOARD",
  position: "Padomes locekle",
};

export const FIXTURE_VIES_VALID: CompanyVerifyVies = {
  country: "LV",
  vatNumber: "40103123456",
  valid: true,
  name: "SIA DEMO AUTO",
  address: "BRIVIBAS IELA 1, RIGA",
};

export const FIXTURE_VIES_INVALID: CompanyVerifyVies = {
  country: "LV",
  vatNumber: "40103000000",
  valid: false,
  name: "",
  address: "",
};

export const FIXTURE_GOOD_INPUT: CompanyVerifyInput = {
  companyName: "sia „Demo Auto”",
  companyReg: "40103123456",
  companyAddress: "Brivibas iela 1, Riga",
  vatNumber: "LV40103123456",
  contactName: "Jānis Bērziņš",
  email: "janis@demo-auto.lv",
};

export const FIXTURE_FREE_MAIL_INPUT: CompanyVerifyInput = {
  ...FIXTURE_GOOD_INPUT,
  email: "janis@gmail.com",
};

export function fixtureSourcesGood(): CompanyVerifySources {
  return {
    urCompany: { status: "ok", record: FIXTURE_ACTIVE_UR },
    urOfficers: { status: "ok", officers: [FIXTURE_BOARD_OFFICER, FIXTURE_OTHER_OFFICER] },
    vies: { status: "ok", record: FIXTURE_VIES_VALID },
  };
}

export function fixtureSourcesDown(): CompanyVerifySources {
  return {
    urCompany: { status: "unavailable", record: null },
    urOfficers: { status: "unavailable", officers: [] },
    vies: { status: "unavailable", record: null },
  };
}

export const FIXTURE_UR_DATASTORE_COMPANY = {
  success: true,
  result: {
    records: [
      {
        regcode: 40103123456,
        name: 'SIA "Demo Auto"',
        address: "Brīvības iela 1, Rīga, LV-1010",
        registered: "2018-03-12T00:00:00",
        terminated: "",
        closed: "",
        type: "SIA",
      },
    ],
  },
};

export const FIXTURE_UR_DATASTORE_OFFICERS = {
  success: true,
  result: {
    records: [
      {
        name: "Bērziņš Jānis",
        governing_body: "EXECUTIVE_BOARD",
        position: "",
        at_legal_entity_registration_number: 40103123456,
      },
    ],
  },
};

export const FIXTURE_VIES_HTTP = {
  isValid: true,
  userError: "VALID",
  name: "SIA DEMO AUTO",
  address: "BRIVIBAS IELA 1, RIGA",
};
