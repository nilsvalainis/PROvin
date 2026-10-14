/** Admin ASV (VIN Audit / One Auto) kļūdu teksti latviski. */

export function asvFetchErrorLv(code: string): string {
  switch (code) {
    case "insufficient_balance":
      return "Nepietiekams OneAutoAPI konta atlikums.";
    case "invalid_vin":
      return "Nederīgs VIN.";
    case "missing_oneauto_credentials":
      return "Serverī nav ONEAUTO_API_KEY.";
    case "no_products_selected":
      return "Atzīmē vismaz vienu produktu.";
    case "unauthorized":
      return "Admin sesija beigusies. Ielādē lapu no jauna.";
    case "pending":
      return "VIN Audit vēl apstrādā pieprasījumu. Pagaidi un spied Ielādēt vēlreiz.";
    case "service_not_enabled":
      return "One Auto šo produktu pazīst, bet slēdzis ir OFF. Dashboard → Your Plan ieslēdz Vehicle History Report (US) vai spied Request Access.";
    case "api_unavailable":
      return "One Auto šo US vēstures metodi vēl nav publicējis šai atslēgai. API licences logu nerāda. Dashboard → Your Plan pie VIN Audit spied Request Access un palūdz Markam precīzo API ceļu.";
    case "no_data":
      return "Nav ASV datu";
    case "upstream_error":
    case "network_error":
      return "One Auto API neatbildēja. Mēģini vēlreiz.";
    default:
      if (/^http_5\d{2}$/.test(code) || code === "timeout") {
        return "One Auto API neatbildēja. Mēģini vēlreiz.";
      }
      return "One Auto API neatbildēja. Mēģini vēlreiz.";
  }
}
