# Mandatory knowledge injection (deployed agents)

Use verbatim substance when syncing into `lib/admin-gemini-prompts.ts`. Categorize by model and powertrain in prompt strings.

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
- **BMW M47 vs N47 (2.0D):** While N47 chains stretch early (100k-150k km), a clean, well-maintained N47 requiring a chain service is mechanically superior to a completely run-down, end-of-life M47 unit.
- **VW/Audi 1.8 & 2.0 TFSI (2008-2013):** Massive structural design flaw leading to extreme oil consumption ("rij eļļu nejēgā"), skipped timing chains, and premature cylinder head cracking. Avoid entirely.
- **Volvo 2.4 D5 Biturbo (2009+ / Black Engine Cover - 151kW, 158kW, 162kW):** High risk of structural engine block cracks between cylinders. Silent symptoms: continuous unexplained coolant loss and the vehicle's heating system suddenly blowing cold air during active driving. Results in a write-off of the engine block.
- **Opel 1.6D & Small Displacement Petrols:** Defective engineering profiles where chains stretch and rattle as early as 100,000–150,000 km (worse than standard VW belt service life at 200k km).
- **PSA Wet Belt Systems (Peugeot, Citroen, Ford crossovers):** Timing belts running submerged in oil degrade chemically. The rubber debris completely clogs the oil pickup tube, starving the top end and killing the engine.

## 2. DRIVING PROFILE & MOTORSTUNDAS MATH

Instruct the backend agent to always run this factual analysis when calculating oil life quality:

- Deployed target life for high-grade motor oil is 200–250 engine hours (*motorstundas*).
- **City Profile Math:** 10,000 km at an average speed of 35 km/h = **285 engine hours** (already past safe oil breakdown limits). If a city car follows a 20,000 km factory long-life interval, it runs for **570 hours**—guaranteeing sludge, chain stretch, and bearing wear.
- **Highway Profile Math (DE Autobahn):** 10,000 km at an average speed of 80 km/h = **125 engine hours**. Therefore, a 250,000 km highway vehicle can possess internal components that are mechanically twice as fresh as a 150,000 km urban stop-and-go vehicle.
- If data density is sparse, block the agent from guessing the driving profile; fall back to the conservative city-wear advisory.

## 3. REGIONAL & FORENSIC SIGNATURES

- **DE (Germany):** Autobahn stress profile. Pristine undercarriages (no rust except alpine regions), but heavy stone-chip density on front fascia/windshields. If completely flawless, check for post-accident resprays.
- **Baltics (LV, LT, EE):** Corrosion and structural stress profile. Heavy salt rust on brake lines and suspension components. Extreme wear on bushings from poor roads. High risk of commercial fleet history and VAT rotation schemes. Lithuania is a high-risk hub for fast-turnaround rebuilds of USA salvage imports.
- **Southern EU (FR, IT, ES):** Cosmetic and thermal wear profile. Clear coat failure, brittle door weatherstrips, dried interior plastics/Artico trim. High density of parking scrapes, missing service history/gaps, but absolute zero rust and immaculate suspension links.
- **USA/Canada:** Salvage framework. Mandate verification of raw Copart/IAAI auction photos to evaluate structural repair integrity and lighting/navigation conversion codes.
