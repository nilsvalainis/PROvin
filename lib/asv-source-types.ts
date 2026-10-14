import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import type {
  CcVinCheckRow,
  CcVinDamageRow,
  CcVinRecordRow,
  CcVinSaleRow,
  CcVinTitleRow,
} from "@/lib/cc-vin-report";

export type AsvDataSourceId = "oneauto" | "joj";

export type AsvSourceTableBundle = {
  reportDate: string;
  attentionMarks: string;
  ownersCount: string;
  checks: CcVinCheckRow[];
  mileage: AutoRecordsServiceRow[];
  damages: CcVinDamageRow[];
  brands: CcVinRecordRow[];
  titles: CcVinTitleRow[];
  sales: CcVinSaleRow[];
  liens: CcVinRecordRow[];
  thefts: CcVinRecordRow[];
  notes: string[];
};

export type AsvSourceSnapshots = {
  oneauto?: AsvSourceTableBundle;
  joj?: AsvSourceTableBundle;
};

export type AsvOverlapStronger = AsvDataSourceId | "tie";

export type AsvOverlapCompareRow = {
  field: string;
  oneauto: string;
  joj: string;
  stronger: AsvOverlapStronger;
  chosen: AsvDataSourceId;
};

export type AsvSourceAttribution = {
  defaultSource: AsvDataSourceId;
  scalars: {
    reportDate?: AsvDataSourceId;
    attentionMarks?: AsvDataSourceId;
    ownersCount?: AsvDataSourceId;
  };
};
