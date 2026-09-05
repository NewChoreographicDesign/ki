# Woongroep Admin

Een schone, iPad-first, dark-mode beheeromgeving voor een woongroep, gebouwd met
Next.js 15 (App Router), TypeScript, Prisma en Tailwind CSS.

> **Niet-technisch en wil je de app gewoon online zetten?** Volg
> [`INSTALLATIE.md`](./INSTALLATIE.md) — een stap-voor-stap handleiding zonder
> code of terminal. De rest van dit bestand is bedoeld voor ontwikkelaars.

## Architectuur

- **Next.js 15 App Router + TypeScript** — server components voor data, client
  components alleen waar interactie nodig is (toggles, formulieren).
- **Eén Prisma schema** (`prisma/schema.prisma`) met alle entities: `User`,
  `Client`, `Protocol`, `Report`, `Medication` + onomkeerbare
  `MedicationCheck` (met een status: `TAKEN`/`LEAVE`/`NOT_TAKEN`), `WeekPlan`,
  `Todo`, `Presence`, `Handover` (auto-expiry), `Appointment`, `Shift`,
  `Setting`, `AuditLog`, `WeeklyReportPdf` (automatisch gegenereerde
  weekrapport-PDF's, zie [Weekrapport](#weekrapport-automatisch-pdf-archief)
  hieronder). Eén wijziging in `Client` of `Setting` werkt overal door.
  (`Document` bestaat nog in het schema maar wordt niet meer gebruikt — zie
  [Uploads](#uploads-protocollen) hieronder voor waarom het model bleef
  staan.)
- **Auth** — alleen naam + geboortedatum (`DD-MM-JJJJ`), geen wachtwoorden.
  JWT in een `httpOnly`, `secure` cookie (12 uur geldig). Bij inloggen wordt
  automatisch een dienst gestart (ochtend 07:00-15:00 / avond 14:00-23:00,
  Europe/Amsterdam-tijd) — zie hieronder.
- **Tijdzone: Europe/Amsterdam overal.** Vercel's servers draaien in UTC, dus
  elke "wall clock"-berekening (welke dienst nu loopt, wanneer een dienst
  eindigt, wat "vandaag" is voor aanwezigheid, de wekelijkse
  rapportage-reset) converteert expliciet via `Europe/Amsterdam`
  (`lib/utils.ts`) in plaats van op de servertijd te vertrouwen — anders
  schuiven diensten en daggrenzen 1-2 uur op (DST-afhankelijk).
- **Geen e-mail meer.** Vroeger verstuurde de app rapportages, medicatie- en
  to-do-overzichten en agenda-herinneringen automatisch per e-mail (via Resend
  of Gmail SMTP) — dat stuurde cliëntgegevens naar een externe partij zonder
  dat daar per se een geldige AVG-grondslag/verwerkersovereenkomst voor was.
  Dat hele mechanisme is verwijderd. In plaats daarvan trekken admin en
  coördinator zelf een **weekrapport** (`/weekrapport`, reset elke maandag)
  vanuit de app, met een downloadbare `.txt`-export. Zie
  [Weekrapport](#weekrapport-vervangt-e-mail) hieronder.
- **Security** — Zod-validatie op elke input, `requireAuth()` op alle API's,
  géén update/delete op `MedicationCheck` (onomkeerbaar), overdracht wist
  zichzelf (`expiresAt = shiftEinde + 1u`), rolcontrole (alleen admin ziet
  Backend en beheert accounts; Protocollen toevoegen mag iedereen, verwijderen
  blijft admin/coördinator), HTTPS via Vercel, een auditlog van gevoelige
  acties (Backend → Auditlog), automatisch uitloggen na 15 minuten
  inactiviteit, en een optionele apparaatbeveiliging die de app beperkt tot
  vrijgegeven apparaten. Zie
  [Security &amp; privacy](#security--privacy) hieronder voor het volledige
  overzicht van getroffen maatregelen.
- **UI/UX** — dark mode standaard, sky/emerald accenten, grote touch-targets,
  sidebar + overlay voor iPad, responsive, cards, badges, toasts (sonner).
- **Prestatie** — server components voor data-ophaling, minimale client JS,
  geïndexeerde uniques in Prisma.

## Modules

| Module | Route | Omschrijving |
| --- | --- | --- |
| Overzicht | `/dashboard` | "Vandaag per kamer" (weekplanning + agenda-afspraken van vandaag, gegroepeerd per cliëntkamer) bovenaan, daaronder stats + snelle acties |
| Rapportage | `/rapportage` | Rapportage per cliënt/dienst. "Recente rapportages" toont alleen sinds de laatste donderdag |
| Medicatie | `/medicatie` | Per cliënt registreren: Afvinken, Verlof of Niet ingenomen (onomkeerbaar). Weekoverzicht reset elke maandag (zie Weekrapport) |
| Aanwezigheid | `/aanwezigheid` | Aanwezig/afwezig per cliënt, gedeeld tussen alle accounts en diensten — blijft staan tot iemand het weer wijzigt (geen dagelijkse reset) |
| Overdracht | `/overdracht` | Notities die 1 uur na diensteinde verlopen |
| To-Do's | `/todos` | Openstaande taken bovenaan, daaronder het formulier voor een nieuwe taak. Optioneel een dag en "terugkerend (wekelijks)" instellen — een afgeronde terugkerende taak verschijnt automatisch weer als open taak zodra de nieuwe week begint (maandagochtend, via dezelfde cron als het weekrapport). Voor iedereen zichtbaar |
| Agenda | `/agenda` | Aankomende afspraken bovenaan, daaronder het formulier voor een nieuwe afspraak |
| Protocollen | `/protocollen` | Algemene en cliëntspecifieke protocollen, als tekst en/of geüpload bestand, voor iedereen |
| Weekrapport | `/weekrapport` | Automatisch archief van één PDF per kalenderweek (alle acties van die week), 1 jaar bewaard, plus een live overzicht van de lopende week. Admin + coördinator |
| Backend | `/backend` | Cliënten, medewerkers, medicatie beheer, weekplanning, instellingen, auditlog (alleen admin) |

## Vereisten

1. Node.js 20+
2. Een Vercel-account (hosting)
3. Database: lokaal SQLite (al geconfigureerd) → productie Neon.tech of Vercel
   Postgres (gratis tier)
4. (Optioneel) Een gratis [Cloudinary](https://cloudinary.com)-account voor
   protocollen uploaden
5. Eigen domein (aanbevolen voor de PWA)

## Lokaal installeren

```bash
# 1. Installeer dependencies
npm install

# 2. Environment
cp .env.example .env
# Vul .env in: JWT_SECRET (min. 32 tekens), CRON_SECRET, optioneel DEVICE_RESTRICTION_ENABLED/DEVICE_PASSCODE

# 3. Database
npx prisma db push
npx tsx prisma/seed.ts   # of: npm run db:seed

# 4. Start
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Test-logins (na seed)

- `Admin` / `01-01-1980` (admin)
- `Anna Jansen` / `12-05-1985` (coördinator)
- `Mark de Vries` / `03-11-1990` (medewerker)

Dit seed-script is alleen voor lokale ontwikkeling. Een productie-deploy
draait geen seed en bevat dus nooit deze (voorspelbare) accounts — die
omgeving start leeg en stuurt de eerste bezoeker naar `/setup` om zelf een
echt beheerdersaccount aan te maken (zie "Productie op Vercel" hieronder).

## Scripts

```bash
npm run dev         # ontwikkelserver
npm run build       # productie build (draait ook prisma generate)
npm run start       # productie server
npm run lint        # ESLint
npm run typecheck   # TypeScript, geen output
npm run test        # Vitest unit tests
npm run db:push     # Prisma schema naar database
npm run db:seed     # seed testdata
```

## Productie op Vercel

Voor een stap-voor-stap versie zonder terminal, zie [`INSTALLATIE.md`](./INSTALLATIE.md).
Kort samengevat voor ontwikkelaars:

1. Push naar GitHub en importeer het project in Vercel.
2. Koppel een Postgres-database (Vercel Storage → Neon) aan het project —
   dit zet `DATABASE_URL` automatisch.
3. Zet de overige environment variables: `JWT_SECRET`, `CRON_SECRET`,
   optioneel `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` /
   `CLOUDINARY_API_SECRET` (protocollen uploaden — zie de "Uploads"-sectie
   hieronder), en optioneel `DEVICE_RESTRICTION_ENABLED` / `DEVICE_PASSCODE`
   (alleen nodig als je "Apparaatbeveiliging" gaat gebruiken — zie
   [Apparaatbeveiliging](#apparaatbeveiliging) hieronder).
4. Deploy. Het `vercel-build`-script (`package.json`) regelt de rest
   automatisch, in deze volgorde:
   - `scripts/prepare-datasource.js` zet de Prisma datasource-`provider` om
     naar `"postgresql"` zodra `DATABASE_URL` daarnaar wijst (lokaal blijft
     dit `"sqlite"` — er hoeft dus nooit handmatig in `schema.prisma` te
     worden geknipt).
   - `prisma db push` synct het schema met de database (alleen additieve
     wijzigingen; een destructieve wijziging laat de build bewust falen in
     plaats van stilzwijgend data te verwijderen).
   - `next build`.
5. Open de live URL. Zolang er nog geen enkele gebruiker bestaat, stuurt de
   app je automatisch naar `/setup`: daar maak je eenmalig het eerste
   (admin-)account aan. Deze pagina kan daarna nooit meer opnieuw gebruikt
   worden.

### Cron jobs

`vercel.json` bevat de cron-configuratie:

- `/api/cron/retention-purge` — maandelijks (1e van de maand, 04:00 UTC),
  verwijdert `AuditLog`-rijen ouder dan ~2 jaar. Raakt geen cliëntgegevens
  (rapportages, medicatie, protocollen, ...) — zie
  [Bewaartermijnen](#bewaartermijnen-retention) hieronder voor waarom.
- `/api/cron/weekly-report` — elke maandag 02:00 UTC, archiveert de afgelopen
  week als PDF en ruimt PDF's ouder dan ~1 jaar op — zie
  [Weekrapport](#weekrapport-automatisch-pdf-archief) hieronder.

Beide cron-routes vereisen de header `Authorization: Bearer <CRON_SECRET>`
(Vercel Cron stuurt dit automatisch mee wanneer `CRON_SECRET` is ingesteld).

### Uploads (protocollen)

**Protocollen** (`/protocollen`, hoofdmenu, elke rol mag toevoegen) staan
niet verplicht als tekst: `Protocol.content` en `Protocol.url` zijn allebei
optioneel, zolang er minimaal één is ingevuld (afgedwongen door een
`.refine()` op `protocolSchema`). Een geüpload bestand (PDF, Word, Excel,
afbeelding, tekst — max 4 MB) gaat als `multipart/form-data` naar
`app/api/protocols/upload/route.ts` (dezelfde origin, na een
`requireAuth()`-check en een whitelist van toegestane content-types uit
`lib/file-upload.ts`), die op de server zelf het bestand naar
[Cloudinary](https://cloudinary.com) stuurt (`lib/cloudinary.ts`). Voortgang
wordt bijgehouden via een `XMLHttpRequest`-helper (`lib/client-upload.ts`)
omdat `fetch()` geen upload-voortgang kan rapporteren.

Bestanden gaan via onze eigen server (niet rechtstreeks van de browser naar
Cloudinary), dus de bestandslimiet blijft 4 MB — dat is Vercel's harde
platformlimiet voor het request-body van één Serverless Function.

Elke upload zet expliciet `access_mode: "public"` mee (in
`lib/cloudinary.ts`): een nieuw Cloudinary-account levert niet-afbeeldingen
(PDF, Word, Excel, tekst) standaard af als `"authenticated"`, wat een `401`
oplevert voor iedereen behalve de accounteigenaar zelf zodra die link wordt
geopend. Dit voorkomt dat.

> **Let op bij Cloudinary-instellingen:** los van bovenstaande blokkeert een
> nieuw Cloudinary-account soms ook de aflevering van PDF/ZIP-bestanden
> volledig (een apart, account-breed beveiligingsschakelaartje). Krijg je
> alsnog een `401` bij het openen van een geüpload PDF-bestand? Zet dan
> **Settings → Security → "Allow delivery of PDF and ZIP files"** aan in het
> Cloudinary-dashboard.

Zonder Cloudinary-configuratie (`CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/
`CLOUDINARY_API_SECRET` ontbreken) geeft die route een `503` met
`code: "STORAGE_NOT_CONFIGURED"` terug; de UI toont dan een duidelijke
melding — een protocol kan dan nog steeds als tekst en/of link worden
toegevoegd.

> **De Documenten-module (upload + hoofdmenu-weergave) is verwijderd** uit de
> app. Het onderliggende `Document`-model staat nog wel in
> `prisma/schema.prisma`, bewust ongebruikt: het verwijderen zou `prisma db
> push` bij de volgende deploy laten falen als destructieve wijziging (of
> stilzwijgend bestaande documentgegevens verwijderen op een live
> installatie). Was er al iets geüpload? Dat blijft gewoon in de database
> staan, alleen niet meer zichtbaar in de app.

**Cliënten** hebben een optioneel "Kamer"-veld (`Client.room`), instelbaar
bij aanmaken en direct in de lijst te wijzigen (Backend → Cliënten). Het
dashboard gebruikt dit veld om de "Vandaag per kamer"-sectie te groeperen:
per kamer wordt getoond welke weekplanning-activiteiten en agenda-afspraken
voor vandaag gepland staan, zodat wie inlogt in één oogopslag ziet wat er per
kamer speelt. Cliënten zonder kamer verschijnen onder "Geen kamer";
afspraken zonder gekoppelde cliënt onder "Algemeen". "Vandaag" en de
dag-van-de-week-berekening zijn Europe/Amsterdam-bewust (zie
`todayDayOfWeek()` in `lib/utils.ts`), net als de rest van de app.

### Weekrapport (automatisch PDF-archief)

De app verstuurde vroeger rapportages, medicatie- en to-do-overzichten en
agenda-herinneringen automatisch per e-mail. Dat is verwijderd: het stuurde
gevoelige cliëntgegevens naar een externe e-maildienst zonder dat daar per se
een geldige verwerkersovereenkomst/AVG-grondslag voor was, en voegde een
derde partij (Resend of een Gmail-account) toe aan de verwerkingsketen.

In plaats daarvan legt de app **elke maandagochtend automatisch de
afgelopen week vast als PDF** — geen handmatige download/opmaak meer nodig:

- **Cron** `/api/cron/weekly-report` (`vercel.json`, elke maandag 02:00 UTC)
  bepaalt de zojuist afgesloten week (`mostRecentMondayStart()` in
  `lib/utils.ts` min 7 dagen), haalt alle rapportages, medicatieregistraties,
  to-do's en afspraken van precies die week op (`getWeeklyReportData()` in
  `lib/weekly-report.ts`, met een expliciete boven- én ondergrens zodat een
  latere week nooit in een al-gearchiveerde PDF lekt), rendert dat als PDF
  (`renderWeeklyReportPdf()` in `lib/weekly-report-pdf.ts`, via
  [pdfkit](https://pdfkit.org) — geen headless browser nodig, werkt gewoon op
  Vercel's Node-runtime) en slaat die op in `WeeklyReportPdf`
  (`prisma/schema.prisma`), **inline in de database** (`Bytes`-kolom) in
  plaats van bij Cloudinary — dit is een nalevingsrelevant document, dus geen
  afhankelijkheid van of Cloudinary toevallig geconfigureerd is. Idempotent:
  draait de cron nog een keer voor dezelfde week, dan wordt niets dubbel
  aangemaakt.
- Elke run **ruimt ook op**: `WeeklyReportPdf`-rijen ouder dan ~1 jaar
  (`weekStart` meer dan 366 dagen terug) worden verwijderd — een rollend
  archief van ongeveer de laatste 52 weken, dus bijvoorbeeld de PDF van
  week 36 uit 2026 verdwijnt zodra week 36 van 2027 wordt gegenereerd.
- **Weeknummers zijn ISO-8601** (`isoWeekOf()` in `lib/utils.ts`, dezelfde
  telling als de gangbare Nederlandse kalenderweken), inclusief de
  jaarwisseling-edge case waarbij eind december in ISO-week 1 van het
  volgende jaar kan vallen.
- `/weekrapport` (`app/(app)/weekrapport/page.tsx`, zichtbaar voor ADMIN en
  COORDINATOR — `canAccessWeeklyReport()` in `lib/auth.ts`) toont dit archief
  met een downloadknop per week (`app/api/weekrapport/archive/[id]/route.ts`),
  plus daaronder een live, nog niet afgeronde weergave van de lopende week
  (optioneel als platte tekst te downloaden — handig om tussentijds te zien
  wat er al is, maar niet het officiële record; dat wordt pas de aankomende
  maandag automatisch de PDF).

**Wat dit betekent voor Medicatie:** de "Registraties deze week"-lijst op
`/medicatie/[clientId]` toont alleen de lopende week (sinds afgelopen
maandag) — die lijst "reset" dus elke week, in de zin dat hij weer leeg
begint. De onderliggende `MedicationCheck`-rijen worden **niet** verwijderd
(ze blijven gewoon in de database staan, voor altijd) — alleen de PDF-archief
kopie heeft de 1-jaar-bewaartermijn. Zie
[Bewaartermijnen](#bewaartermijnen-retention) hieronder voor de afweging
achter dat onderscheid.

**Terugkerende to-do's delen dezelfde cron:** dezelfde
`/api/cron/weekly-report`-run roept ook `regenerateRecurringTodos()`
(`lib/recurring-todos.ts`) aan — niet als apart cron-endpoint, om binnen de
limiet van het aantal cron-jobs op het gratis Vercel-plan te blijven, en
omdat het inhoudelijk hetzelfde moment is: "het begin van een nieuwe week".
Bij het aanmaken van een taak op `/todos` kan optioneel een dag (maandag t/m
zondag) en "terugkerend (wekelijks)" worden gekozen; is "terugkerend"
aangevinkt, dan is een dag verplicht. Zodra zo'n taak wordt afgerond, blijft
hij die week gewoon als afgerond staan — pas bij de eerstvolgende
maandagochtend-cron wordt automatisch een nieuwe, open kopie aangemaakt met
dezelfde titel, omschrijving, prioriteit en dag. Elke afgeronde taak
regenereert maar één keer (een `regenerated`-vlag voorkomt dubbele
aanmaak bij een herhaalde cron-run).

### Apparaatbeveiliging

Optionele functie die de hele app (inclusief `/login`) beperkt tot apparaten
die één keer een wachtwoord hebben ingevoerd op `/apparaat`. Uitgeschakeld is
de standaard — bestaande installaties blijven dus ongewijzigd werken.

**Waarom niet op IP-adres?** Deze functie verving een eerdere versie die op
IP-adres restricteerde ("Netwerkbeveiliging"). Dat bleek onbetrouwbaar zodra
het publieke IP-adres van de internetverbinding wisselt (heel gewoon bij
consumenten-/kleinzakelijk internet zonder vast IP) — de app werd dan voor
iedereen onbereikbaar, met geen enkele manier om er via de app zelf iets aan
te doen. Apparaatbeveiliging heeft dat probleem niet: eenmaal vrijgegeven
blijft een apparaat vrijgegeven, ongeacht het netwerk waarop het verbindt.

**Instellen:** zet twee environment variables in Vercel:

| Naam | Waarde | Uitleg |
|---|---|---|
| `DEVICE_RESTRICTION_ENABLED` | `true` | Zet de beperking aan |
| `DEVICE_PASSCODE` | een lange, moeilijk te raden tekst | Het apparaat-wachtwoord — geen 4-cijferige pincode: 10 foute pogingen achter elkaar blokkeert *alle* pogingen 15 minuten lang (`lib/device-lockout.ts`), maar dat is een noodrem, geen vervanging voor een echt sterk wachtwoord |

Op elk apparaat dat toegang moet krijgen: open de app, je wordt doorgestuurd
naar `/apparaat`, voer `DEVICE_PASSCODE` in. Dat zet een `httpOnly`-cookie
(`device_token`, 10 jaar geldig — zie `lib/device-auth.ts`) die verder los
staat van de gewone 12-uurs sessie-cookie; iedereen kan zich daarna nog
gewoon met naam + geboortedatum aanmelden.

**Bewust géén in-app schakelaar.** Dit staat expres alleen in environment
variables, niet als toggle in Backend → Instellingen: een schakelaar die de
hele app kan blokkeren — inclusief de pagina waarmee je hem weer uitzet — is
precies hoe de vorige (IP-gebaseerde) versie tot een lockout leidde. Zit je
toch vast? Zet `DEVICE_RESTRICTION_ENABLED` terug op `false` in Vercel en
redeploy — dat lukt altijd, want het vereist alleen toegang tot het
Vercel-dashboard, niet tot de app zelf.

**`DEVICE_PASSCODE` roteren = alle apparaten in één keer intrekken.**
Middleware verifieert bij elk verzoek niet alleen de cookie's handtekening,
maar ook een hash van de *huidige* `DEVICE_PASSCODE`-waarde die in de cookie
zit ingebakken (`lib/device-auth.ts`). Wijzig je `DEVICE_PASSCODE` (en
redeploy je), dan werken alle eerder vrijgegeven apparaten niet meer — handig
als een apparaat kwijt is of iemand er geen toegang meer toe hoort te hebben.
Er is geen granulariteit per apparaat (geen naam/label/losse intrekking) —
voor een klein aantal gedeelde iPads is dat proportioneel; alles-of-niets
roteren is de enige hefboom.

Vercel Cron (`/api/cron/*`) en `/apparaat` zelf zijn altijd uitgezonderd van
deze check (anders zou niemand een apparaat ooit kunnen vrijgeven, en Vercel
Cron heeft toch geen `device_token`-cookie).

### Bewaartermijnen (retention)

Twee dingen worden hier automatisch verwijderd, allebei bewust beperkt tot
**afgeleide/gearchiveerde** data, nooit de brongegevens zelf:

- `/api/cron/retention-purge` (maandelijks) — oude `AuditLog`-rijen (~2 jaar).
- `/api/cron/weekly-report` (wekelijks) — `WeeklyReportPdf`-rijen ouder dan
  ~1 jaar (zie [Weekrapport](#weekrapport-automatisch-pdf-archief) hierboven).
  Dit is een **gegenereerde kopie** (een PDF-samenvatting) van gegevens die
  ook al in `Report`/`MedicationCheck`/`Todo`/`Appointment` staan — het
  verwijderen van die PDF na 1 jaar verwijdert dus geen brongegevens, wél de
  opgemaakte weekoverzicht-kopie ervan.

De onderliggende cliëntgegevens zelf (rapportages, medicatie(-checks),
protocollen, aanwezigheid) worden **nooit** automatisch verwijderd: hoe lang
die bewaard moeten/mogen blijven is een juridische afweging voor de
organisatie zelf (in Nederland wijst de WGBO doorgaans naar een
bewaartermijn van 20 jaar voor medische behandeldossiers), niet iets om
stilzwijgend te automatiseren.

> **Let op — dit betekent dat de 1-jaar-PDF-archivering niet hetzelfde is
> als "het medische dossier 1 jaar bewaren".** De ruwe `MedicationCheck`-data
> blijft gewoon staan (zie hierboven); alleen de opgemaakte PDF-samenvatting
> verdwijnt na een jaar. Is een langer bewaarde, opgemaakte PDF per week
> nodig voor jullie dossiervoering? Pas dan `RETENTION_MS` in
> `app/api/cron/weekly-report/route.ts` aan (met juridisch advies over de
> juiste termijn) — dit is bewust een losse constante, geen configuratie via
> environment variables, zodat een wijziging hier een bewuste code-aanpassing
> vereist en niet per ongeluk via een instelling kan gebeuren.

Wil je automatisch beleid op de brongegevens zelf, bepaal dan eerst zelf (met
juridisch advies) welke termijn geldt voor jullie type zorg, en voeg dat
gericht toe.

## Gebruiksinstructie (iPad)

1. Open de app in Safari → "Zet op beginscherm" voor een app-gevoel (PWA-metadata is al geconfigureerd).
2. Log in met naam + geboortedatum.
3. Dashboard toont bovenaan "Vandaag per kamer" (weekplanning + afspraken van vandaag, per cliëntkamer), daaronder stats + snelle knoppen.
4. **Rapportage** → kies cliënt + dienst + datum → typ → verstuur. "Recente rapportages" toont alleen wat sinds afgelopen donderdag is toegevoegd; het volledige overzicht staat ook in het **Weekrapport**.
5. **Medicatie** → open cliënt → kies Afvinken, Verlof of Niet ingenomen (kan niet ongedaan worden gemaakt). "Registraties deze week" reset elke maandag; het volledige overzicht staat daarna in het Weekrapport-archief.
6. **Aanwezigheid** → tik Aanwezig/Afwezig (met optioneel commentaar). Gedeeld tussen iedereen die inlogt en alle diensten; blijft staan totdat iemand het weer aanpast (geen dagelijkse reset).
7. **Overdracht** → typ notitie → wordt 1 uur na diensteinde automatisch gewist.
8. **To-Do's** → openstaande taken bovenaan, formulier voor een nieuwe taak eronder. Voor iedereen zichtbaar.
9. **Agenda** → aankomende afspraken bovenaan, formulier voor een nieuwe afspraak eronder.
10. **Protocollen** → algemeen of per cliënt, tekst en/of geüpload bestand. Voor iedereen; verwijderen alleen voor admin/coördinator.
11. **Weekrapport** (admin + coördinator) → automatisch archief van één PDF per kalenderweek (1 jaar bewaard), plus een live voortgangsoverzicht van de lopende week.
12. **Backend** (alleen admin) → cliënten (incl. kamer), medewerkers, instellingen, auditlog, medicatie, weekplanning. Eén wijziging = overal doorgevoerd.
13. Uitloggen rechtsonder in de zijbalk, of automatisch na 15 minuten inactiviteit.

Diensttijd wordt automatisch bijgehouden bij login.

## Architectuurpatroon voor nieuwe modules

Elke module volgt hetzelfde patroon (zie `app/(app)/aanwezigheid` als
referentie-implementatie):

1. **Server page** (`page.tsx`) haalt data op via `db` (Prisma) en geeft
   platte, geserialiseerde props door.
2. **Client component** verzorgt interactie/state en doet `fetch()` naar de
   API route, met optimistic UI en `sonner`-toasts.
3. **API route** (`app/api/.../route.ts`) doet `requireAuth()`, valideert met
   Zod (`lib/validations.ts`) en praat met Prisma.

## Security &amp; privacy

Deze app verwerkt bijzondere persoonsgegevens (medicatie, zorgrapportages) van
een kwetsbare doelgroep. Naast de punten onder Architectuur gelden de
volgende, concreet geïmplementeerde maatregelen:

- **Account-lockout tegen brute force.** Inloggen gebeurt zonder wachtwoord
  (alleen naam + geboortedatum), een ruimte die zonder rate-limiting in
  minuten is af te lopen. Na 5 mislukte pogingen wordt het account 15 minuten
  vergrendeld (`User.failedLoginAttempts` / `User.lockedUntil`,
  `app/api/auth/login/route.ts`). De foutmelding is bewust generiek ("Naam of
  geboortedatum onjuist") zodat een aanvaller niet kan afleiden of een naam
  bestaat.
- **Directe intrekking van toegang.** De 12-uurs JWT-cookie bevat alleen de
  gebruikers-ID; `getSession()` (`lib/auth.ts`) haalt bij élke request de
  actuele `active`/`role` op uit de database. Een deactivering of
  roldegradatie door een admin werkt dus meteen door — een oud token blijft
  niet nog uren geldig. Voor de Backend-paginaboom staat dit ook expliciet in
  `app/(app)/backend/layout.tsx`, als extra laag bovenop de
  middleware-rolcheck (die alleen het JWT-claim kan lezen, niet de database).
- **Geen placeholder-secrets in productie.** `JWT_SECRET` en `CRON_SECRET`
  worden bij het opstarten geweigerd wanneer ze exact de voorbeeldwaarde uit
  `.env.example` bevatten — voorkomt dat een vergeten "verander dit"-stap
  leidt tot vervalsbare sessies of een vrij aanroepbaar cron-endpoint.
- **Timing-safe vergelijking van gedeelde secrets.** `CRON_SECRET`
  (`lib/cron.ts`) en `DEVICE_PASSCODE` (`app/api/device/unlock/route.ts`)
  worden vergeleken met `crypto.timingSafeEqual` (`lib/secure-compare.ts`) in
  plaats van `===`, dat bij de eerste afwijkende byte stopt en zo via de
  reactietijd zou kunnen laten afleiden hoeveel tekens van een gok al goed
  waren.
- **Bruteforce-bescherming op apparaat-ontgrendeling.** `DEVICE_PASSCODE`
  heeft, net als login, geen accountconcept om per-gebruiker te vergrendelen
  (het is één gedeeld geheim) — daarom blokkeert 10 foute pogingen achter
  elkaar *alle* pogingen op `/api/device/unlock` 15 minuten lang, globaal
  (`DeviceUnlockLockout`-model, `lib/device-lockout.ts`). Dit was voorheen
  onbeschermd: elke aanvrager kon dit publieke endpoint (het staat per
  definitie open, anders kan niemand een nieuw apparaat vrijgeven)
  onbeperkt snel afvuren.
- **Weekrapport-toegang is dubbel afgedwongen.** Zowel de pagina
  (`app/(app)/weekrapport/page.tsx`) als beide API-routes die de inhoud
  serveren (`app/api/weekrapport/download/route.ts` voor de live .txt, en
  `app/api/weekrapport/archive/[id]/route.ts` voor een gearchiveerde PDF)
  roepen zelf `canAccessWeeklyReport()` aan — ADMIN of COÖRDINATOR, verder
  niemand. De PDF's zelf staan als `Bytes` in de database (geen publieke
  opslag-URL die te raden of te delen is); alleen deze twee routes, na
  authenticatie, kunnen ze uitlezen.
- **Geen self-XSS via protocol-links.** `Protocol.url` accepteert alleen
  `http(s)`-links (`lib/validations.ts`); zonder die check zou een
  `javascript:`-URL als "protocol" kunnen worden opgeslagen en bij een klik
  door een andere medewerker of admin script uitvoeren.
- **Auditlog van gevoelige acties.** Inloggen (incl. mislukte pogingen),
  aanmaken/wijzigen van cliënten en accounts, verwijderen van protocollen
  en instellingswijzigingen worden gelogd (`AuditLog`-model,
  `lib/audit.ts`), zichtbaar via Backend → Auditlog (alleen admin). Bewust
  beperkt tot schrijfacties, niet elke paginaweergave — dat laatste zou een
  database-write aan elke request toevoegen voor weinig onderzoekswaarde.
- **Automatisch uitloggen na inactiviteit.** Gedeelde iPads in een
  zorgomgeving zijn een reëel risico: iemand loopt weg bij een ontgrendelde
  sessie en de volgende die het scherm aanraakt ziet cliëntgegevens.
  `components/idle-logout.tsx` logt na 15 minuten zonder muis/toetsenbord/
  touch-interactie automatisch uit, los van de 12-uurs JWT-sessieduur.
- **Optionele apparaatbeveiliging.** Beperk de hele app tot vrijgegeven
  apparaten, env-var-gestuurd (bewust geen in-app schakelaar die zelf tot
  uitsluiting kan leiden) — zie
  [Apparaatbeveiliging](#apparaatbeveiliging) hierboven.
- **Browserbeveiligingsheaders**: `X-Frame-Options: DENY`
  (clickjacking-bescherming op de loginpagina), HSTS, `X-Content-Type-Options:
  nosniff` en een `Permissions-Policy` die camera/microfoon/locatie
  uitschakelt staan statisch in `next.config.ts` — niets daarvan is nodig in
  deze app. De **Content-Security-Policy** zit bewust in `middleware.ts` in
  plaats van `next.config.ts`: die genereert per request een nonce zodat
  `script-src` strikt op `'self'` kan blijven staan terwijl Next.js' eigen
  inline hydration/streaming-scripts toch mogen draaien. Een statische CSP
  zonder nonce laat de eerste HTML nog prima zien, maar blokkeert die
  scripts alsnog — de pagina toont dan kort de inhoud en wordt daarna blanco
  zodra React probeert te hydrateren.
- **CSRF** wordt afgedekt door de `SameSite=Lax`-cookie: browsers sturen die
  niet mee bij cross-site `fetch`/`XHR`-requests of bij een cross-site
  POST-formulier, wat de state-changing API-routes al beschermt zonder een
  apart CSRF-token.
- **SQL-injectie** is uitgesloten doordat alle database-toegang via Prisma's
  parameterized queries loopt — nergens wordt raw SQL met stringconcatenatie
  gebruikt.
- **Foutafhandeling lekt niets.** `lib/api.ts` logt onverwachte fouten
  server-side maar stuurt de client altijd een generieke boodschap; stack
  traces of databasedetails komen nooit in een API-response terecht.
- **Geen standaard productie-accounts.** `/setup` (`app/api/setup/route.ts`)
  maakt het allereerste account aan en weigert daarna permanent — zodra
  `db.user.count() > 0` is de route dood. Een productie-deploy bevat dus
  nooit voorspelbare seed-accounts zoals bij lokale ontwikkeling.
- **Uploads zijn beperkt.** Protocollen uploaden mag elke ingelogde rol
  (`app/api/protocols/upload/route.ts`), verwijderen blijft ADMIN/COORDINATOR.
  Whitelist van content-types en een bestandsgrootte-limiet van 4 MB
  (`lib/file-upload.ts`) — bewust laag omdat uploads via onze eigen server
  naar Cloudinary lopen, niet rechtstreeks van de browser naar externe
  opslag; zie de "Uploads"-sectie hierboven voor waarom.

**Wat nog aandacht verdient bij een echte productie-uitrol — dit is geen
juridisch advies, raadpleeg bij twijfel een deskundige:** roteer
`JWT_SECRET`/`CRON_SECRET` bij vermoeden van lekkage (bestaande sessies
worden dan ongeldig); zorg voor een geldige AVG-grondslag voor de verwerking
van bijzondere persoonsgegevens (doorgaans Art. 9(2)(h) — zorgverlening —
plus een geheimhoudingsbeding voor niet-BIG-geregistreerd personeel, zie
UAVG Art. 30); sluit verwerkersovereenkomsten met Vercel/Neon/Cloudinary;
stel een privacyverklaring, verwerkingsregister en datalekprotocol op; en
bepaal een bewaartermijn voor cliëntgegevens (zie
[Bewaartermijnen](#bewaartermijnen-retention) hierboven — de app verwijdert
hier bewust niets automatisch).

## Testen

`npm run test` draait Vitest unit tests voor de zuivere logica: datum-parsing,
ISO-weeknummers, dienstberekening en alle Zod-schema's (`lib/__tests__`).
Daarnaast is de volledige flow handmatig doorlopen tegen een productie-build
(`npm run build && npm run start`): inloggen (correct/incorrect), sessie- en
rolcontrole op elke route, de create-acties van elke module (aanwezigheid,
rapportage, medicatie-check in alle drie statussen, overdracht, to-do +
afronden, afspraak, en de Backend-CRUD endpoints inclusief de 403 op een
niet-toegestane rol), en de weekrapport-cron end-to-end (PDF-generatie,
idempotentie bij een tweede run, retentie-opruiming, en het downloaden van
een gearchiveerde PDF).
