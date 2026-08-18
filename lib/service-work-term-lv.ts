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
  { re: /^(self[- ]tapping|selbstschneidend)$/i, lv: "pašvītņojoša" },
  { re: /^(lightweight|leichtbau)$/i, lv: "viegls" },
  { re: /^(make\s+contact|schlie[ßs]er)$/i, lv: "slēdzošais" },
  { re: /^(white\s+green|wei[ßs]gr[üu]n)$/i, lv: "balti zaļš" },
  { re: /^(black|schwarz)$/i, lv: "melna" },
  { re: /^(high\s+temperature|hochtemperatur)$/i, lv: "augsta temperatūra" },
  { re: /^(driver'?s?\s+side|fahrerseite)$/i, lv: "vadītāja pusē" },
  { re: /^(low\s+viscosity)$/i, lv: "zema viskozitāte" },
  { re: /^(with\s+antifreeze|mit\s+frostschutz)$/i, lv: "ar pretfrostu" },
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
  { re: /^service[vw][äae]sche\s+upgrade$/i, lv: "Servisa mazgāšana (paplašinātā)" },
  { re: /^service[vw][äae]sche(\s+plus)?$/i, lv: "Servisa mazgāšana" },
  { re: /^[öo]lzuschlag\s+f[üu]r\s+service[-\s]?inclusive$/i, lv: "Eļļas piemaksa (Service Inclusive)" },
  { re: /^nachr[üu]stung\s+service[-\s]?inclusive$/i, lv: "Service Inclusive pievienošana" },
  { re: /^kundenloyali[a-zäöü]+\s+siehe\s+mail$/i, lv: "Klienta lojalitātes akcija (sk. e-pastu)" },
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
    re: /^(microfilter\/(activated\s+)?carbon\s+(container|canister)|activated\s+carbon\s+(micro)?filter)$/i,
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
  { re: /^(brake\s+discs?|bremsscheibe)$/i, lv: "Bremžu disks" },
  { re: /^(brake\s+discs?,\s*ventilated|bremsscheibe\s+innenbel[üu]ftet)$/i, lv: "Bremžu disks (ventilēts)" },
  { re: /^(brake\s+caliper|bremssattel)$/i, lv: "Bremžu suports" },
  { re: /^(front\s+brake|bremse\s+vorne)$/i, lv: "Priekšējās bremzes" },
  { re: /^(rear\s+brake|bremse\s+hinten)$/i, lv: "Aizmugurējās bremzes" },
  { re: /^(handbrake|parking\s+brake|handbremse)$/i, lv: "Stāvbremze" },

  // Dzinējs un piedziņa
  { re: /^(spark\s+plug|z[üu]ndkerze)$/i, lv: "Aizdedzes svece" },
  { re: /^(set\s+of\s+spark\s+plugs|z[üu]ndkerzensatz)$/i, lv: "Aizdedzes sveču komplekts" },
  { re: /^(glow\s+plug|gl[üu]hkerze)$/i, lv: "Kvēlsvece" },
  { re: /^(injector|einspritzd[üu]se|injektor)$/i, lv: "Iesmidzinātājs" },
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
  { re: /^bmw\s+cleaning\s+fluid(\s+with\s+antifreeze)?$/i, lv: "BMW stiklu mazgāšanas šķidrums ar pretfrostu" },
  { re: /^cleaning\s+fluid(\s+with\s+antifreeze)?$/i, lv: "Stiklu mazgāšanas šķidrums ar pretfrostu" },
  { re: /^bmw\s+group\s+ll[- ]?0?4-?0?w$/i, lv: "Motoreļļa BMW Group LL-04 0W" },
  { re: /^(original\s+)?bmw\s+agm[- ]?batter(y|ie)$/i, lv: "Oriģinālais BMW AGM akumulators" },
  { re: /^(egr\s+small\s+parts\s+set|agr[- ]kleinteilesatz)$/i, lv: "EGR sīkdetaļu komplekts" },
  { re: /^(exhaust\s+gas\s+radiator(\s+high\s+temperature)?|abgask[üu]hler)$/i, lv: "Izplūdes gāzu radiators" },
  {
    re: /^pipe,?\s*exhaust\s+gas\s+radiator(\s+high\s+temperature)?$/i,
    lv: "Izplūdes gāzu radiatora caurule (augsta temperatūra)",
  },
  { re: /^(vacuum\s+hose|unterdruckschlauch)$/i, lv: "Vakuuma šļūtene" },
  { re: /^(acoustic\s+cover|akustikabdeckung)$/i, lv: "Akustiskais pārsegs" },
  { re: /^(pipe\s+union|rohrverschraubung)$/i, lv: "Caurules savienojums" },
  { re: /^(airbag\s+module|airbagmodul)$/i, lv: "Drošības spilvena modulis" },
  { re: /^(relay|relais)$/i, lv: "Relejs" },
  { re: /^(fastening\s+set|befestigungssatz)$/i, lv: "Stiprinājumu komplekts" },
  { re: /^(inner\s+hex\s+bolt|innensechskantschraube)$/i, lv: "Iekšējā sešstūra skrūve" },
  { re: /^(nitrogen\s+oxide\s+sensor|nox[- ]?sensor|stickoxidsensor)$/i, lv: "Slāpekļa oksīdu sensors (NOx)" },
  { re: /^(safety\s+cleaner(\s+\d+)?|sicherheitsreiniger)$/i, lv: "Drošības tīrītājs" },
  { re: /^(holder|halter)$/i, lv: "Turētājs" },
  { re: /^(o[- ]?ring|o[- ]ring)$/i, lv: "O-gredzens" },
  { re: /^(pipe|rohr|leitung)$/i, lv: "Caurule" },
  {
    re: /^line\s+cylinder\s+head\s*[-–—]\s*scr\s+metering\s+module$/i,
    lv: "Cauruļvads: cilindra galva – SCR dozēšanas modulis",
  },
  {
    re: /^hose\s+scr\s+metering\s+module\s+coolant\s+pump$/i,
    lv: "Šļūtene: SCR dozēšanas modulis – dzesēšanas šķidruma sūknis",
  },
];

/** Motoreļļas apzīmējums ar specifikāciju („MOTOROEL 5W-30 LL04”) — zīmols paliek. */
const OIL_PREFIX_RE = /^(motoroel|motor[öo]l|motor\s+oil|engine\s+oil)\b/i;

/** „BREMSFLÜSSIGKEIT DOT4” — nosaukums latviski, specifikācija paliek. */
const BRAKE_FLUID_PREFIX_RE = /^(bremsfl[üu]ssigkeit|brake\s+fluid)\b/i;

function normalize(raw: string): string {
  return raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().replace(/[,;.]+$/, "");
}

/** BMW ETK / pasūtījuma numurs rindas beigās vai atsevišķs tokens („83125A66D571”). */
const ETK_PART_NO_RE = /\b\d{4,}[A-Z][A-Z0-9]{4,}\b/g;
const LONG_DIGIT_PART_RE = /\b\d{8,}\b/g;

function stripPartCodes(name: string): string {
  return name.replace(ETK_PART_NO_RE, " ").replace(LONG_DIGIT_PART_RE, " ").replace(/\s+/g, " ").trim();
}

function preprocess(raw: string): string {
  let name = stripPartCodes(normalize(raw)).replace(/[-–—\s]+$/, "").trim();
  name = name.replace(/^(order|set)\s*[,:]\s*/i, "").trim();
  if (/^(order|set)$/i.test(name)) return "";
  return name.replace(/[,;.]+$/, "").trim();
}

function matchTerm(name: string): string {
  const hit = TERM_LV.find(({ re }) => re.test(name));
  return hit ? hit.lv : "";
}

function matchQualifier(name: string): string {
  const hit = QUALIFIER_LV.find(({ re }) => re.test(name));
  return hit ? hit.lv : "";
}

function capitalizeLv(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function translateCore(name: string): string {
  const direct = matchTerm(name);
  if (direct) return direct;

  const trailing = name.match(
    /^(.*?)\s+(front|rear|vorne|hinten|links|rechts|left|right|vorn|oben|unten|black|schwarz)$/i,
  );
  if (trailing) {
    const base = matchTerm(trailing[1]!.trim());
    const qual = matchQualifier(trailing[2]!);
    if (base && qual) return `${base} (${qual})`;
  }

  if (OIL_PREFIX_RE.test(name)) {
    const spec = name.replace(OIL_PREFIX_RE, "").trim();
    return spec ? `Motoreļļa ${spec}` : "Motoreļļa";
  }
  if (BRAKE_FLUID_PREFIX_RE.test(name)) {
    const spec = name.replace(BRAKE_FLUID_PREFIX_RE, "").trim();
    if (!spec) return "Bremžu šķidrums";
    const specLv = matchQualifier(spec) || matchTerm(spec);
    return specLv ? `Bremžu šķidrums (${specLv})` : `Bremžu šķidrums ${spec.toUpperCase()}`;
  }

  return name;
}

function translateCommaList(name: string): string {
  const parts = name.split(/\s*[,;]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return "";

  const base = matchTerm(parts[0]!);
  const quals = parts.slice(1).map(matchQualifier);
  if (base && quals.every(Boolean)) return `${base} (${quals.join(", ")})`;

  const translated = parts.map((part) => {
    const qual = matchQualifier(part);
    const term = translateCore(part);
    if (qual && term === part) return qual;
    return term;
  });
  if (translated.every((t, i) => t === parts[i])) return "";
  return translated
    .map((t, i) => (i === 0 ? capitalizeLv(t) : t))
    .join(", ");
}

function translateParenthetical(name: string): string {
  const m = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!m) return "";
  const outerRaw = m[1]!.trim();
  const innerRaw = m[2]!.trim();
  if (!outerRaw || !innerRaw) return "";
  const outer = translateCore(outerRaw);
  const innerParts = innerRaw.split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);
  const inner = innerParts.map((part) => matchQualifier(part) || translateCore(part));
  if (outer === outerRaw && inner.every((t, i) => t === innerParts[i])) return "";
  return `${outer} (${inner.join(", ")})`;
}

/**
 * Viens darba / detaļas nosaukums latviski.
 * Zināmais termins tiek tulkots pēc nozīmes; nezināmais paliek oriģinālvalodā (AI slānis).
 */
export function serviceWorkTermLv(raw: string): string {
  const name = preprocess(raw);
  if (!name) return "";

  const direct = translateCore(name);
  if (direct !== name) return direct;

  const comma = translateCommaList(name);
  if (comma) return comma;

  const paren = translateParenthetical(name);
  if (paren) return paren;

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

/** Zīmola eļļa / specifikācija — paliek kā izdrukā, nav „netulkots darbs”. */
const BRAND_OR_SPEC_RE =
  /^(castrol|mobil|shell|liqui\s*molly|total|elf|motul|valvoline|pentosin|ate\b|dot\s*[34]|agm\b)/i;

function looksLikeBrandOrSpec(name: string): boolean {
  if (BRAND_OR_SPEC_RE.test(name)) return true;
  if (/\b\d{1,2}w-\d{2}\b/i.test(name) && name.length < 80) return true;
  if (/^bmw\s+group\s+ll/i.test(name)) return true;
  return false;
}

/**
 * Angļu / vācu paliekas pēc vārdnīcas. „Service Inclusive”, BMW, AGM, viskozitāte
 * zīmola nosaukumā nav tulkojuma caurums.
 */
const FOREIGN_LEFTOVER_RE =
  /\b(with|without|from|into|onto|the|and|or|order|cleaning|fluid|antifreeze|exhaust|radiator|vacuum|holder|cover|module|metering|coolant|gasket|bolt|hex|inner|safety|cleaner|upgrade|see|mail|temperature|acoustic|airbag|union|nitrogen|oxide|fastening|tapping|lightweight|ventilated|canister|microfilter|element|pipe|hose|relay|contact|white|green|cylinder|head|pump|sensor|driver'?s|original|battery|washer|antifreeze|kit|repair|inspection|vehicle|check|brake|disc|pad|engine|spark|plug|wiper|blade|screw|clamp|ring|valve|cable|bracket|housing|seal|nut|clip|make|black|front|rear|side|small|parts|high|low|viscosity)\b/i;

const GERMAN_LEFTOVER_RE =
  /\b(f[üu]r|siehe|nachr[üu]stung|[öo]lzuschlag|kundenloyal|schlauchschelle|dichtung|schraube|reparatur|wartung|fahrzeug|halter|relais)\b|[äöüßÄÖÜ]/i;

const KEEP_PROPER_RE = /\b(service\s+inclusive|bmw(\s+group)?|agm|dot\s*[34]|ll[- ]?\d+\w*)\b/gi;

/**
 * Vai pēc vārdnīcas darba teksts joprojām ir angļu / vācu (nevis latviski noslīpēts).
 * Tukšs un zīmola specifikācija — nē.
 */
export function looksLikeUntranslatedServiceWork(raw: string): boolean {
  const name = serviceWorkTermLv(raw);
  if (!name) return false;
  if (/detalizēts darbu saraksts/i.test(name)) return false;
  if (looksLikeBrandOrSpec(name) && !FOREIGN_LEFTOVER_RE.test(name.replace(KEEP_PROPER_RE, " "))) {
    return false;
  }
  if (GERMAN_LEFTOVER_RE.test(name)) return true;
  const stripped = name.replace(KEEP_PROPER_RE, " ");
  return FOREIGN_LEFTOVER_RE.test(stripped);
}

/** Vai servisa vēsturē palikuši netulkoti darbu nosaukumi. */
export function serviceHistoryNeedsLvTranslation(entries: { works: string[] }[]): boolean {
  return entries.some((e) => e.works.some(looksLikeUntranslatedServiceWork));
}

/** Unikālie netulkotie darbi (pēc vārdnīcas), AI slānim. */
export function collectUntranslatedServiceWorks(entries: { works: string[] }[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of entries) {
    for (const raw of entry.works) {
      const name = serviceWorkTermLv(raw);
      if (!name || !looksLikeUntranslatedServiceWork(name)) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

/** AI tulkojumu karte → latviski noslīpēti darbi (tukšie izmesti). */
export function applyServiceWorkTranslations<T extends { works: string[] }>(
  entries: T[],
  translations: Record<string, string>,
): T[] {
  const map = new Map<string, string>();
  for (const [from, to] of Object.entries(translations)) {
    const key = from.replace(/\s+/g, " ").trim().toLowerCase();
    const lv = to.replace(/\s+/g, " ").trim();
    if (key && lv) map.set(key, lv);
  }
  return entries.map((entry) => ({
    ...entry,
    works: serviceWorkTermsLv(entry.works.map((w) => map.get(serviceWorkTermLv(w).toLowerCase()) ?? w)),
  }));
}
