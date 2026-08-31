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
  Backend en beheert accounts; Documenten uploaden/verwijderen is ook
  admin-only, via Backend → Documenten, maar iedereen met een account ziet en
  opent ze via het hoofdmenu; Protocollen toevoegen mag iedereen,
  verwijderen blijft admin/coördinator), HTTPS via Vercel, een auditlog van
  gevoelige acties (Backend → Auditlog), automatisch uitloggen na 15 minuten
  inactiviteit, en een optionele netwerkbeveiliging die de app beperkt tot het
  IP-adres van de organisatie. Zie
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
| Medicatie | `/medicatie` | Medicatie afvinken per cliënt (onomkeerbaar) |
| Aanwezigheid | `/aanwezigheid` | Aanwezig/afwezig per cliënt per dag, gedeeld tussen alle accounts (geen per-sessie state) |
| Overdracht | `/overdracht` | Notities die 1 uur na diensteinde verlopen |
| To-Do's | `/todos` | Openstaande taken bovenaan, daaronder het formulier voor een nieuwe taak. Voor iedereen zichtbaar |
| Agenda | `/agenda` | Aankomende afspraken bovenaan, daaronder het formulier voor een nieuwe afspraak |
| Documenten | `/documenten` | Algemeen, per cliënt en "Nieuwe medewerker", voor iedereen zichtbaar. Uploaden/verwijderen alleen via Backend (admin) |
| Protocollen | `/protocollen` | Algemene en cliëntspecifieke protocollen, als tekst en/of geüpload bestand, voor iedereen |
| Weekrapport | `/weekrapport` | Downloadbaar overzicht van rapportages, medicatie, to-do's en afspraken sinds afgelopen maandag. Admin + coördinator |
| Backend | `/backend` | Cliënten, medewerkers, documenten (upload/verwijderen), medicatie beheer, weekplanning, instellingen, auditlog (alleen admin) |

## Vereisten

1. Node.js 20+
2. Een Vercel-account (hosting)
3. Database: lokaal SQLite (al geconfigureerd) → productie Neon.tech of Vercel
   Postgres (gratis tier)
