/**
 * Gemini strukturētā atbilde — vairāku vēstures PDF kopīga analīze.
 */

export type VehicleAiAnomalySeverity = "CRITICAL" | "WARNING" | "INFO";

export type VehicleAiAnomalyCategory =
  | "MILEAGE_ROLLBACK"
  | "HIDDEN_DAMAGE"
  | "COMMERCIAL_USE"
  | "DATA_DISCREPANCY";

export type VehicleAiAnomaly = {
  severity: VehicleAiAnomalySeverity;
  category: VehicleAiAnomalyCategory;
  description_lv: string;
};

export type VehicleAIExtraction = {
  vehicle_metadata: {
    vin: string;
    license_plate: string | null;
    manufacture_year: number | null;
    first_registration_date: string | null;
  };
  extracted_metrics: {
    latest_calculated_mileage: number;
    latest_mileage_date: string | null;
    total_accidents_found: number;
  };
  anomalies: VehicleAiAnomaly[];
  ai_generated_comments_lv: string;
};

export type VehicleAiExtractionMeta = {
  analyzedAt: string;
  fileNames: string[];
  sources: string[];
};
