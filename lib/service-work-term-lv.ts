/**
 * Servisa darbu / detaļu nosaukumi no oficiālo dīleru izdrukām (angliski, vāciski) → latviski.
 *
 * Tulkojam pēc nozīmes, nevis vārds vārdā: „Set oil-filter element” ir „Eļļas filtra komplekts”,
 * „Repair kit, brake pads front” ir „Bremžu kluču komplekts (priekšā)”. Ja termins nav zināms
 * (zīmoli, eļļas specifikācijas, detaļu apzīmējumi), nosaukums paliek tāds, kā izdrukā — nekas
 * netiek izdomāts.
 */

type TermRule = { re: RegExp; lv: string };

/** Precizējumi pēc komata („…, front”, „…, ventilated”) → iekavas latviskajā nosaukumā. */
const QUALIFIER_LV: TermRule[] = [
  { re: /^(front|vorne|vorn|vorderachse)$/i, lv: "priekšā" },
  { re: /^(rear|hinten|hinterachse)$/i, lv: "aizmugurē" },
  { re: /^(left|links)$/i, lv: "kreisajā pusē" },
  { re: /^(right|rechts)$/i, lv: "labajā pusē" },
  { re: /^(ventilated|innenbel[üu]ftet)$/i, lv: "ventilēts" },
  { re: /^(upper|oben)$/i, lv: "augšā" },
  { re: /^(lower|unten)$/i, lv: "apakšā" },
  { re: /^(with\s+sensor|mit\s+sensor)$/i, lv: "ar sensoru" },
  { re: /^(automatic\s+transmission|automatikgetriebe)$/i, lv: "automātiskajai pārnesumkārbai" },
  { re: /^(top|oben\s+top)$/i, lv: "augšdaļa" },
  { re: /^(green|gr[üu]n)$/i, lv: "zaļš" },
  { re: /^rain\/light(\/solar)?(\/(condens\.?s?\.?|misting))?.*$/i, lv: "ar lietus un gaismas sensoru" },
  { re: /^(winter|winterr[äa]der)$/i, lv: "ziemai" },
  { re: /^(asbestos[- ]free|asbestfrei)$/i, lv: "bez azbesta" },
];

/**
 * Zināmie termini. Secība nav svarīga — meklējam pirmo pilnu sakritību,
 * tāpēc raksti ir noenkuroti (`^…$`).
 */
