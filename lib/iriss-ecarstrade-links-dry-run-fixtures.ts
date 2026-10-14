import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";
import type { IrissEcarstradeDryRunRecord } from "@/lib/iriss-ecarstrade-links-dry-run";

const NOW = "2026-10-14T00:00:00.000Z";

/** Tipiski Nils filtri (Auto1/Autobid/Openlane/Mobile) bez produkcijas Blob. */
export function ecarstradePreciseLinksDryRunRecords(): IrissEcarstradeDryRunRecord[] {
  return [
    {
      ...emptyIrissPasutijums("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", NOW),
      kind: "pasutijums",
      label: "Anna / Volvo XC60 dīzelis AWD",
      brandModel: "Volvo XC60",
      productionYears: "2018-2022",
      maxMileage: "150000",
      totalBudget: "28000",
      engineType: "dīzelis",
      transmission: "automāts",
      bodyType: "SUV",
      driveType: "4x4",
      preferredColors: "melns, pelēks",
      nonPreferredColors: "dzeltens",
      equipmentRequired: "navigācija",
      dealVat21Required: true,
      listingLinkAuto1: [
        "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2018&firstRegistrationTo=2022&fuelTypes=DIESEL&gearboxes=AUTOMATIC&bodyTypes=SUV&driveTypes=ALL_WHEEL&minMileage=10000&maxMileage=150000&minPrice=12000&maxPrice=28000&powerFrom=110&powerTo=180",
      ],
      listingLinkOpenline: [
        "https://www.openlane.eu/en/findcar?makes=volvo&models=xc60&yearFrom=2018&yearTo=2022&fuels=diesel&transmissions=automatic&mileageTo=180000",
      ],
      listingLinkAutobid: [
        "https://autobid.de/en/search-results?brandId-brand=49&name-model=XC60&yearFrom-year=2018&mileageTo-mileage=160000&gearboxId-gearbox=Automatic",
      ],
      listingLinkEcarstrade: ["https://ecarstrade.com/search?mark[]=68"],
    },
    {
      ...emptyIrissPasutijums("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab", NOW),
      kind: "pasutijums",
      label: "Jānis / Audi A6 Avant quattro",
      brandModel: "Audi A6 Avant",
      productionYears: "2017-2021",
      maxMileage: "160000",
      totalBudget: "24000",
      driveType: "quattro",
      listingLinkAuto1: [
        "https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI&model=A6&driveTypes=ALL_WHEEL&colors=BLACK&doorCount=5&equipment=navigation&excludedModels=Allroad&maxMileage=160000&fuelTypes=DIESEL&gearboxes=AUTOMATIC&bodyTypes=ESTATE&cubicCapacityFrom=2000&cubicCapacityTo=3000&firstRegistrationFrom=2017",
      ],
      listingLinkMobile: [
        "https://suchen.mobile.de/fahrzeuge/search.html?ms=1900&fuels=DIESEL&minFirstRegistrationDate=2017&maxMileage=160000&transmission=AUTOMATIC",
      ],
    },
    {
      ...emptyIrissPasutijums("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac", NOW),
      kind: "pasutijums",
      label: "Māra / BMW 5/7 (tikai forma)",
      brandModel: "BMW 5/7",
      productionYears: "2016+",
      maxMileage: "180000",
      totalBudget: "22000",
      engineType: "dīzelis",
      transmission: "automāts",
    },
    {
      ...emptyIrissPasutijums("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad", NOW),
      kind: "pasutijums",
      label: "Pēteris / Autobid nezināms brandId 12",
      brandModel: "Mercedes E",
      listingLinkAutobid: [
        "https://autobid.de/en/search-results?brandId-brand=12&name-model=E%20220&yearFrom-year=2017&origincountries=FR",
      ],
    },
    {
      ...emptyIrissScanRecord("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", NOW),
      kind: "scan",
      label: "Audi A6 diesel vs petrol",
      brandModel: "Audi A6",
      listingLinkAuto1: [
        "https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI&model=A6&fuelTypes=DIESEL&firstRegistrationFrom=2017",
      ],
      listingLinkMobile: [
        "https://suchen.mobile.de/fahrzeuge/search.html?ms=1900&fuels=PETROL&minFirstRegistrationDate=2017",
      ],
    },
    {
      ...emptyIrissScanRecord("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc", NOW),
      kind: "scan",
      label: "LEXUS/TOYOTA Openlane + Mobile kW",
      brandModel: "LEXUS/TOYOTA",
      listingLinkOpenline: ["https://www.openlane.eu/en/findcar?makes=lexus&makes=toyota&yearFrom=2018"],
      listingLinkMobile: [
        "https://suchen.mobile.de/fahrzeuge/search.html?ms=13900&minPowerAsArray=150&maxPowerAsArray=200",
      ],
    },
    {
      ...emptyIrissScanRecord("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbd", NOW),
      kind: "scan",
      label: "Porsche 176 kW Mobile.de",
      brandModel: "Porsche",
      listingLinkMobile: [
        "https://suchen.mobile.de/fahrzeuge/search.html?make=Porsche&minPowerAsArray=176&maxPowerAsArray=176&minMileage=10000&maxMileage=140000",
      ],
    },
    {
      ...emptyIrissScanRecord("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbe", NOW),
      kind: "scan",
      label: "Volvo XC60 Mobile.de ms=25100",
      brandModel: "Volvo XC60",
      listingLinkMobile: [
        "https://suchen.mobile.de/fahrzeuge/search.html?ms=25100;29;;&minMileage=10000&maxMileage=140000&fuels=DIESEL",
      ],
    },
  ];
}
