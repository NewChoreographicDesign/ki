# Woongroep Admin

Een schone, iPad-first, dark-mode beheeromgeving voor een woongroep, gebouwd met
Next.js 15 (App Router), TypeScript, Prisma en Tailwind CSS.

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
- **E-mail** — [Resend](https://resend.com) voor rapportages, maandelijkse
  medicatie-overzichten, maandelijkse to-do overzichten naar de coördinator en
  agenda-herinneringen. Alle adressen staan in de `Setting`-tabel — één plek
  om te wijzigen (Backend → Instellingen).
- **Security** — Zod-validatie op elke input, `requireAuth()` op alle API's,
  géén update/delete op `MedicationCheck` (onomkeerbaar), overdracht wist
  zichzelf (`expiresAt = shiftEinde + 1u`), rolcontrole (alleen
  admin/coördinator zien Backend; alleen admin beheert accounts), HTTPS via
  Vercel.
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
| Backend | `/backend` | Cliënten, medewerkers, documenten, protocollen, medicatie beheer, weekplanning, instellingen (alleen admin/coördinator) |

## Vereisten

1. Node.js 20+
2. Een Vercel-account (hosting)
3. Database: lokaal SQLite (al geconfigureerd) → productie Neon.tech of Vercel
   Postgres (gratis tier)
4. Resend (gratis tier) voor e-mails
5. (Optioneel) Vercel Blob voor documenten/protocollen
6. Eigen domein (aanbevolen voor e-mail + PWA)

## Lokaal installeren

```bash
# 1. Installeer dependencies
npm install

# 2. Environment
cp .env.example .env
# Vul .env in: JWT_SECRET (min. 32 tekens), later RESEND_API_KEY, GENERAL_EMAIL, COORDINATOR_EMAIL, CRON_SECRET

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

1. Push naar GitHub.
2. Importeer het project in Vercel.
3. Zet environment variables: `DATABASE_URL` (Postgres connection string),
   `JWT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `GENERAL_EMAIL`,
   `COORDINATOR_EMAIL`, `CRON_SECRET`, eventueel `BLOB_READ_WRITE_TOKEN`.
4. Zet in `prisma/schema.prisma` de datasource `provider` op `"postgresql"`.
5. Deploy. Vercel regelt HTTPS + edge.

### Cron jobs

`vercel.json` bevat al de cron-configuratie:

- `/api/cron/monthly-med` — maandelijks medicatie-overzicht (1e van de maand)
- `/api/cron/monthly-todos` — maandelijks to-do overzicht naar coördinator (1e van de maand)
- `/api/cron/agenda-reminders` — uurlijks, verstuurt herinneringen voor afspraken binnen 24 uur

Alle cron-routes vereisen de header `Authorization: Bearer <CRON_SECRET>`
(Vercel Cron stuurt dit automatisch mee wanneer `CRON_SECRET` is ingesteld).
Let op: het gratis Hobby-plan van Vercel staat mogelijk niet elk interval toe —
pas zo nodig de schema's aan.

### Uploads (documenten/protocollen)

Het `Document`-model verwacht een URL. Voor productie: gebruik
[Vercel Blob](https://vercel.com/docs/storage/vercel-blob) om bestanden te
uploaden en sla de resulterende URL op via Backend → Documenten. De
`@vercel/blob` dependency staat al klaar in `package.json`.

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
10. **Backend** (alleen admin/coördinator) → cliënten, medewerkers, documenten, protocollen, instellingen, medicatie, weekplanning. Eén wijziging = overal doorgevoerd.
11. Uitloggen rechtsonder in de zijbalk.

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

## Testen

`npm run test` draait Vitest unit tests voor de zuivere logica: datum-parsing,
dienstberekening en alle Zod-schema's (`lib/__tests__`). Daarnaast is de
volledige flow handmatig doorlopen tegen een productie-build
(`npm run build && npm run start`): inloggen (correct/incorrect), sessie- en
rolcontrole op elke route, en de create-acties van elke module (aanwezigheid,
rapportage, medicatie-check, overdracht, to-do + afronden, afspraak, en de
Backend-CRUD endpoints inclusief de 403 op een niet-toegestane rol).
