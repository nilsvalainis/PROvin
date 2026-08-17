# Mandatory knowledge injection (deployed agents)

Use verbatim substance when syncing into `lib/admin-ai-prompts.ts`. Categorize by model and powertrain in prompt strings.

## 1. MANDATORY KNOWLEDGE INJECTION FOR DEPLOYED AGENTS

Whenever you generate or refactor prompt strings in code, you MUST hardcode the following granular technical vectors into the agent's instructions, categorized by model and powertrain:

### A. AUDI V6 DĪZEĻI & TRANSMISIJAS MATRIX (2008-2015+)

- **3.0 TDI Biturbo (230kW / 313hp and newer - A6 C7, SQ5):**
  - *Transmission:* Paired exclusively with the 8-speed Tiptronic (classic torque converter). High reliability, low risk, completely avoids the dual-mass flywheel failure modes inherent to S-Tronic.
  - *Timing Chains:* Structurally reinforced. Based on 40+ audited biturbo vehicles, timing chains DO NOT rattle or fail up to 300,000 km. Standard V6 chain failure rules do not apply here.
  - *Silent & Fatal Faults:* 1. V-space intercooler coolant leak (independent of mileage, occurs at 200k or 300k km alike, severe engine damage risk if neglected, repair costs: 500-1000 EUR).
    2. Fuel injectors & copper rings: Fail silently without physical symptoms (no audible "cukāšana" like older gens). Must be tested on a professional bench. Defective spray patterns lead directly to burned/melted pistons and total engine destruction.
    3. Plastic thermostat housings: High tendency to crack and leak fluid; require preventative replacement during major front-end service.
  - *Operating Cost:* High thermal and mechanical stress requires a reduced oil interval (strictly 7,000–10,000 km using premium oils). SQ5 braking components are significantly more expensive than standard V6 options.

- **3.0 TDI Single-Turbo Standard (150kW & 180kW - A4, A5, A6 C7, Q5):**
  - *Transmission:* Paired with the high-risk 7-speed S-Tronic (dual-clutch DSG) with a dual-mass flywheel. High probability of internal wear, clutch jerkiness, and mechatronic failure. Deemed a blind risk for remote auction/buying structures unless physically tested.
  - *Timing Chains:* Major structural weakness. Rattle/stretch occurs early, frequently manifesting right around the 200,000 km threshold. High financial entry risk.

- **Older 3.0 TDI Generation (up to 2010/2011 - e.g., Audi A6 C6 Facelift 176kW):**
  - *Powertrain:* 176kW engine + Quattro + 6-speed Tiptronic. Historically the most reliable V6 TDI configuration with minimal electronics overhead.
  - *Chain Lifespan:* Factory chains easily survive 300,000 to 600,000 km without replacement or rattling (proven up to ~600k km without intervention).
  - *Odometer Forensics:* If a C6 Facelift lists a recent chain replacement at ~250,000 km, trigger a high-alert warning for massive odometer rollback (real mileage is likely >500,000 km, matching CarVertical historic patterns).

- **Low-Risk Audit Segment (2.0 TDI Manual / Front-Wheel Drive):**
  - Considered a "risk-free" commuter setup. Simple mechanical layout (timing belt setup, zero transfer case or automatic mechatronic risks). The single primary structural risk factor to note is the cylinder head gasket failure.

### B. MERCEDES-BENZ POWERTRAIN & COMPONENT FORENSICS

- **OM642 (3.0 V6 Diesel - GL, ML, R-Class, E-Class):**
  - *Transmission Parity:* The 7G-Tronic transmission with a dual-mass setup is a high-cost failure risk if worn. Replacing the dual-mass setup can cost as much as sourcing a used, healthy 7G-Tronic assembly (approx. 500-600 EUR) and recoding the TCU module.
  - *9G-Tronic Integration:* Late 2014+ non-4Matic models utilize the 9G-Tronic unit. Note its outstanding fuel efficiency pairing with the 195kW OM642 engine and minimal known fault patterns if fluid service intervals were respected.
  - *Mercedes/Renault Myth-Busting:* Strictly investigate chassis architecture (e.g., W206 C-Class vs A-Class). Explicitly decouple modular luxury chassis from Renault architecture to clear widespread market misconceptions, unless checking smaller 4-cylinder entry platforms.

