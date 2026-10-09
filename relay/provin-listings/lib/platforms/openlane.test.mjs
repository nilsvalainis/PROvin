import assert from "node:assert/strict";
import test from "node:test";

import {
  coerceOpenlaneMargin,
  mapOpenlaneAuction,
  openlaneCurrentUserShowsLogin,
  openlaneEnglishUrl,
  openlaneSessionLooksLoggedIn,
  parseOpenlaneTitleFuelTransmission,
  pickOpenlaneRegistration,
  pickOpenlaneVatNote,
} from "./openlane-logic.mjs";

test("openlaneEnglishUrl forces /en/ and keeps the query", () => {
  assert.equal(
    openlaneEnglishUrl("https://www.openlane.eu/ru/findcar?makes=volvo"),
    "https://www.openlane.eu/en/findcar?makes=volvo",
  );
  assert.equal(openlaneEnglishUrl("https://www.openlane.eu/en/findcar"), "https://www.openlane.eu/en/findcar");
  assert.equal(openlaneEnglishUrl("https://www.openlane.eu/de/car/A1"), "https://www.openlane.eu/en/car/A1");
});

test("CurrentUserDetails JSON means logged in; empty or unauthenticated does not", () => {
  assert.equal(openlaneCurrentUserShowsLogin({ UserName: "Nils" }), true);
  assert.equal(openlaneCurrentUserShowsLogin({ Data: { Email: "a@b.c" } }), true);
  assert.equal(openlaneCurrentUserShowsLogin({ IsAuthenticated: true }), true);
  assert.equal(openlaneCurrentUserShowsLogin({ IsAuthenticated: false, UserName: "x" }), false);
  assert.equal(openlaneCurrentUserShowsLogin({}), false);
  assert.equal(openlaneCurrentUserShowsLogin(null), false);
});

test("login is #loginButton2 / CurrentUserDetails, not ChassisNumber", () => {
  assert.equal(
    openlaneSessionLooksLoggedIn({
      url: "https://www.openlane.eu/ru/findcar",
      loginButtonPresent: false,
      currentUserJson: null,
      pageText: "Привет Nils | Мой аккаунт",
    }),
    true,
  );
  assert.equal(
    openlaneSessionLooksLoggedIn({
      url: "https://www.openlane.eu/en/findcar",
      loginButtonPresent: true,
      currentUserJson: null,
      pageText: "Login",
    }),
    false,
  );
  assert.equal(
    openlaneSessionLooksLoggedIn({
      url: "https://www.openlane.eu/en/findcar",
      loginButtonPresent: true,
      currentUserJson: { UserName: "Nils" },
      pageText: "Login",
    }),
    true,
  );
  assert.equal(
    openlaneSessionLooksLoggedIn({
      url: "https://id.openlane.eu/login",
      loginButtonPresent: false,
      currentUserJson: null,
      pageText: "My account",
    }),
    false,
  );
});

test("mapOpenlaneAuction keeps RU/EN VAT labels and IsMargin", () => {
  const ru = mapOpenlaneAuction({
    AuctionId: "A1",
    CarNameEn: "Volvo XC60",
    CountryCode: "DE",
    IsMargin: false,
    VatType: "Без НДС",
  });
  assert.equal(ru.isMargin, false);
  assert.equal(ru.vatNote, "Без НДС");

  const ruIncl = mapOpenlaneAuction({
    AuctionId: "A2",
    CarName: "BMW",
    CountryCode: "DE",
    IsMargin: false,
    VatText: "С НДС",
  });
  assert.equal(ruIncl.vatNote, "С НДС");
  assert.equal(ruIncl.isMargin, false);

  const margin = mapOpenlaneAuction({ AuctionId: "A3", CarName: "Audi", IsMargin: true, VatType: "Маржа" });
  assert.equal(margin.isMargin, true);
  assert.equal(margin.vatNote, "Маржа");

  const enExcl = mapOpenlaneAuction({ AuctionId: "A4", CarName: "X", IsMargin: false, VatType: "VAT excluded" });
  assert.equal(enExcl.vatNote, "VAT excluded");
  assert.equal(typeof enExcl.isMargin, "boolean");
  assert.equal(coerceOpenlaneMargin(0), false);
  assert.equal(coerceOpenlaneMargin(1), true);
  assert.equal(pickOpenlaneVatNote({ VatType: "inkl. MwSt" }), "inkl. MwSt");
});