const TERM_LV: TermRule[] = [
  // Apkopes darbi un pakalpojumi
  { re: /^(oil\s+service|[öo]lservice|[öo]lwechsel|oil\s+change)$/i, lv: "Eļļas maiņa" },
  { re: /^(vehicle\s+check|fahrzeug[- ]?check)$/i, lv: "Tehniskā pārbaude servisā" },
  { re: /^(standard\s+scope|standardumfang)$/i, lv: "Standarta apkopes apjoms" },
  { re: /^(statutory\s+vehicle\s+inspection|hauptuntersuchung|hu)$/i, lv: "Obligātā tehniskā apskate" },
  { re: /^(statutory\s+emissions\s+test|abgasuntersuchung|au)$/i, lv: "Obligātā izplūdes gāzu pārbaude" },
  {
    re: /^roadworthiness\s+pre[- ]check(\s*\(german\s+market\s+only\))?$/i,
    lv: "Tehniskā priekšpārbaude (Vācijas tirgum)",
  },
  { re: /^(digitale\s+serviceberatung|digital\s+service\s+advice)$/i, lv: "Digitālā servisa konsultācija" },
  { re: /^kaskoschaden\b.*$/i, lv: "KASKO apdrošināšanas gadījuma remonts" },
  { re: /^(ersatzfahrzeug|replacement\s+vehicle|courtesy\s+car)(\s*\(.*\))?$/i, lv: "Maiņas auto" },
  { re: /^(t[üu]v\s+geb[üu]hren\b.*|t[üu]v\s+fee)$/i, lv: "TÜV apskates nodeva" },
  { re: /^(kostenlose\s+)?fahrzeugoberw[äa]sche$/i, lv: "Virsbūves mazgāšana" },
  { re: /^servicew[äa]sche(\s+plus)?$/i, lv: "Servisa mazgāšana" },
  { re: /^fahrzeug\s+nicht\s+waschen\.?$/i, lv: "Norāde: automašīnu nemazgāt" },
  { re: /^schleifvlies\s+und\s+hohlraumspray$/i, lv: "Slīpēšanas vate un dobumu aizsargaerosols" },
  { re: /^(feinstaub[- ]plakette(\s+gr[üu]n)?|umweltplakette)$/i, lv: "Vācijas ekoloģiskā uzlīme (zaļā)" },
  { re: /^(service|inspection|inspektion|maintenance|wartung)$/i, lv: "Apkope" },
  { re: /^(repair|reparatur)$/i, lv: "Remonts" },
  { re: /^(diagnosis|diagnostics|diagnose)$/i, lv: "Diagnostika" },
  { re: /^(labour|labor|arbeitszeit|arbeitslohn)$/i, lv: "Servisa darbs" },
  { re: /^(software\s+update|programmierung|codierung)$/i, lv: "Programmatūras atjaunināšana" },
  { re: /^(recall|technical\s+campaign|r[üu]ckruf(aktion)?)$/i, lv: "Ražotāja atsaukuma kampaņa" },
  { re: /^(wheel\s+alignment|achsvermessung|spureinstellung)$/i, lv: "Riteņu ģeometrijas regulēšana" },
  { re: /^(air\s+conditioning\s+service|klimaservice)$/i, lv: "Kondicionētāja apkope" },
  { re: /^(brake\s+fluid\s+(change|replacement)|bremsfl[üu]ssigkeitswechsel)$/i, lv: "Bremžu šķidruma maiņa" },
  { re: /^beide\s+vorderr[äa]der\s+auswuchten$/i, lv: "Priekšējo riteņu balansēšana" },
  { re: /^beide\s+hinterr[äa]der\s+auswuchten$/i, lv: "Aizmugurējo riteņu balansēšana" },
  { re: /^(wheel\s+balancing|r[äa]der\s+auswuchten|auswuchten)$/i, lv: "Riteņu balansēšana" },
  { re: /^(tyre|tire)\s+(change|replacement)$/i, lv: "Riepu maiņa" },

  // Šķidrumi un ekspluatācijas materiāli
  { re: /^(engine\s+oil|motor[öo]l|motoroel)$/i, lv: "Motoreļļa" },
  { re: /^(brake\s+fluid|bremsfl[üu]ssigkeit)$/i, lv: "Bremžu šķidrums" },
  { re: /^(coolant|antifreeze|k[üu]hlmittel|frostschutz)$/i, lv: "Dzesēšanas šķidrums" },
  { re: /^(gearbox|transmission)\s+oil$/i, lv: "Pārnesumkārbas eļļa" },
  { re: /^(getriebe[öo]l)$/i, lv: "Pārnesumkārbas eļļa" },
  { re: /^(differential\s+oil|achsgetriebe[öo]l)$/i, lv: "Diferenciāļa eļļa" },
  { re: /^(power\s+steering\s+fluid|lenkgetriebe[öo]l)$/i, lv: "Stūres pastiprinātāja šķidrums" },
  { re: /^(screen\s?wash|scheibenklar|scheibenreiniger)$/i, lv: "Stiklu mazgāšanas šķidrums" },
  { re: /^(brake\s+cleaner|bremsenreiniger)$/i, lv: "Bremžu tīrītājs" },
  { re: /^(cooling\s+agent|refrigerant|k[äa]ltemittel)$/i, lv: "Kondicionētāja dzesētājviela" },
  { re: /^(lubricant\s+refrigeration\s+compressor)$/i, lv: "Kondicionētāja kompresora smērviela" },
  { re: /^(grease|fett|kontaktschutzfett(\s+kf1)?)$/i, lv: "Kontaktu aizsargsmērviela" },
  { re: /^(small\s+parts|kleinteile)$/i, lv: "Sīkdetaļas" },
  { re: /^(gewichte|balance\s+weights?)$/i, lv: "Balansēšanas atsvari" },
  { re: /^(entsorgung\s+reifen|tyre\s+disposal)$/i, lv: "Riepu utilizācija" },
  { re: /^(disposal|entsorgung)$/i, lv: "Utilizācija" },

  // Filtri
  { re: /^(set\s+)?oil[- ]filter(\s+element)?$/i, lv: "Eļļas filtra komplekts" },
  { re: /^([öo]lfilter)$/i, lv: "Eļļas filtrs" },
  { re: /^(air\s+filter(\s+element)?|luftfilter)$/i, lv: "Gaisa filtrs" },
  { re: /^(fuel\s+filter(\s+cartridge)?|(kraft|die)stofffilter)$/i, lv: "Degvielas filtrs" },
  {
    re: /^(microfilter\/activated\s+carbon\s+container|activated\s+carbon\s+(micro)?filter)$/i,
    lv: "Salona filtrs (ar aktivēto ogli)",
  },
  { re: /^(microfilter|cabin\s+(air\s+)?filter|innenraumfilter|pollenfilter)$/i, lv: "Salona filtrs" },
  { re: /^(particulate\s+filter|dpf|dieselpartikelfilter)$/i, lv: "Cieto daļiņu filtrs (DPF)" },

  // Bremzes
  { re: /^(repair\s+kit,?\s+brake\s+pads?.*|brake\s+pad\s+set|bremsbel[äa]ge?(satz)?)$/i, lv: "Bremžu kluču komplekts" },
  {
    re: /^(brake[- ]pad(\s+wear)?\s+sensor|bremsbelagverschlei[ßs]sensor)$/i,
    lv: "Bremžu kluču nodiluma sensors",
  },
  { re: /^(brake[- ]pad\s+paste|bremsenpaste)$/i, lv: "Bremžu kluču pasta" },
  { re: /^(brake\s+disc|bremsscheibe)$/i, lv: "Bremžu disks" },
  { re: /^(brake\s+discs?,\s*ventilated|bremsscheibe\s+innenbel[üu]ftet)$/i, lv: "Bremžu disks (ventilēts)" },
  { re: /^(brake\s+caliper|bremssattel)$/i, lv: "Bremžu suports" },
  { re: /^(front\s+brake|bremse\s+vorne)$/i, lv: "Priekšējās bremzes" },
  { re: /^(rear\s+brake|bremse\s+hinten)$/i, lv: "Aizmugurējās bremzes" },
  { re: /^(handbrake|parking\s+brake|handbremse)$/i, lv: "Stāvbremze" },

  // Dzinējs un piedziņa
  { re: /^(spark\s+plug|z[üu]ndkerze)$/i, lv: "Aizdedzes svece" },
  { re: /^(set\s+of\s+spark\s+plugs|z[üu]ndkerzensatz)$/i, lv: "Aizdedzes sveču komplekts" },
  { re: /^(glow\s+plug|gl[üu]hkerze)$/i, lv: "Kvēlsvece" },
  { re: /^(injector|einspritzd[üu]se|injektor)$/i, lv: "Iesmidzinātājs (sprausla)" },
  { re: /^(turbocharger|turbolader)$/i, lv: "Turbokompresors" },
  { re: /^(egr[- ]valve|agr[- ]ventil)$/i, lv: "EGR vārsts" },
  { re: /^(lambda|oxygen)\s+(sensor|probe)$/i, lv: "Lambda zonde" },
  { re: /^(lambdasonde)$/i, lv: "Lambda zonde" },
  { re: /^(water\s+pump|wasserpumpe)$/i, lv: "Ūdens sūknis" },
  { re: /^(thermostat)$/i, lv: "Termostats" },
  { re: /^(v[- ]?belt|drive\s+belt|keilrippenriemen|keilriemen)$/i, lv: "Piedziņas siksna" },
  { re: /^(timing\s+chain|steuerkette)$/i, lv: "Sadales ķēde" },
  { re: /^(timing\s+belt|zahnriemen)$/i, lv: "Zobsiksna" },
  { re: /^(clutch|kupplung)$/i, lv: "Sajūgs" },
  { re: /^(starter|anlasser)$/i, lv: "Starteris" },
  { re: /^(alternator|generator|lichtmaschine)$/i, lv: "Ģenerators" },
  { re: /^(battery|batterie)$/i, lv: "Akumulators" },
  { re: /^(exhaust(\s+system)?|auspuff(anlage)?)$/i, lv: "Izplūdes sistēma" },
  { re: /^(catalytic\s+converter|katalysator)$/i, lv: "Katalizators" },

  // Balstiekārta un stūre
  { re: /^(shock\s+absorber|sto[ßs]d[äa]mpfer)$/i, lv: "Amortizators" },
  { re: /^(gas\s+pressurized\s+spring|gasdruckfeder)$/i, lv: "Gāzes amortizators" },
  { re: /^(coil\s+spring|fahrwerksfeder)$/i, lv: "Atspere" },
  { re: /^(control\s+arm|querlenker)$/i, lv: "Balstiekārtas svira" },
  { re: /^(tie\s+rod(\s+end)?|spurstange(nkopf)?)$/i, lv: "Stūres šķērsstiepnis" },
  { re: /^(wheel\s+bearing|radlager)$/i, lv: "Rites gultnis" },
  { re: /^(rubber\s+valve|gummiventil)$/i, lv: "Riepas ventilis" },
  { re: /^(tyre|tire|reifen)$/i, lv: "Riepa" },

  // Virsbūve, apgaismojums, salons
  { re: /^(set\s+of\s+wiper\s+blades|wischerblattsatz|scheibenwischersatz)$/i, lv: "Logu tīrītāju slotiņu komplekts" },
  { re: /^(wiper\s+blade|wischerblatt|scheibenwischer)$/i, lv: "Logu tīrītāja slotiņa" },
  { re: /^((longlife\s+)?bulb|gl[üu]hlampe|lampe)$/i, lv: "Spuldze" },
  { re: /^(headlight|scheinwerfer)$/i, lv: "Priekšējais lukturis" },
  { re: /^(tail\s?light|r[üu]ckleuchte|heckleuchte)$/i, lv: "Aizmugures lukturis" },
  { re: /^(windscreen|windshield|windschutzscheibe)$/i, lv: "Vējstikls" },
  { re: /^(door\s+handle|t[üu]rgriff)$/i, lv: "Durvju rokturis" },
  { re: /^((exterior\s+)?mirror|au[ßs]enspiegel)$/i, lv: "Ārējais spogulis" },
  { re: /^(gasket|sealing\s+ring|dichtring|dichtung)$/i, lv: "Blīve" },
  { re: /^(drain\s+plug|[öo]lablassschraube|verschlussschraube)$/i, lv: "Noteces aizgrieznis" },
  { re: /^(screw|bolt|schraube)$/i, lv: "Skrūve" },
  { re: /^(nut|mutter)$/i, lv: "Uzgrieznis" },
  { re: /^(washer|scheibe|unterlegscheibe)$/i, lv: "Paplāksne" },
  { re: /^(clamp|schelle)$/i, lv: "Skava" },
  { re: /^(hose\s+clamp|schlauchschelle)$/i, lv: "Šļūtenes skava" },
  { re: /^(hose|schlauch)$/i, lv: "Šļūtene" },
  { re: /^(repair\s+kit|reparatursatz)$/i, lv: "Remonta komplekts" },
  { re: /^repair\s+kit,?\s+window\s+glass.*$/i, lv: "Loga stikla remonta komplekts" },
  { re: /^(repair\s+kit\s+screws|schraubensatz)$/i, lv: "Skrūvju komplekts" },
  { re: /^(oval\s+head\s+screw|linsenkopfschraube)$/i, lv: "Ovālgalvas skrūve" },
  {
    re: /^(fillister\s+head\s+self[- ]tapping\s+screw|zylinderschraube\s+selbstschneidend)$/i,
    lv: "Pašvītņojoša skrūve ar cilindrisku galvu",
  },
  { re: /^(clip|klip)$/i, lv: "Klipsis" },
  { re: /^(plaque|plakette)$/i, lv: "Plāksnīte" },
  { re: /^(connecting\s+line|verbindungsleitung)$/i, lv: "Savienojuma cauruļvads" },
  { re: /^cover\s+base\s+b\+$/i, lv: "Akumulatora B+ spailes vāciņš" },
  { re: /^(exhaust\s+pressure\s+sensor|abgasdrucksensor)$/i, lv: "Izplūdes spiediena sensors" },
  { re: /^sensor\s+rain\/light\/solar\/misting.*$/i, lv: "Lietus, gaismas, saules un aizsvīšanas sensors" },
  { re: /^cover,\s*windshield,?\s*top$/i, lv: "Vējstikla augšējā apdare" },
  { re: /^(drip\s+moulding|wasserabweisleiste)$/i, lv: "Jumta notekrenes apdare" },
  { re: /^instruction\s+notice,?\s*airbag$/i, lv: "Drošības spilvena norādījumu uzlīme" },
  { re: /^(complete\s+alloy\s+wheel\s+winter|complete\s+winter\s+wheel)$/i, lv: "Ziemas ritenis (komplektā)" },
  { re: /^(wheel\s+cover|radblende|radkappe)$/i, lv: "Riteņa dekoratīvais vāciņš" },
  {
    re: /^(windshield|windscreen)\s+washer\s+antifreeze$/i,
    lv: "Stiklu mazgāšanas šķidrums (ziemas)",
  },
  { re: /^bmw\s+high[- ]visibility\s+jacket$/i, lv: "BMW atstarojošā veste" },
];