### C. HIGH FINANCIAL RISK ENGINE SEGMENTS (RED FLAGS)

- **BMW N57 (3.0D Single/Twin Turbo):** Strict financial red flag for used buyers. Disastrous rates of catastrophic timing chain snaps and rapid spun rod bearings. *Critical Mechanic Error:* When doing preventative chain repairs, mechanics routinely omit replacing the oil pump. A worn oil pump causes immediate low oil pressure and total block destruction (5,000–10,000 EUR loss) shortly after the repair. Advise switching to Volvo or Mercedes alternatives rather than absorbing N57 risks.
- **BMW M57 / M57TU / M57T2 (E60/E61 525d/530d, 3.0D, chain at FRONT):** Do NOT apply N47/N57 rear-chain narrative. 300k km with dense DE service is typical working life, not end-of-life (often 400–500k). Primary near-term cost on **E61 Touring** is factory rear air suspension (bags/compressor), not the engine. Typical M57 upkeep at 250–350k: oil-filter housing gasket, valve cover, vacuum pump, turbo lines, viscous fan clutch (hidromufte), water pump/thermostat; swirl flaps still likely on 2008 M57T2 (unproven ≠ not done). ZF 6HP19 “lifetime” ATF is a myth — fluid+filter every 60–80k. Age-related E60/E61 electronics (ELV, FRM, CIC) are long-term fussiness, not proof the car is failing now. If equipment list supports it, name **absent** expensive options as a TCO strength: Active Steering, Dynamic Drive, Soft Close, Logic 7, xDrive. Lifestyle Edition = leather/comfort, not chassis hydraulics.
- **BMW M47 vs N47 (2.0D):** While N47 chains stretch early (100k-150k km), a clean, well-maintained N47 requiring a chain service is mechanically superior to a completely run-down, end-of-life M47 unit.
- **VW/Audi 1.8 & 2.0 TFSI (2008-2013):** Massive structural design flaw leading to extreme oil consumption ("rij eļļu nejēgā"), skipped timing chains, and premature cylinder head cracking. Avoid entirely.
- **Volvo 2.4 D5 Biturbo (2009+ / Black Engine Cover - 151kW, 158kW, 162kW):** High risk of structural engine block cracks between cylinders. Silent symptoms: continuous unexplained coolant loss and the vehicle's heating system suddenly blowing cold air during active driving. Results in a write-off of the engine block.
- **Opel 1.6D & Small Displacement Petrols:** Defective engineering profiles where chains stretch and rattle as early as 100,000–150,000 km (worse than standard VW belt service life at 200k km).
- **PSA Wet Belt Systems (Peugeot, Citroen, Ford crossovers):** Timing belts running submerged in oil degrade chemically. The rubber debris completely clogs the oil pickup tube, starving the top end and killing the engine.

### D. ELECTRIC (BEV) & PLUG-IN (PHEV) FORENSICS

Sync full deployed text from `AI_EV_BEV_FORENSICS_RULES` in `lib/source-summary-comment-format.ts`. Core vectors for agents:

- **SOH is not sufficient alone** — pair with charging profile, climate, km, warranty, real range.
- **Charging:** explain **20–80 %** daily SOC sweet spot; risk from habitual **100 %** and frequent **DC fast charging** vs **AC home** (3.7–22 kW).
- **PHEV:** still audit ICE service (oil, DPF/AdBlue if diesel, transmission); HV battery habits matter.
- **Klātienē:** SOH/BMS if shown, 12 V aux battery, charge port/cables, regen, range realism, HV coolant service history, post-accident underbody/HV zone repairs, CCS/Type 2 for EU imports.
- **Summary field:** mandatory battery/charging paragraph when the audited vehicle is electric.

### E. MANUFACTURER AGGREGATE CASE PACKS (all brands)

Deployed runtime selection: `selectAggregateCasePacks()` in `lib/provin-aggregate-case-rules.ts` + per-report learnings in `provin_audit_aggregate_learnings.json`.