test("mapOpenlaneAuction fills fuel/transmission from title when FuelTypeId is 0", () => {
  const fromTitle = mapOpenlaneAuction({
    AuctionId: "A5",
    CarNameEn: "Volvo XC40 1.5 T2 129hp - Petrol - Automatic",
    FuelTypeId: 0,
    TransmissionTypeId: 0,
    FuelType: 0,
    Fuel: "",
    Transmission: 0,
  });
  assert.equal(fromTitle.fuel, "Petrol");
  assert.equal(fromTitle.transmission, "Automatic");
  assert.deepEqual(parseOpenlaneTitleFuelTransmission("BMW 320d xDrive - Diesel - Manual"), {
    fuel: "Diesel",
    transmission: "Manual",
  });

  const named = mapOpenlaneAuction({
    AuctionId: "A6",
    CarNameEn: "Volvo XC40 1.5 T2 - Petrol - Automatic",
    FuelType: "Diesel",
    TransmissionType: { Name: "Manual" },
    FuelTypeId: 0,
  });
  assert.equal(named.fuel, "Diesel");
  assert.equal(named.transmission, "Manual");
});

// Anonimizēts īsts findcarv6/search ieraksts (2026-10-09, Mitsubishi Pajero, EN).
const REAL_AUCTION = {
  AuctionId: 9000001,
  CarId: 9000002,
  CarNameEn: "Mitsubishi Pajero 3.2 DI-D InStyle - Diesel - Automatic - 190 hp - 110.608 km",
  DateFirstRegistration: "2017-02-07T00:00:00",
  EndDateExtendedPhase: "0001-01-01T00:00:00",
  BatchStartDate: "2026-10-08T09:00:00",
  BatchEndDate: "2026-10-12T09:40:00",
  CarIdentification: { Make: "Mitsubishi", Model: "Pajero", Year: "", FuelGroup: "Diesel", GearboxGroup: "Automatic" },
  CleanMake: "Mitsubishi",
  CarCountryExtended: "nl",
  CountryCodeDealer: "nl",
  Kw: 140,
  Hp: 190,
  Mileage: 110608,
  IsMargin: true,
};

test("year and first registration come from DateFirstRegistration (real sample)", () => {
  const item = mapOpenlaneAuction(REAL_AUCTION, [], Date.parse("2026-10-09T09:00:00Z"));
  assert.equal(item.year, "2017");
  assert.equal(item.firstRegistration, "2017-02-07");
  assert.equal(item.powerKw, "140");
  assert.equal(item.countryCode, "NL");
  assert.equal(item.manufacturer, "Mitsubishi");
  assert.equal(item.mileageKm, 110608);
});

test("pickOpenlaneRegistration ignores 0001-01-01 and falls back", () => {
  assert.deepEqual(pickOpenlaneRegistration({ DateFirstRegistration: "0001-01-01T00:00:00" }), { year: "", firstRegistration: "" });
  assert.deepEqual(pickOpenlaneRegistration({ FirstRegistrationDate: "/Date(1546300800000)/" }), { year: "2019", firstRegistration: "2019-01-01" });
  assert.equal(pickOpenlaneRegistration({ CarIdentification: { Year: "2015" } }).year, "2015");
  assert.equal(pickOpenlaneRegistration({}, "Volvo V60 2018 D4 - Diesel").year, "2018");
  assert.equal(pickOpenlaneRegistration({}, "Volvo V60 - 110.608 km").year, "");
});