/** Motoreļļas apzīmējums ar specifikāciju („MOTOROEL 5W-30 LL04”) — zīmols paliek. */
const OIL_PREFIX_RE = /^(motoroel|motor[öo]l|motor\s+oil|engine\s+oil)\b/i;

/** „BREMSFLÜSSIGKEIT DOT4” — nosaukums latviski, specifikācija paliek. */
const BRAKE_FLUID_PREFIX_RE = /^(bremsfl[üu]ssigkeit|brake\s+fluid)\b/i;

function normalize(raw: string): string {
  return raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().replace(/[,;.]+$/, "");
}

function matchTerm(name: string): string {
  const hit = TERM_LV.find(({ re }) => re.test(name));
  return hit ? hit.lv : "";
}

function matchQualifier(name: string): string {
  const hit = QUALIFIER_LV.find(({ re }) => re.test(name));
  return hit ? hit.lv : "";
}

/**
 * Viens darba / detaļas nosaukums latviski.
 * Zināmais termins tiek tulkots pēc nozīmes; nezināmais paliek oriģinālvalodā.
 */
export function serviceWorkTermLv(raw: string): string {
  const name = normalize(raw);
  if (!name) return "";

  const direct = matchTerm(name);
  if (direct) return direct;

  // „Brake disc, ventilated, front” → bāze + precizējumi iekavās.
  const parts = name.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const base = matchTerm(parts[0]!);
    if (base) {
      const quals = parts.slice(1).map(matchQualifier);
      if (quals.every(Boolean)) return `${base} (${quals.join(", ")})`;
      const tail = parts.slice(1).join(", ");
      return `${base} (${tail})`;
    }
  }

  // „Brake pads front” / „Bremsbeläge vorne” → precizējums vārda beigās.
  const trailing = name.match(/^(.*?)\s+(front|rear|vorne|hinten|links|rechts|left|right)$/i);
  if (trailing) {
    const base = matchTerm(trailing[1]!.trim());
    const qual = matchQualifier(trailing[2]!);
    if (base && qual) return `${base} (${qual})`;
  }

  // „MOTOROEL 5W-30 LL04”, „Castrol Magnatec 5W-30” — specifikācija un zīmols nav tulkojami.
  if (OIL_PREFIX_RE.test(name)) {
    const spec = name.replace(OIL_PREFIX_RE, "").trim();
    return spec ? `Motoreļļa ${spec}` : "Motoreļļa";
  }
  if (BRAKE_FLUID_PREFIX_RE.test(name)) {
    const spec = name.replace(BRAKE_FLUID_PREFIX_RE, "").trim();
    return spec ? `Bremžu šķidrums ${spec.toUpperCase()}` : "Bremžu šķidrums";
  }

  return name;
}

/** Darbu saraksts latviski (tukšie un dublikāti izmesti). */
export function serviceWorkTermsLv(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const value = serviceWorkTermLv(item);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}
