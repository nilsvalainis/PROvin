/**
 * Klienta PDF un admin 1:1 priekšskatījums — vienoti .pdf-oil-int stili.
 */
import {
  PDF_OIL_HATCH_CSS,
  PDF_OIL_NEUTRAL_HEX,
  PDF_OIL_OK_HEX,
  PDF_OIL_OK_WASH_HEX,
  PDF_OIL_OVER_HEX,
  PDF_OIL_OVER_TEXT_HEX,
} from "@/lib/oil-change-intervals";

/** CSS fragments iekšējai <style> vai admin preview konteineram. */
export function oilChangeIntervalPdfBlockCss(): string {
  return `
      .pdf-oil-int{margin:0 0 var(--pdf-gap-block, 12px);}
      .pdf-oil-int__kpis{
        display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px;
      }
      .pdf-oil-int__kpi{
        padding:8px 10px;border:1px solid var(--pdf-line, #E2E8F0);border-radius:8px;background:#F8FAFC;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-oil-int__kpi b{display:block;font-size:13px;font-weight:750;letter-spacing:-0.02em;color:#0f172a;}
      .pdf-oil-int__kpi span{display:block;margin-top:2px;font-size:9px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;}
      .pdf-oil-int__cov{
        display:flex;height:20px;border-radius:99px;overflow:hidden;background:#EEF1F4;margin:0 0 8px;
        box-shadow:inset 0 0 0 1px rgb(15 23 42 / .08);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-oil-int__cov i{display:block;height:100%;}
      .pdf-oil-int__cov-ok{background:linear-gradient(180deg,#1A6B57 0%,${PDF_OIL_OK_HEX} 100%);}
      .pdf-oil-int__cov-over{background:${PDF_OIL_OVER_HEX};}
      .pdf-oil-int__cov-neutral{background:${PDF_OIL_NEUTRAL_HEX};}
      .pdf-oil-int__cov-hatch{background:${PDF_OIL_HATCH_CSS};}
      .pdf-oil-int__covkey{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:10.5px;color:#334155;margin:0 0 10px;}
      .pdf-oil-int__covkey span{display:inline-flex;align-items:center;gap:6px;}
      .pdf-oil-int__sw{display:inline-block;width:14px;height:7px;border-radius:99px;}
      .pdf-oil-int__sw--ok{background:${PDF_OIL_OK_HEX};}
      .pdf-oil-int__sw--over{background:${PDF_OIL_OVER_HEX};}
      .pdf-oil-int__sw--neutral{background:${PDF_OIL_NEUTRAL_HEX};}
      .pdf-oil-int__sw--hatch{background:${PDF_OIL_HATCH_CSS};}
      .pdf-oil-int__summary{font-size:13px;font-weight:700;letter-spacing:-0.01em;margin:0 0 12px;color:#0f172a;}
      .pdf-oil-int__summary span{display:block;margin-top:2px;font-size:10.5px;font-weight:500;letter-spacing:0;color:#475569;}
      .pdf-oil-int__ref{margin:0 0 8px;font-size:10.5px;line-height:1.45;color:#334155;}
      .pdf-oil-int__ref b{font-weight:700;color:#0f172a;}
      .pdf-oil-int__table{width:100%;border-collapse:collapse;font-size:var(--pdf-fs-table, 11px);}
      .pdf-oil-int__table th{
        padding:6px 8px 6px 0;text-align:left;font-size:9px;font-weight:700;letter-spacing:0.05em;
        text-transform:uppercase;color:#64748b;border-bottom:1px solid var(--pdf-line, #E2E8F0);
      }
      .pdf-oil-int__table td{padding:7px 8px 7px 0;border-bottom:1px solid var(--pdf-line-soft, #EEF1F4);vertical-align:middle;}
      .pdf-oil-int__table tr:last-child td{border-bottom:none;}
      .pdf-oil-int__table th:nth-child(5),
      .pdf-oil-int__table td:nth-child(5){width:32%;padding-right:0;}
      .pdf-oil-int__gap-tag{margin-top:2px;font-size:8.5px;font-weight:650;letter-spacing:0.04em;text-transform:uppercase;color:#94a3b8;}
      .pdf-oil-int__row--gap td{color:#64748b;}
      .pdf-oil-int__dim{color:#94a3b8;}
      .pdf-oil-int__start{font-weight:700;color:#0f172a;}
      .pdf-oil-int__over{color:${PDF_OIL_OVER_TEXT_HEX};font-weight:700;}
      .pdf-oil-int__caution{
        margin:10px 0 0;padding:10px 12px;border:1px solid var(--pdf-line-soft, #EEF1F4);border-radius:8px;background:#F8FAFC;
        font-size:10px;line-height:1.45;color:#334155;
      }
      .pdf-oil-int__caution{border-color:#E2E8F0;background:#F8FAFC;}
      .pdf-oil-int__caution-title{margin:0 0 8px;font-size:11px;font-weight:750;color:#0f172a;letter-spacing:-0.01em;}
      .pdf-oil-int__caution p{margin:0 0 7px;}
      .pdf-oil-int__caution p:last-of-type{margin-bottom:4px;}
      .pdf-oil-int__caution ul{margin:0;padding:0 0 0 16px;}
      .pdf-oil-int__caution li{margin:0 0 3px;}
      .pdf-oil-int__caution li:last-child{margin:0;}
      .pdf-oil-int__bw{position:relative;display:flex;align-items:center;height:14px;width:100%;}
      .pdf-oil-int__band{position:absolute;top:1px;bottom:1px;background:${PDF_OIL_OK_WASH_HEX};border-radius:4px;}
      .pdf-oil-int__tk{position:absolute;top:-2px;bottom:-2px;width:1.5px;background:#0f172a;opacity:.5;z-index:3;}
      .pdf-oil-int__seg{
        position:relative;z-index:2;display:block;height:8px;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-oil-int__seg:first-of-type{border-radius:99px 0 0 99px;}
      .pdf-oil-int__seg:last-of-type{border-radius:0 99px 99px 0;}
      .pdf-oil-int__seg:only-of-type{border-radius:99px;}
      .pdf-oil-int__seg--ok{background:linear-gradient(180deg,#1A6B57 0%,${PDF_OIL_OK_HEX} 100%);}
      .pdf-oil-int__seg--over{background:${PDF_OIL_OVER_HEX};}
      .pdf-oil-int__seg--neutral{background:${PDF_OIL_NEUTRAL_HEX};}
      .pdf-oil-int__seg--hatch{background:${PDF_OIL_HATCH_CSS};width:100%;}
      .pdf-oil-int__seg--dot{width:8px!important;border-radius:99px;background:#C5CBD3;}
      .pdf-subhead{
        margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;
      }`;
}

/** Admin preview wrapper — PDF tokeni + bloka stili. */
export function oilChangeIntervalAdminPreviewCss(): string {
  return `
    .admin-oil-preview{
      --pdf-line:#E2E8F0;
      --pdf-line-soft:#EEF1F4;
      --pdf-fs-table:11px;
      --pdf-gap-block:12px;
    }
    ${oilChangeIntervalPdfBlockCss()}
  `;
}
