// Neobligāts: kopē uz /root/iriss-ttr/waybill-adapter.cjs, ja main.js jau prot kādu soli labāk nekā waybill-ui.json selektori.
// Katrs eksports aizstāj vienu draivera soli (waybill-driver.mjs). Sargi (tīkls, DOM klikšķi, dialogi) paliek spēkā.
// STINGRI: šeit NEDRĪKST izsaukt main.js funkcijas, kas pārtrauc/anulē/beidz pavadzīmi. Tikai jaunas pavadzīmes soļi.
// main.js drīkst prasīt tikai, ja tas eksportē funkcijas un augšējā līmenī neko nepalaiž (pārbaudi:
//   grep -n "module.exports\|exports\.\|require.main" /root/iriss-ttr/main.js).
//
// const main = require("./main.js");
//
// module.exports = {
//   // Pēc VIN atrod tirdzniecības aktu un spiež "Noformēt pavadzīmi"; false, ja akta nav.
//   async openFromTradeAct(page, input, h) {
//     return main.openTradeAct ? main.openTradeAct(page, input.vin) : false;
//   },
//   async fillForm(page, values, h) {
//     if (main.fillWaybillForm) return main.fillWaybillForm(page, values);
//   },
//   // Tikai lasīšana: ja numuram jau ir aktīva pavadzīme -> { waybillNo }, citādi null.
//   async findActiveWaybill(page, input, h) {
//     return null;
//   },
// };
module.exports = {};
