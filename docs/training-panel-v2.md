# 08. Admin „Agregātu zināšanas” (apmācība) panelis: kā strādā un redizains

## Kā strādā tagad (repo `ba7bebd6`)
- Lapa: `app/admin/(dashboard)/agregatu-zinasanas/page.tsx`. Komponents: `components/admin/AdminAuditKnowledgePanel.tsx`. API: `app/api/admin/audit-knowledge/route.ts`.
- Pogas: „Atsvaidzināt statusu”, „1. Iemācīties no vēstures (backfill)”, „2. Sagatavot kandidātus (promote)”.
- **Backfill** iziet cauri līdz ~120 pasūtījumiem un katram ar `extractLearningSnippetsFromDraft` izvelk fragmentus no laukiem: Tehnika, Apskate, Kopsavilkums, Nobraukums, Negadījumi, Cena un avotu komentāriem. Glabāšana notiek `admin-audit-learnings-store` pēc atslēgas (dzinēja kods / ģimene / auto „fingerprint”).
- **Arī automātiski**: pēc katras saglabāšanas `recordAuditAggregateLearningFromDraft` raksta fragmentus, ja melnraksts ir „pietiekami pilns” (`fill >= 5` vai fragments ≥120 zīmes). **Nav cilvēka apstiprinājuma.**
- **AI izmanto šos fragmentus uzreiz**: līdz 5 atslēgām × 6 fragmentiem (≤10 500 zīmes) katrā tehnisko risku un citā ✨ ģenerēšanā.
- **Promote** izveido Markdown sarakstu (angliski, izstrādātājam) ar kandidātiem, kuriem ir ≥3 fragmenti, un ieteikumu tos manuāli pārnest uz kodu (`provin-aggregate-case-rules.ts`). Panelī tas netiek rādīts kā saprotams saraksts.
- **Atklāta kļūda**: `distillLesson` tehnikas fragmentam prioritāri izvēlas rindkopas, kas satur „€|EUR”. Tā sistēma iemācās tieši EUR tāmes, kas ir aizliegtas, un var pārnest arī kļūdas (piem. nepareizu ķēdes pusi). N57 klaņu šāles nodilums NAV kļūda: tā ir apstiprināta tipiska kaite (avots: īpašnieks).

## Neskaidrie termini → jaunie latviskie
| Tagad | Jaunais |
|---|---|
| Backfill | Nolasīt vecās atskaites |
| Promote / kandidāti | Ieteiktās zināšanas (gaida apstiprinājumu) |
| Atslēgas / ENGINE|… kodi | Agregāti (dzinēji, kārbas) |
| Fragmenti / snippets | Mācību teikumi |
| Atmiņas stāvoklis | Ko AI zina |
| Cietā paka | Apstiprinātas zināšanas |

## Jaunā plūsma
```
Atskaite saglabāta (tikai NOSŪTĪTA klientam) - Mācību teikums (statuss: KANDIDĀTS)
        │ automātiski: nekāda AI lietošana
        ▼
Panelis „Gaida apstiprinājumu” - Nils/IRISS: ✔ Apstiprināt | ✎ Labot | ✖ Noraidīt (+ iemesls)
        │                                    │
        ▼                                    ▼
    APSTIPRINĀTS (AI lieto kā faktu)      NORAIDĪTS → saraksts „Nepareizi apgalvojumi”
                                          (AI saņem kā aizliegumu, piem. "N57 ķēde priekšā")
```
Noteikumi:
- Kandidāti nāk tikai no atskaitēm ar statusu „nosūtīts klientam” (galīgā versija) un ar `data_quality != partial` faktiem. Stila paraugi drīkst nākt no visām.
- Mācību teikums ir viens apgalvojums: **agregāts + mezgls + km josla + avots** (nevis rindkopa). Ģenerē lēts modelis no galīgā teksta. EUR teikumi netiek ņemti.
- Katram ierakstam: kurš apstiprināja, kad, no kuras atskaites, cik atskaitēs atkārtojas, pēdējo reizi lietots.

## Ekrāni
1. **„Ko AI zina”**: tabula pa agregātiem (N47D20, EA288…) ar apstiprināto, kandidātu un noraidīto skaitu. Klikšķis atver agregāta kartiņu.
2. **Agregāta kartiņa**: apstiprinātās zināšanas pa km joslām (tagad / nākamie 100 000 km), avoti, pogas „Labot” un „Dzēst” (dzēšana ir mīkstā, ar vēsturi).
3. **„Gaida apstiprinājumu”**: rinda ar teikumu, atskaites saiti un konfliktu brīdinājumu (piem. „pretrunā ar apstiprināto: …”).
4. **„Ko AI izmantoja šajā atskaitē”**: pasūtījuma lapā saliekams bloks ar KB ierakstiem un mācību teikumiem, kas tika iedoti AI.
5. **„Nepareizi apgalvojumi”**: noraidītie, kurus AI saņem kā negatīvos piemērus.

## Datu modelis (melnraksts)
```ts
type KnowledgeItem = {
  id: string; aggregate: string;           // "N57D30"
  claim: string;                            // "Sadales ķēde aizmugurē; risks pieaug virs ~200 000 km"
  kmBand?: [number, number]; horizon?: "now" | "next100k";
  status: "candidate" | "approved" | "rejected" | "deleted";
  sources: { type: "report" | "kb" | "url"; ref: string }[];
  fromOrders: string[]; seenCount: number;
  reviewedBy?: string; reviewedAt?: string; rejectReason?: string;
};
```
