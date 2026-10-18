/**
 * Vai dīlera „Darbi” teksts vēl ir svešvalodā (EN / NL / DE) un jāpārtulko latviski.
 * Bez atkarībām, lai to var lietot arī `auto-records-service-works` sapludināšanā.
 */

const FOREIGN_WORKS_RE =
  /\b(the|and|acc\.?|according|software|download|install|sides|fitting|executed|upgrade|workshop|remark|remarks|warranty|inspection|engine|oil|filter|change|performed|latest|already|contained|bij|het|van|dat|aan|uitgevoerd|mvg|nieuwste|geeft|actie|acit|service|huolto|tarkastus|öljynvaihto)\b/i;

const CYRILLIC_RE = /[\u0400-\u04FF]/;

/** A/B EN dīlera nosaukumi, ko parastais RE nepārtver (neķer LV bez diakritikas). */
const EN_DEALER_TITLE_RE =
  /\b(pneumatic|spring|intake|tube|hybrid|health|hhc|replaced|rear|front|left|right|timing|chain|kit|airbag|cabin|recall)\b/i;

/** Vācu dīlera / DMS darbi (Opel, VW, BMW u.c.), arī ar pazaudētiem umlautiem („MOTOR�L”). */
const DE_DEALER_WORKS_RE =
  /wechsel|pr[üu\uFFFD]f|prfg|sicherheit|inspektion|durchsicht|erneuer|ersetz|austausch|kontrolle|kontrollier|reifen|r[äa\uFFFD]der|bremse|bremsfl|z[üu\uFFFD]ndkerz|k[üu\uFFFD]hlmittel|innenraum|kraftstoff|getriebe|kupplung|batterie|steuerger|aktualisier|fehlerspeicher|ausles|r[üu\uFFFD]ckruf|garantie|kulanz|untersuchung|wartung|durchgef|durchf|arbeit|systematisch|reinig|einstell|getauscht|tauschen|montier|ausgebaut|eingebaut|instandsetz|reparatur|reparier|nachf[üu\uFFFD]ll|scheibe|wischer|motor[öo\uFFFD]l|[öo\uFFFD]lfilter|[öo\uFFFD]lservice|luftfilter|pollenfilter|zahnriemen|keilrippen|stossd|sto[ßs]d|achsvermessung|klimaanlage|(?<!\p{L})(?:mit|und|f[üu\uFFFD]r|nach|laut|lt|gem|inkl|vorne|hinten|links|rechts)(?!\p{L})/iu;

/** Vai „Darbi” teksts vēl jāpārtulko latviski. */
export function oneautoWorksNeedLvTranslation(works: string): boolean {
  const t = works.replace(/\s+/g, " ").trim();
  if (t.length < 3) return false;
  if (/[āčēģīķļņšūž]/i.test(t)) {
    // LV tulkojumā drīkst palikt viens termins („Opel Service”, „ECM software”); divi jau ir svešvalodas teikums.
    const hits = new Set(
      (t.match(new RegExp(FOREIGN_WORKS_RE.source, "gi")) ?? []).map((w) => w.toLowerCase()),
    );
    return hits.size >= 2;
  }
  if (CYRILLIC_RE.test(t)) return true;
  if (FOREIGN_WORKS_RE.test(t)) return true;
  if (/[äöüß\uFFFD]/i.test(t) || DE_DEALER_WORKS_RE.test(t)) return true;
  return EN_DEALER_TITLE_RE.test(t);
}

