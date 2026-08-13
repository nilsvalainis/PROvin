/**
 * tjekbil.dk — Dānijas Motorregister (DMR), Færdselsstyrelsen tehniskās apskates,
 * Motorstyrelsen odometra ieraksti, Bilbogen ķīlas, meklēto TL saraksts.
 * Publisks JSON, bez autorizācijas un bez captcha — browsers nav vajadzīgs.
 */
const BASE = "https://www.tjekbil.dk/api/v3";

const HEADERS = {
  accept: "application/json",
  "accept-language": "da-DK,da;q=0.9,en;q=0.8",
  referer: "https://www.tjekbil.dk/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

const MILEAGE_ORIGIN = {
  10: "Færdselsstyrelsen (tehniskā apskate)",
  20: "Motorstyrelsen (nodokļu reģistrs)",
  30: "Pirmā reģistrācija",
};

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 404) return { status: 404, data: null };
  if (!res.ok) return { status: res.status, data: null, error: `HTTP ${res.status}` };
  const text = await res.text();
  if (!text.trim()) return { status: res.status, data: null };
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: null, error: "nav derīgs JSON" };
  }
}

export async function fetchTjekbil(vin) {
  const started = Date.now();
  const raw = {};
  const main = await getJson(`${BASE}/dmr/vin/${encodeURIComponent(vin)}`);
  raw.dmr = main.data;

  if (!main.data) {
    return {
      source: "tjekbil.dk",
      country: "DK",
      vin,
      found: false,
      note: main.status === 404 ? "VIN nav Dānijas reģistrā" : main.error ?? `HTTP ${main.status}`,
      raw,
      durationMs: Date.now() - started,
    };
  }

  const basic = main.data.basic ?? {};
  const extended = main.data.extended ?? {};
  const kid = basic.koeretoejId ?? extended.general?.kid ?? extended.carId;
  const regNr = basic.regNr ?? null;

  const [mileage, wanted, rapex, prices] = await Promise.all([
    kid ? getJson(`${BASE}/vehicles/mileagelogs?dmrId=${kid}`) : { data: null },
    kid ? getJson(`${BASE}/wanted-vehicles/getwantedvehiclehistory?dmrId=${kid}`) : { data: null },
    kid ? getJson(`${BASE}/rapex/alerts?dmrId=${kid}`) : { data: null },
    getJson(`${BASE}/prices/history?vin=${encodeURIComponent(vin)}`),
  ]);
  raw.mileagelogs = mileage.data;
  raw.wantedHistory = wanted.data;
  raw.rapexAlerts = rapex.data;
  raw.priceHistory = prices.data;

  return {
    source: "tjekbil.dk",
    country: "DK",
    vin,
    found: true,
    regNr,
    kid: kid ?? null,
    vehicle: {
      make: basic.maerkeTypeNavn ?? null,
      model: basic.modelTypeNavn ?? null,
      variant: basic.variantTypeNavn ?? null,
      modelYear: basic.modelAar ?? null,
      firstRegistration: basic.foersteRegistreringDato ?? null,
      fuel: basic.drivkraftTypeNavn ?? null,
      enginePowerKw: basic.motorStoersteEffekt ?? null,
      color: basic.farveTypeNavn ?? null,
      bodyType: basic.karrosseriTypeNavn ?? null,
      use: basic.koeretoejAnvendelseNavn ?? null,
    },
    mileage: (mileage.data ?? [])
      .filter((m) => !m.isHidden)
      .map((m) => ({
        km: m.mileage,
        date: m.mileageAt,
        origin: MILEAGE_ORIGIN[m.origin] ?? `origin:${m.origin}`,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date)),
    inspections: (main.data.inspectionData?.rapporter ?? []).map((r) => ({
      date: r.synsdato,
      type: r.synstype,
      category: r.kategori,
      result: r.synsresultat,
      km: r.kmstand ?? null,
      station: r.firma,
      faults: (r.fejl ?? [])
        .map((f) => (typeof f === "string" ? f : [f.title, f.description].filter(Boolean).join(": ")))
        .filter(Boolean),
    })),
    legal: {
      status: basic.status ?? null,
      statusDate: basic.statusDato ?? null,
      secondaryStatus: extended.general?.sekundaerStatus ?? null,
      blocked: extended.general?.blockedStatus ?? null,
      leased: basic.bilLeaset ?? null,
      leasingFrom: basic.leasingGyldigFra ?? null,
      leasingTo: basic.leasingGyldigTil ?? null,
      conditionAfterImport: extended.general?.standEfterImport ?? null,
      debtDocuments: main.data.debtData?.laaneDokumenter ?? [],
      bankruptcy: main.data.debtData?.konkurs ?? null,
      statusHistory: basic.statusHistory ?? [],
      permissions: basic.permissions ?? [],
    },
    insurance: {
      current: extended.insurance?.selskab ?? null,
      status: extended.insurance?.status ?? null,
      since: extended.insurance?.oprettet ?? null,
      history: (extended.insurance?.historik ?? []).map((h) => ({
        company: h.selskab,
        status: h.status,
        created: h.oprettet,
      })),
    },
    wanted: wanted.data ?? [],
    recalls: rapex.data ?? [],
    raw,
    durationMs: Date.now() - started,
  };
}
