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
  `Client`, `Document`, `Protocol`, `Report`, `Medication` + onomkeerbare
  `MedicationCheck`, `WeekPlan`, `Todo`, `Presence`, `Handover` (auto-expiry),
  `Appointment`, `Shift`, `Setting`. Eén wijziging in `Client` of `Setting`
  werkt overal door.
- **Auth** — alleen naam + geboortedatum (`DD-MM-JJJJ`), geen wachtwoorden.
  JWT in een `httpOnly`, `secure` cookie (12 uur geldig). Bij inloggen wordt
  automatisch een dienst gestart (ochtend 07:00-15:00 / avond 14:00-23:00).
- **E-mail** — [Resend](https://resend.com) *of* gewone SMTP (bv. een
  Gmail-account met een "App-wachtwoord") voor rapportages, maandelijkse
  medicatie-overzichten, maandelijkse to-do overzichten naar de coördinator en
  agenda-herinneringen. Alle adressen staan in de `Setting`-tabel — één plek
  om te wijzigen (Backend → Instellingen).
- **Security** — Zod-validatie op elke input, `requireAuth()` op alle API's,
  géén update/delete op `MedicationCheck` (onomkeerbaar), overdracht wist
  zichzelf (`expiresAt = shiftEinde + 1u`), rolcontrole (alleen admin ziet
  Backend en beheert accounts; Documenten en Protocollen staan in het
  hoofdmenu voor iedereen, verwijderen daar blijft voorbehouden aan
  admin/coördinator), HTTPS via Vercel. Zie
  [Security &amp; privacy](#security--privacy) hieronder voor het volledige
  overzicht van getroffen maatregelen.
- **UI/UX** — dark mode standaard, sky/emerald accenten, grote touch-targets,
  sidebar + overlay voor iPad, responsive, cards, badges, toasts (sonner).
- **Prestatie** — server components voor data-ophaling, minimale client JS,
  geïndexeerde uniques in Prisma.

## Modules

| Module | Route | Omschrijving |
| --- | --- | --- |
| Overzicht | `/dashboard` | Stats + snelle acties |
| Rapportage | `/rapportage` | Rapportage per cliënt/dienst, e-mail naar algemeen adres |
| Medicatie | `/medicatie` | Medicatie afvinken per cliënt (onomkeerbaar) |
| Aanwezigheid | `/aanwezigheid` | Aanwezig/afwezig per cliënt per dag |
| Overdracht | `/overdracht` | Notities die 1 uur na diensteinde verlopen |
| To-Do's | `/todos` | Taken met prioriteit, afronden + commentaar |
| Agenda | `/agenda` | Afspraken + automatische herinnering per e-mail |
| Documenten | `/documenten` | Algemeen, per cliënt en "Nieuwe medewerker" — upload met voortgangsbalk, voor iedereen |
| Protocollen | `/protocollen` | Algemene en cliëntspecifieke protocollen, voor iedereen |
| Backend | `/backend` | Cliënten, medewerkers, medicatie beheer, weekplanning, instellingen (alleen admin) |

## Vereisten

1. Node.js 20+
2. Een Vercel-account (hosting)
3. Database: lokaal SQLite (al geconfigureerd) → productie Neon.tech of Vercel
   Postgres (gratis tier)
4. E-mail: [Resend](https://resend.com) (gratis tier, vereist een geverifieerd
   eigen domein om naar willekeurige ontvangers te mailen) **of** SMTP via een
   bestaande mailbox, bv. Gmail met een "App-wachtwoord" — geen domein/DNS
   nodig. Zie de e-mail-sectie hieronder voor de afweging.
5. (Optioneel) Vercel Blob voor documenten/protocollen
6. Eigen domein (aanbevolen voor e-mail + PWA)

## Lokaal installeren

```bash
# 1. Installeer dependencies
npm install

# 2. Environment
cp .env.example .env
# Vul .env in: JWT_SECRET (min. 32 tekens), later RESEND_API_KEY of SMTP_*, GENERAL_EMAIL, COORDINATOR_EMAIL, CRON_SECRET

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
2. Koppel een Postgres-database (Vercel Storage → Neon) en, optioneel, een
   Blob-store aan het project — dit zet `DATABASE_URL` resp.
   `BLOB_READ_WRITE_TOKEN` automatisch.
3. Zet de overige environment variables: `JWT_SECRET`, `CRON_SECRET`,
   `EMAIL_FROM`, en voor e-mail **één van beide**:
   - `RESEND_API_KEY` — vereist een geverifieerd eigen domein bij Resend om
     naar willekeurige ontvangers te mailen (zonder domein levert Resend
     alleen af op het e-mailadres waarmee je bij Resend bent ingelogd); of
   - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` — stuurt via
     een bestaande mailbox, bv. Gmail. Vereist geen domein/DNS-toegang: alleen
     een Google-account met 2-staps-verificatie aan en een "App-wachtwoord"
     via [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
     (`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`,
     `SMTP_USER=<gmail-adres>`, `SMTP_PASSWORD=<16-tekens app-wachtwoord>`).
     Is `SMTP_HOST` gezet, dan heeft SMTP voorrang boven Resend.

   `GENERAL_EMAIL`/`COORDINATOR_EMAIL` hoeven hier niet: die worden bij de
   allereerste keer opstarten via de `/setup`-wizard in de app zelf ingevuld
   (zie hieronder).
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
   (admin-)account aan en vul je de twee e-mailadressen in. Deze pagina kan
   daarna nooit meer opnieuw gebruikt worden.

### Cron jobs

`vercel.json` bevat al de cron-configuratie:

- `/api/cron/monthly-med` — maandelijks medicatie-overzicht (1e van de maand)
- `/api/cron/monthly-todos` — maandelijks to-do overzicht naar coördinator (1e van de maand)
- `/api/cron/agenda-reminders` — dagelijks om 07:00 UTC, verstuurt herinneringen voor
  afspraken binnen 24 uur

Alle cron-routes vereisen de header `Authorization: Bearer <CRON_SECRET>`
(Vercel Cron stuurt dit automatisch mee wanneer `CRON_SECRET` is ingesteld).
Let op: het gratis Hobby-plan van Vercel staat alleen dagelijkse cron jobs toe
(vaker dan 1x per dag geeft een mislukte deploy) — vandaar dat alle drie hier
maximaal 1x per dag draaien.

### Uploads (documenten/protocollen)

Documenten (`/documenten`, in het hoofdmenu voor iedereen) heeft een
ingebouwde upload-knop met voortgangsbalk: een gekozen bestand (PDF, Word,
Excel, afbeelding, tekst — max 20 MB) gaat via `@vercel/blob/client`'s
`upload()` rechtstreeks van de browser naar Vercel Blob, met een kort-levend
token dat `app/api/documents/upload/route.ts` uitgeeft (na een
`requireAuth()`-check — elke ingelogde rol mag uploaden; verwijderen blijft
`requireAuth([ADMIN, COORDINATOR])`, zie `app/api/documents/[id]/route.ts`,
en met een whitelist van toegestane content-types). De upload breekt na 60s
automatisch af met een duidelijke melding als de verbinding vastloopt.
Zonder gekoppelde Blob-store (`BLOB_READ_WRITE_TOKEN` ontbreekt) geeft die
route een `503` met `code: "BLOB_NOT_CONFIGURED"` terug; de UI toont dan een
duidelijke melding en biedt "Ik heb al een link naar een document" als
alternatief, dat gewoon een URL opslaat zoals voorheen.

Documenten zonder gekoppelde cliënt horen bij een van twee "threads",
gekozen via het veld "Hoort bij": **Algemeen** of **Nieuwe medewerker**
(opgeslagen als `Document.category`, enum `GENERAL`/`ONBOARDING`). Een
document met een gekoppelde cliënt hoort altijd bij die cliënt, ongeacht
category. De documentenpagina toont deze als tabbladen (Algemeen, Nieuwe
medewerker, per cliënt) die de zichtbare lijst client-side filteren.

## Gebruiksinstructie (iPad)

1. Open de app in Safari → "Zet op beginscherm" voor een app-gevoel (PWA-metadata is al geconfigureerd).
2. Log in met naam + geboortedatum.
3. Dashboard toont stats + snelle knoppen.
4. **Rapportage** → kies cliënt + dienst + datum → typ → verstuur (gaat naar het algemene e-mailadres, bevat je naam).
5. **Medicatie** → open cliënt → vink af (kan niet ongedaan worden gemaakt). Einde maand → overzicht naar e-mail.
6. **Aanwezigheid** → tik Aanwezig/Afwezig (met optioneel commentaar).
7. **Overdracht** → typ notitie → wordt 1 uur na diensteinde automatisch gewist.
8. **To-Do's** → toevoegen, prioriteit, afronden + commentaar. Maandelijks overzicht naar coördinator.
9. **Agenda** → afspraak toevoegen; herinnering gaat automatisch naar e-mail binnen 24 uur voor de afspraak.
10. **Documenten** → upload of link toevoegen, kies "Hoort bij" (Algemeen, Nieuwe medewerker of een cliënt); tabbladen filteren de lijst. Voor iedereen; verwijderen alleen voor admin/coördinator.
11. **Protocollen** → algemeen of per cliënt. Voor iedereen; verwijderen alleen voor admin/coördinator.
12. **Backend** (alleen admin) → cliënten, medewerkers, instellingen, medicatie, weekplanning. Eén wijziging = overal doorgevoerd.
13. Uitloggen rechtsonder in de zijbalk.

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
  leidt tot vervalsbare sessies of vrij aanroepbare cron-endpoints (die
  cliëntgegevens mailen).
- **Geen self-XSS via documentlinks.** `Document.url` accepteert alleen
  `http(s)`-links (`lib/validations.ts`); zonder die check zou een
  `javascript:`-URL als "document" kunnen worden opgeslagen en bij een klik
  door een andere medewerker of admin script uitvoeren.
- **E-mailadressen worden gevalideerd.** `GENERAL_EMAIL` en
  `COORDINATOR_EMAIL` in Instellingen moeten een geldig e-mailformaat hebben,
  zodat rapportages en medicatie-overzichten niet stilzwijgend naar een
  verkeerd of onbestaand adres verdwijnen.
- **HTML-injectie in e-mails.** Alle vrije tekst (rapportage-inhoud, namen,
  commentaar) wordt geëscaped voordat die in een e-mail-template terechtkomt
  (`lib/email.ts`), dus gebruikersinvoer kan geen opmaak of scripts in de
  ontvangen e-mail injecteren.
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
- **Uploads zijn beperkt.** De uploadroute staat elke ingelogde rol toe
  (Documenten is een hoofdmenu-onderdeel), maar whitelist't content-types en
  beperkt de bestandsgrootte tot 20 MB (`app/api/documents/upload/route.ts`);
  verwijderen van een document blijft voorbehouden aan ADMIN/COORDINATOR
  (`app/api/documents/[id]/route.ts`).

**Wat nog aandacht verdient bij een echte productie-uitrol:** roteer
`JWT_SECRET`/`CRON_SECRET` bij vermoeden van lekkage (bestaande sessies
worden dan ongeldig), overweeg een audit-log-export voor de AVG/GDPR
verantwoordingsplicht bovenop de bestaande timestamps, en zet — als de
doelgroep dat vereist — een verwerkersovereenkomst met Resend/Vercel/Neon op
voor de verwerking van bijzondere persoonsgegevens.

## Testen

`npm run test` draait Vitest unit tests voor de zuivere logica: datum-parsing,
dienstberekening en alle Zod-schema's (`lib/__tests__`). Daarnaast is de
volledige flow handmatig doorlopen tegen een productie-build
(`npm run build && npm run start`): inloggen (correct/incorrect), sessie- en
rolcontrole op elke route, en de create-acties van elke module (aanwezigheid,
rapportage, medicatie-check, overdracht, to-do + afronden, afspraak, en de
Backend-CRUD endpoints inclusief de 403 op een niet-toegestane rol).
