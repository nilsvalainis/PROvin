"use client";

import { useState } from "react";

/**
 * Atgriež `value` tikai tad, kad darbs nav aktīvs; kamēr `busy`, paliek pēdējā nosēdusies vērtība
 * tai pašai atslēgai (piem. VIN), citādi `null`.
 * Ātrās pārbaudes augšējās kartītes: avoti ielādējas pa partijām, bet kartītes parādās vienā reizē,
 * nevis pa vienai ar lēcieniem (sk. #1152, #1160).
 */
export function useSettledWhileBusy<T>(value: T, busy: boolean, key: string): T | null {
  const [settled, setSettled] = useState<{ key: string; value: T } | null>(null);
  if (!busy && (settled?.key !== key || settled.value !== value)) {
    // Atvasināts stāvoklis renderēšanas laikā (React atbalsta setState sev pašam renderī).
    setSettled({ key, value });
  }
  if (!busy) return value;
  return settled && settled.key === key ? settled.value : null;
}