4. (Optioneel) Een gratis [Cloudinary](https://cloudinary.com)-account voor
   documenten/protocollen uploaden
5. Eigen domein (aanbevolen voor de PWA)

## Lokaal installeren

```bash
# 1. Installeer dependencies
npm install

# 2. Environment
cp .env.example .env
# Vul .env in: JWT_SECRET (min. 32 tekens), CRON_SECRET, optioneel NETWORK_BYPASS_SECRET

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
   `CLOUDINARY_API_SECRET` (documenten/protocollen uploaden — zie de
   "Uploads"-sectie hieronder), en optioneel `NETWORK_BYPASS_SECRET` (alleen
   nodig als je later "Netwerkbeveiliging" gaat gebruiken — zie
   [Netwerkbeveiliging](#netwerkbeveiliging) hieronder, **zet dit vóórdat je
   die instelling aanzet**).
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
  (rapportages, medicatie, documenten, ...) — zie
  [Bewaartermijnen](#bewaartermijnen-retention) hieronder voor waarom.

De cron-route vereist de header `Authorization: Bearer <CRON_SECRET>`
(Vercel Cron stuurt dit automatisch mee wanneer `CRON_SECRET` is ingesteld).

### Uploads (documenten/protocollen)

Documenten uploaden gebeurt alleen via **Backend → Documenten**
(`app/(app)/backend/documenten/page.tsx`, admin-only — de backend-layout
gate zorgt hiervoor) en heeft een ingebouwde upload-knop met voortgangsbalk:
een gekozen bestand (PDF, Word, Excel, afbeelding, tekst — max 4 MB) gaat
als `multipart/form-data` naar `app/api/documents/upload/route.ts` (dezelfde
origin, na een `requireAuth([ADMIN])`-check en een whitelist van toegestane
content-types uit `lib/file-upload.ts`), die op de server zelf het bestand
naar [Cloudinary](https://cloudinary.com) stuurt (`lib/cloudinary.ts`).
Voortgang wordt bijgehouden via een `XMLHttpRequest`-helper
(`lib/client-upload.ts`) omdat `fetch()` geen upload-voortgang kan
rapporteren.

Dit project gebruikte eerst Vercel Blob, zowel de rechtstreekse
browser-naar-Vercel-upload (`@vercel/blob/client`'s `upload()`) als een
server-bemiddelde variant (`put()`) — beide gaven in productie consistent
een onleesbare `400` terug van Vercel's eigen Blob-API, ook tegen een
volledig nieuw aangemaakte store, zonder duidelijke oorzaak. Overgestapt op
Cloudinary via onze eigen server lost dit op. Bestanden gaan nog steeds via
onze server (niet rechtstreeks van de browser naar Cloudinary), dus de
bestandslimiet blijft 4 MB — dat is Vercel's harde platformlimiet voor het
request-body van één Serverless Function, ongeacht welke opslagdienst
daarachter zit.

Elke upload zet expliciet `access_mode: "public"` mee (in
`lib/cloudinary.ts`): een nieuw Cloudinary-account levert niet-afbeeldingen
(PDF, Word, Excel, tekst) standaard af als `"authenticated"`, wat een `401`
oplevert voor iedereen behalve de accounteigenaar zelf zodra die link wordt
geopend. Dit voorkomt dat.

> **Let op bij Cloudinary-instellingen:** los van bovenstaande blokkeert een
> nieuw Cloudinary-account soms ook de aflevering van PDF/ZIP-bestanden
> volledig (een apart, account-breed beveiligingsschakelaartje). Krijg je
> alsnog een `401` bij het openen van een geüpload PDF-document? Zet dan
> **Settings → Security → "Allow delivery of PDF and ZIP files"** aan in het
> Cloudinary-dashboard.

De hoofdmenu-pagina `/documenten` deelt dezelfde `DocumentManager`-component
maar met `canUpload={false}` en `canDelete={false}` — puur bekijken/openen,
voor elke ingelogde rol. De upload breekt na 60s automatisch af met een
duidelijke melding als de verbinding vastloopt. Zonder Cloudinary-configuratie
(`CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`
ontbreken) geeft die route een `503` met `code: "STORAGE_NOT_CONFIGURED"`
terug; de UI toont dan een duidelijke melding en biedt "Ik heb al een link
naar een document" als alternatief, dat gewoon
een URL opslaat.

Documenten zonder gekoppelde cliënt horen bij een van twee "threads",
gekozen via het veld "Hoort bij": **Algemeen** of **Nieuwe medewerker**
(opgeslagen als `Document.category`, enum `GENERAL`/`ONBOARDING`). Een
document met een gekoppelde cliënt hoort altijd bij die cliënt, ongeacht
category. De documentenpagina toont deze als tabbladen (Algemeen, Nieuwe
medewerker, per cliënt) die de zichtbare lijst client-side filteren.

**Protocollen** (`/protocollen`, hoofdmenu, elke rol mag toevoegen) staan
niet meer verplicht als tekst: `Protocol.content` en `Protocol.url` zijn
allebei optioneel, zolang er minimaal één is ingevuld (afgedwongen door een
`.refine()` op `protocolSchema`). Een geüpload bestand gebruikt dezelfde
upload-flow als documenten, via `app/api/protocols/upload/route.ts`.

**Cliënten** hebben een optioneel "Kamer"-veld (`Client.room`), instelbaar
bij aanmaken en direct in de lijst te wijzigen (Backend → Cliënten). Het
dashboard gebruikt dit veld om de "Vandaag per kamer"-sectie te groeperen:
per kamer wordt getoond welke weekplanning-activiteiten en agenda-afspraken
voor vandaag gepland staan, zodat wie inlogt in één oogopslag ziet wat er per
kamer speelt. Cliënten zonder kamer verschijnen onder "Geen kamer";
afspraken zonder gekoppelde cliënt onder "Algemeen". "Vandaag" en de
dag-van-de-week-berekening zijn Europe/Amsterdam-bewust (zie
`todayDayOfWeek()` in `lib/utils.ts`), net als de rest van de app.

### Weekrapport (vervangt e-mail)

De app verstuurde vroeger rapportages, medicatie- en to-do-overzichten en
agenda-herinneringen automatisch per e-mail. Dat is verwijderd: het stuurde
gevoelige cliëntgegevens naar een externe e-maildienst zonder dat daar per se
een geldige verwerkersovereenkomst/AVG-grondslag voor was, en voegde een
derde partij (Resend of een Gmail-account) toe aan de verwerkingsketen.

In plaats daarvan is er `/weekrapport` (`lib/weekly-report.ts`,
`app/(app)/weekrapport/page.tsx`), zichtbaar voor ADMIN en COORDINATOR
(`canAccessWeeklyReport()` in `lib/auth.ts`): een overzicht van rapportages,
afgevinkte medicatie, to-do's en afspraken **sinds afgelopen maandag**
(`mostRecentMondayStart()` in `lib/utils.ts`, hetzelfde patroon als
rapportage's donderdag-reset), met een downloadknop die dezelfde data als
platte tekst (`.txt`) teruggeeft (`app/api/weekrapport/download/route.ts`).
Niets wordt automatisch verstuurd of ergens naartoe gepusht — admin/
coördinator halen het overzicht zelf op wanneer ze het nodig hebben.

### Netwerkbeveiliging

Optionele instelling (Backend → Instellingen → Netwerkbeveiliging) die de
hele app beperkt tot een IP-allowlist (bv. het publieke IP-adres van het
kantoornetwerk). Uitgeschakeld is de standaard — bestaande installaties
blijven dus ongewijzigd werken.

**Technische opzet:** Next.js Middleware draait altijd op de Edge-runtime,
waar Prisma niet werkt (geen TCP-verbinding naar Postgres mogelijk). De
toggle staat daarom gewoon in de `Setting`-tabel (bewerkbaar via de normale
Instellingen-UI), maar `middleware.ts` leest hem niet rechtstreeks: het doet
een interne `fetch()` naar `/api/internal/network-policy`
(`lib/network-policy.ts`), een gewone Node.js-route die wél bij Prisma kan.
Die route cachet de instelling 30 seconden in het geheugen, dus een wijziging
werkt binnen ~30s overal door. Gaat die interne check om wat voor reden dan
ook mis (time-out, foutcode), dan valt middleware **open** terug (toegang
toestaan) — dit is een extra beveiligingslaag, geen vervanging voor de
eigenlijke AVG-grondslag, dus een storing hierin mag de hele app niet
platleggen voor alle gebruikers.

> **Waarschuwing — risico op uitsluiting.** Als je dit inschakelt met een
> verkeerd, verouderd of te specifiek IP-adres, kan **niemand meer inloggen**
> totdat het IP-adres van het netwerk weer overeenkomt met de instelling —
> ook een admin niet, want de check geldt voor de hele app inclusief
> `/login`. Zet daarom **`NETWORK_BYPASS_SECRET`** (een lange willekeurige
> tekst) als environment variable in Vercel **voordat** je dit aanzet. Ben je
> ooit buitengesloten? Ga vanaf een willekeurig netwerk naar
> `https://<jouw-app-url>/login?bypass=<NETWORK_BYPASS_SECRET-waarde>` — dat
> zet een 24-uurs cookie dat de IP-check omzeilt, log in, en zet de instelling
> weer uit of goed bij Backend → Instellingen. Zonder `NETWORK_BYPASS_SECRET`
> ingesteld werkt deze noodtoegang niet.
>
> Alleen IPv4 wordt ondersteund; een bezoeker over IPv6 matcht nooit een
> geconfigureerd bereik. De instellingenpagina toont je huidige IP-adres als
> hulp bij het invullen.

### Bewaartermijnen (retention)

De retention-cron (`/api/cron/retention-purge`, zie "Cron jobs" hierboven)
verwijdert alleen oude `AuditLog`-rijen (~2 jaar). Cliëntgegevens
(rapportages, medicatie(-checks), documenten, protocollen, aanwezigheid)
worden **nooit** automatisch verwijderd: hoe lang die bewaard moeten/mogen
blijven is een juridische afweging voor de organisatie zelf (in Nederland
wijst de WGBO doorgaans naar een bewaartermijn van 20 jaar voor medische
behandeldossiers), niet iets om stilzwijgend te automatiseren. Wil je hier
wél automatisch beleid op, bepaal dan eerst zelf (met juridisch advies) welke
termijn geldt voor jullie type zorg, en voeg dat gericht toe.

## Gebruiksinstructie (iPad)

1. Open de app in Safari → "Zet op beginscherm" voor een app-gevoel (PWA-metadata is al geconfigureerd).
2. Log in met naam + geboortedatum.
3. Dashboard toont bovenaan "Vandaag per kamer" (weekplanning + afspraken van vandaag, per cliëntkamer), daaronder stats + snelle knoppen.
4. **Rapportage** → kies cliënt + dienst + datum → typ → verstuur. "Recente rapportages" toont alleen wat sinds afgelopen donderdag is toegevoegd; het volledige overzicht staat ook in het **Weekrapport**.
5. **Medicatie** → open cliënt → vink af (kan niet ongedaan worden gemaakt).
6. **Aanwezigheid** → tik Aanwezig/Afwezig (met optioneel commentaar). Gedeeld tussen iedereen die inlogt, blijft de hele dag staan totdat iemand het aanpast.
7. **Overdracht** → typ notitie → wordt 1 uur na diensteinde automatisch gewist.
8. **To-Do's** → openstaande taken bovenaan, formulier voor een nieuwe taak eronder. Voor iedereen zichtbaar.
9. **Agenda** → aankomende afspraken bovenaan, formulier voor een nieuwe afspraak eronder.
10. **Documenten** → upload of link toevoegen, kies "Hoort bij" (Algemeen, Nieuwe medewerker of een cliënt); tabbladen filteren de lijst. Voor iedereen; verwijderen alleen voor admin/coördinator.
11. **Protocollen** → algemeen of per cliënt. Voor iedereen; verwijderen alleen voor admin/coördinator.
12. **Weekrapport** (admin + coördinator) → rapportages, medicatie, to-do's en afspraken sinds afgelopen maandag, met een downloadknop.
13. **Backend** (alleen admin) → cliënten (incl. kamer), medewerkers, instellingen, netwerkbeveiliging, auditlog, medicatie, weekplanning. Eén wijziging = overal doorgevoerd.
14. Uitloggen rechtsonder in de zijbalk, of automatisch na 15 minuten inactiviteit.

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
- **Geen self-XSS via documentlinks.** `Document.url` accepteert alleen
  `http(s)`-links (`lib/validations.ts`); zonder die check zou een
  `javascript:`-URL als "document" kunnen worden opgeslagen en bij een klik
  door een andere medewerker of admin script uitvoeren.
- **Auditlog van gevoelige acties.** Inloggen (incl. mislukte pogingen),
  aanmaken/wijzigen van cliënten en accounts, verwijderen van documenten/
  protocollen en instellingswijzigingen worden gelogd (`AuditLog`-model,
  `lib/audit.ts`), zichtbaar via Backend → Auditlog (alleen admin). Bewust
  beperkt tot schrijfacties, niet elke paginaweergave — dat laatste zou een
  database-write aan elke request toevoegen voor weinig onderzoekswaarde.
- **Automatisch uitloggen na inactiviteit.** Gedeelde iPads in een
  zorgomgeving zijn een reëel risico: iemand loopt weg bij een ontgrendelde
  sessie en de volgende die het scherm aanraakt ziet cliëntgegevens.
  `components/idle-logout.tsx` logt na 15 minuten zonder muis/toetsenbord/
  touch-interactie automatisch uit, los van de 12-uurs JWT-sessieduur.
- **Optionele netwerkbeveiliging.** Beperk de hele app tot een IP-allowlist
  (bv. het kantoornetwerk) — zie [Netwerkbeveiliging](#netwerkbeveiliging)
  hierboven, inclusief de noodtoegang tegen uitsluiting.
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
- **Uploads zijn beperkt.** Documenten uploaden/verwijderen is admin-only
  (`app/api/documents/upload/route.ts`, `app/api/documents/[id]/route.ts`);
  protocollen uploaden mag elke ingelogde rol
  (`app/api/protocols/upload/route.ts`), verwijderen blijft ADMIN/COORDINATOR.
  Beide whitelist't content-types en beperkt de bestandsgrootte tot 4 MB
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
dienstberekening en alle Zod-schema's (`lib/__tests__`). Daarnaast is de
volledige flow handmatig doorlopen tegen een productie-build
(`npm run build && npm run start`): inloggen (correct/incorrect), sessie- en
rolcontrole op elke route, en de create-acties van elke module (aanwezigheid,
rapportage, medicatie-check, overdracht, to-do + afronden, afspraak, en de
Backend-CRUD endpoints inclusief de 403 op een niet-toegestane rol).
