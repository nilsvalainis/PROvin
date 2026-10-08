import assert from "node:assert/strict";
import test from "node:test";

import {
  coerceOpenlaneMargin,
  mapOpenlaneAuction,
  openlaneCurrentUserShowsLogin,
  openlaneEnglishUrl,
  openlaneSessionLooksLoggedIn,
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
  assert.equal(coerceOpenlaneMargin(0), false);
  assert.equal(coerceOpenlaneMargin(1), true);
  assert.equal(pickOpenlaneVatNote({ VatType: "inkl. MwSt" }), "inkl. MwSt");
});