Covers: VAG (3.0 TDI matrix, 2.0 TDI DSG, TFSI), Mercedes OM642/651, BMW M57/E60/E61, BMW N47/N57, Volvo D5/Haldex, PSA wet belt/PureTech, Renault/Nissan, Toyota/Lexus hybrid, Ford EcoBoost/Powershift, Hyundai/Kia incl. E-GMP, Tesla, generic EV, Japanese brands, generic DE→LV ICE fallback.

Each pack must drive **summary verdict** + **inspection actions** per §1b.

## 1b. SUMMARY + INSPECTION RISK LINKAGE (mandatory)

Whenever prompts generate **2. Kopsavilkums** or **Ieteikumi klātienes apskatei**, the agent MUST:

- Convert known model/powertrain weaknesses into a **concrete technical risk verdict for this exact car** (engine, gearbox, chain/belt, turbo, AWD, cooling, HV battery, reducer, mechatronics, etc.), not only generic reputation.
- Classify each relevant aggregate as one of:
  - **primary purchase risk / financial blocker**
  - **popular problem at this mileage** (never „medium maintenance risk” + a price)
  - **inspection control point only**
- Tie every important aggregate risk to a **specific verification action** in the inspection field: cold-start noise, shift quality, vibration, leak traces, thermal behavior, fault scan, boost pull, HV diagnostics, DC charging test, underbody inspection, etc.
- In summary, name which aggregate is most likely to generate the biggest near-term issue and whether that changes the buy / inspect / avoid recommendation — **without EUR figures**. Listing/market prices stay in the price field; recorded insurance EUR in incidents. **Never** invented repair/service prices in technical risks or any other comment.

## 1c. AGGREGATE IDENTIFICATION & MILEAGE-BAND CALIBRATION (mandatory)

Deployed text: `AI_POWERTRAIN_IDENTIFICATION_RULES` + `AI_MILEAGE_BAND_RISK_RULES` in `lib/source-summary-comment-format.ts`, injected into `PROVIN_FIELD_AGENT_SYSTEM` and `PROVIN_EXPERT_SYSTEM_PROMPT`. Pre-digested vehicle parameters: `buildAggregateIdentificationBrief()` in `lib/admin-ai-aggregate-identification.ts` (used by technical risks + inspection prompts).

**1. Tehnisko risku analīze is the highest-value comment in the report** — the agent must behave like a senior technical expert on that exact brand/model/generation/engine/gearbox, not a generic used-car reviewer. Default 350–800 character brevity **does not apply**. Target **8–12 detailed paragraphs** (see `AI_TECHNICAL_RISKS_FLAGSHIP_RULES`). Static packs cover only a few generations; for everything else **web-search European forums first** (`AI_TECHNICAL_RISKS_RESEARCH_RULES`), then write. Weak output = generic EGR/DPF/turbo blurb. Strong output = identified aggregate, mileage-band meaning for **this engine / this generation**, expensive options that are **absent**, 1–2 near-term issues classified as **ir / nav populāra problēma** (**no EUR quotes**), each distinct system, long-term age fussiness separated from “this car will fail soon”, hedged outlook from THIS car’s data.

Client vocabulary (mandatory): never „Baltija” (say **Latvija**, or **Lietuva** / **Igaunija** if that is the origin); never „saime”; **Quattro** not „Quattro trakts”; **kardāna krustiņi** not „kardāna krusteniskie”; **karājošais gultnis** not „centra gultnis”; never „vidējs uzturēšanas risks” with a price.

Wrong: `Quattro trakts ar Torsen centrālo diferenciāli šai paaudzei ir salīdzinoši izturīgs; kardāna krusteniskie un centra gultnis pie šī nobraukuma ir vidējs uzturēšanas risks (orientējoši 300-600 €).`

Right: `Quattro ar Torsen centrālo diferenciāli šai paaudzei ir salīdzinoši izturīgs; kardāna krustiņi un karājošais gultnis pie šī nobraukuma nav populāra problēma.`

Identification before risk:

- Derive in order: model **generation / facelift** (make + model + first registration year) → **engine type** (fuel + cm³ + kW + Euro class) → **transmission type** (manual / torque-converter AT / dry or wet dual-clutch / CVT / EV reducer) → **drive layout** (FWD / RWD / AWD architecture: Haldex, Torsen, 4Matic, xDrive). Never say „saime” in client Latvian.
- Evidence priority: dealer/Outvin/AUTO RECORDS **engine code** + type code → CSDD technical parameters → VIN → listing badges (quattro, 4Matic, xDrive, DSG, Tiptronic) → service records naming replaced parts.
- No engine code in sources → name **1–2 ranked candidates as a hypothesis** plus how to confirm (VIN decode, engine bay marking, gearbox plate, service invoices). An inferred code must never be written as a registry-read fact.
- Same displacement/power mapping to materially different architectures (chain vs belt, dry vs wet DCT, with/without DPF) → state it and split into **max two** scenarios.
- Too little data → analyze **pēc pieejamajiem datiem, bez precīza koda** and say the exact aggregate is undetermined; never invent codes.
- Risks apply only to the identified combination — never import another engine version's or generation's failure modes because the brand matches.

Mileage-band calibration (anti-exaggeration):

- Fix approximate **current km** (latest credible odometer) and **km/year**; if odometer data conflicts, work with a stated range.
- Split every aggregate risk into: (1) resource typically already consumed at this km/age → must be evidenced in service history; (2) **next window** ~20–40k km or 1–2 years → the buyer's real cost; (3) distant resource → brief or omitted.
- A failure typical at 250k km must not be presented as an active threat at 90k km. **Max 1–2 primary purchase risks**; everything else is a popular-problem question or an inspection control point.
- Age ≠ mileage: rubber, plastics, cooling, belts, hoses degrade on time — a low-km old car can be worse than a high-km highway car. Combine with §2 motorstundas math.
- Evidence lowers risk: a documented chain / DCT oil / belt / water pump job is a **favourable signal in the data**; missing records = **unproven**, not "not done".
- Prioritize by **probability and whether it is a popular problem** at this mileage. **Never** output approximate repair/service EUR in comments (no „orientējoši … €”, no parenthetical bands, no „Baltijas servisa līmenis”). EUR is allowed only for recorded insurance claims and listing/market prices in „Cenas vērtējums”.
- When the picture is relatively favourable, the agent must say so (hedged, PROVIN has not inspected the car physically). Fabricated red flags are as damaging as silence about real risks.

## 2. DRIVING PROFILE & MOTORSTUNDAS MATH

Instruct the backend agent to always run this factual analysis when calculating oil life quality:

- Deployed target life for high-grade motor oil is 200–250 engine hours (*motorstundas*).
- **City Profile Math:** 10,000 km at an average speed of 35 km/h = **285 engine hours** (already past safe oil breakdown limits). If a city car follows a 20,000 km factory long-life interval, it runs for **570 hours**—guaranteeing sludge, chain stretch, and bearing wear.
- **Highway Profile Math (DE Autobahn):** 10,000 km at an average speed of 80 km/h = **125 engine hours**. Therefore, a 250,000 km highway vehicle can possess internal components that are mechanically twice as fresh as a 150,000 km urban stop-and-go vehicle.
- If data density is sparse, block the agent from guessing the driving profile; fall back to the conservative city-wear advisory.

## 3. REGIONAL & FORENSIC SIGNATURES

- **DE (Germany):** Autobahn stress profile. Pristine undercarriages (no rust except alpine regions), but heavy stone-chip density on front fascia/windshields. If completely flawless, check for post-accident resprays.
- **Baltics (LV, LT, EE):** Corrosion and structural stress profile. Heavy salt rust on brake lines and suspension components. Extreme wear on bushings from poor roads. High risk of commercial fleet history and VAT rotation schemes. Lithuania is a high-risk hub for fast-turnaround rebuilds of USA salvage imports. **Client copy:** name **Latvija**, **Lietuva**, or **Igaunija** — NEVER „Baltija”.
- **Southern EU (FR, IT, ES):** Cosmetic and thermal wear profile. Clear coat failure, brittle door weatherstrips, dried interior plastics/Artico trim. High density of parking scrapes, missing service history/gaps, but absolute zero rust and immaculate suspension links.
- **USA/Canada:** Salvage framework. Mandate verification of raw Copart/IAAI auction photos to evaluate structural repair integrity and lighting/navigation conversion codes.
