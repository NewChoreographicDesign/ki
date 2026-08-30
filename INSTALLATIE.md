# Installatiehandleiding Woongroep Admin

Deze handleiding is geschreven voor iemand **zonder technische achtergrond**.
Je hoeft geen programmeerkennis te hebben en je hoeft nergens een "terminal"
of code voor te openen — alles gaat via het klikken door websites.

Reken op ongeveer **20-30 minuten** de eerste keer. Je hebt hierna een eigen,
werkende versie van de app online staan, die je zelf kunt bijhouden.

---

## Overzicht: wat ga je doen?

1. Een gratis account aanmaken bij **Vercel** (waar de app op komt te draaien).
2. De app daar "importeren" vanuit GitHub (de code staat daar al klaar).
3. Twee gratis opslagdiensten koppelen: één voor de **database** (waar alle
   gegevens in komen) en één voor **documenten/bestanden**.
4. E-mail regelen voor rapportages en medicatie-overzichten: via een gratis
   account bij **Resend**, of — als je geen toegang hebt tot een eigen
   domein — via een gewoon **Gmail-account** dat je al hebt.
5. De app voor het eerst openen en je eigen beheerdersaccount aanmaken.
6. Klaar — vanaf nu werkt alles via de app zelf.

Je hebt hiervoor nodig: een e-mailadres en toegang tot de GitHub-repository
`NewChoreographicDesign/ki` (vraag dit na bij wie de GitHub-organisatie
beheert als je hier nog niet bij kunt).

---

## Stap 1 — Account aanmaken bij Vercel

Vercel is de dienst waar de app straks online op draait (gratis voor dit
gebruik).

1. Ga naar Vercel en klik op **Sign Up** (aanmelden).
2. Kies **Continue with GitHub** en log in met je GitHub-account. Als je nog
   geen GitHub-account hebt: maak er eerst één aan op github.com, dat kost
   niets.
3. Volg de stappen die Vercel toont (account bevestigen via e-mail, etc.).

---

## Stap 2 — De app importeren

1. Klik in Vercel op **Add New...** → **Project**.
2. Zoek in de lijst naar `NewChoreographicDesign/ki` en klik op **Import**.
   Zie je de repository niet staan? Klik dan op **Adjust GitHub App
   Permissions** en geef Vercel toegang tot die repository.
3. Vercel laat nu instellingen zien ("Configure Project"). Laat alles op de
   standaardwaarde staan.
4. Klik **nog niet** op "Deploy" — ga eerst verder met stap 3 en 4 hieronder,
   zodat de database en instellingen al klaarstaan. (Klik je toch per
   ongeluk te vroeg op Deploy? Geen probleem, dat kun je later gewoon
   opnieuw doen — zie "Problemen oplossen" onderaan.)

---

## Stap 3 — Database toevoegen (waar alle gegevens in komen)

Zonder database kan de app niets onthouden. Vercel biedt hiervoor een gratis
Postgres-database aan (via een partner genaamd Neon) die je met één klik
koppelt.

1. Ga in je project in Vercel naar het tabblad **Storage**.
2. Klik op **Create Database** en kies **Postgres** (soms getoond als
   "Neon").
3. Geef de database een naam (bijvoorbeeld `woongroep-db`) en klik op
   **Create**.
4. Klik daarna op **Connect Project** en kies je zojuist geïmporteerde
   project. Vercel zet nu automatisch de juiste technische instelling
   (`DATABASE_URL`) klaar — je hoeft zelf niets te kopiëren of te typen.

---

## Stap 4 — Bestandsopslag toevoegen (voor documenten/protocollen)

Dit zorgt ervoor dat je straks in de app met één klik documenten (PDF's,
Word-bestanden, foto's) kunt uploaden. Dit gebeurt via een aparte, gratis
dienst genaamd **Cloudinary** (niet via Vercel zelf) — je maakt hier een
account aan en kopieert drie codes over naar Vercel, in stap 6 hieronder.

1. Ga naar [cloudinary.com](https://cloudinary.com) en maak een gratis
   account aan ("Sign up for free").
2. Bevestig je e-mailadres via de mail die je ontvangt.
3. Op het dashboard (de eerste pagina na inloggen) zie je een blok met
   **"Product Environment Credentials"** of vergelijkbaar, met drie
   waarden: **Cloud name**, **API Key** en **API Secret**. Klik bij "API
   Secret" op het oogicoontje om deze zichtbaar te maken.
4. Bewaar deze drie waarden tijdelijk (bijvoorbeeld in een kladblok) — je
   vult ze zo dadelijk in bij stap 6.

> Sla je deze stap over? Dan werkt de rest van de app gewoon, alleen het
> uploaden van documenten nog niet. Je kunt dit later altijd alsnog doen.

---

## Stap 5 — E-mail regelen (Resend óf Gmail)

De app verstuurt automatisch e-mails: rapportages, maandelijkse
medicatie-overzichten en herinneringen voor afspraken. Kies **één** van de
twee opties hieronder — je hebt er maar één nodig.

### Optie A — Resend (aan te raden als je een eigen domein hebt)

Resend is gratis tot 3.000 e-mails per maand — ruim voldoende.

1. Ga naar resend.com en maak een gratis account aan.
2. Bevestig je e-mailadres via de mail die je ontvangt.
3. Ga naar **API Keys** in het menu van Resend, klik op **Create API Key**,
   geef hem een naam (bijvoorbeeld "Woongroep Admin") en klik op **Add**.
4. Er verschijnt eenmalig een lange code die begint met `re_`. Kopieer deze
   direct (hij wordt daarna niet meer getoond) en bewaar hem tijdelijk, want
   die heb je in de volgende stap nodig.

> **Let op — versturen naar een eigen adres:** zonder een eigen domein mag
> Resend's gratis proefomgeving standaard alleen mailen naar het adres
> waarmee je bij Resend bent ingelogd. Voor echt gebruik met meerdere
> ontvangers (het algemene adres, de coördinator) is het toevoegen van een
> eigen domein bij Resend (**Domains** → **Add Domain**, met hulp van
> wie je website/domein beheert) noodzakelijk. Heb je geen toegang tot
> DNS-instellingen van een domein (bijvoorbeeld omdat dit bij een
> organisatie ligt waar je zelf niet bij kunt)? Gebruik dan Optie B
> hieronder — daar heb je geen domein voor nodig.

### Optie B — Gmail (geen eigen domein nodig)

Heb je geen toegang tot DNS-instellingen van een domein? Dan kun je e-mails
laten versturen via een gewoon Gmail-account (van jezelf of speciaal voor de
app aangemaakt). Dit werkt volledig zelfstandig — je hebt hier geen
beheerder of IT-afdeling voor nodig.

1. Zorg dat het Gmail-account **2-staps-verificatie** aan heeft staan: ga naar
   [myaccount.google.com/security](https://myaccount.google.com/security) en
   zet die aan als dat nog niet zo is (nodig via je telefoon).
2. Ga daarna naar
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Geef een naam op (bijvoorbeeld "Woongroep Admin") en klik op **Aanmaken**.
4. Er verschijnt een code van 16 tekens (bijv. `abcd efgh ijkl mnop`). Kopieer
   deze — zonder spaties — en bewaar hem tijdelijk, want die heb je in de
   volgende stap nodig. Dit is **niet** het gewone Gmail-wachtwoord.

> Met deze methode worden e-mails verstuurd namens dat Gmail-adres (de
> ontvanger ziet dit adres als afzender, tenzij je hieronder bij `EMAIL_FROM`
> iets anders instelt). Gmail staat maximaal 500 verzonden e-mails per dag
> toe — voor deze app ruim voldoende.

---

## Stap 6 — De overige instellingen invullen

Terug in je Vercel-project, ga naar het tabblad **Settings** →
**Environment Variables**. Hier voeg je een paar losse instellingen toe.
Voor elke regel: vul de **Name** (naam) en **Value** (waarde) in en klik op
**Save**.

| Naam | Waarde | Uitleg |
|---|---|---|
| `JWT_SECRET` | een lange, willekeurige tekst van minstens 40 tekens | Zie hieronder hoe je dit maakt |
| `CRON_SECRET` | ook een lange, willekeurige tekst | Beveiligt de automatische maandelijkse e-mails |

Vul daarnaast **óf** de Resend-rij, **óf** de vier Gmail/SMTP-rijen in, al
naar gelang welke optie je in stap 5 hebt gekozen:

**Bij Optie A (Resend):**

| Naam | Waarde | Uitleg |
|---|---|---|
| `RESEND_API_KEY` | de code die begint met `re_` uit stap 5 | Voor het versturen van e-mail |
| `EMAIL_FROM` | bijv. `Woongroep Admin <onboarding@resend.dev>` | Het afzenderadres; met een eigen Resend-domein wordt dit je eigen adres |

**Bij Optie B (Gmail):**

| Naam | Waarde | Uitleg |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | Vast adres van Gmail's verstuurserver |
| `SMTP_PORT` | `465` | Vaste poort |
| `SMTP_USER` | je volledige Gmail-adres | Het account waarmee verstuurd wordt |
| `SMTP_PASSWORD` | de 16-tekens app-wachtwoord uit stap 5 (zonder spaties) | **Niet** je gewone Gmail-wachtwoord |
| `EMAIL_FROM` | bijv. `Woongroep Admin <jouw-adres@gmail.com>` | Het afzenderadres; gebruik hetzelfde adres als bij `SMTP_USER` |

**Voor documenten/protocollen uploaden** (optioneel, sla stap 4 over als je
dit niet wilt): de drie waarden die je in stap 4 bij Cloudinary hebt
bewaard.

| Naam | Waarde | Uitleg |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | "Cloud name" uit stap 4 | Identificeert je Cloudinary-account |
| `CLOUDINARY_API_KEY` | "API Key" uit stap 4 | Voor het versturen van bestanden |
| `CLOUDINARY_API_SECRET` | "API Secret" uit stap 4 | Geheime sleutel, hou deze privé |

**Hoe maak je zo'n willekeurige tekst voor `JWT_SECRET` en `CRON_SECRET`?**
Deze twee moeten uniek en onvoorspelbaar zijn (het zijn digitale "sloten"
voor de app) — gebruik voor elk van de twee een andere tekst.

- Gebruik je een wachtwoordmanager (zoals die ingebouwd zit in Chrome,
  Safari of Edge, of 1Password/Bitwarden)? Klik met de rechtermuisknop in
  het tekstveld bij "Value" — meestal verschijnt dan de optie **"Genereer
  sterk wachtwoord"**. Gebruik dat.
- Geen wachtwoordmanager? Typ dan gewoon zelf, in willekeurige volgorde,
  minstens 40 hoofdletters, kleine letters en cijfers door elkaar (bijv. door
  quasi-willekeurig op je toetsenbord te typen). Je hoeft dit nooit te
  onthouden of opnieuw in te typen.
- Gebruik **nooit** de voorbeeldtekst uit dit document of uit
  `.env.example` in het echt — die is expres onveilig gemaakt en wordt door
  de app zelf geweigerd.

> **Niet nodig om zelf in te vullen:** `GENERAL_EMAIL` en
> `COORDINATOR_EMAIL` hoef je hier niet toe te voegen — die vul je zo
> dadelijk gewoon in de app zelf in, bij het allereerste opstarten.

---

## Stap 7 — Online zetten (deployen)

1. Ga naar het tabblad **Deployments**.
2. Staat er nog geen deployment, of wil je de zojuist toegevoegde
   instellingen laten meetellen? Klik rechtsboven op **Deploy** (of gebruik
   bij een bestaande deployment het menu met de drie puntjes → **Redeploy**).
3. Wacht tot de status op **Ready** springt (duurt meestal 1-3 minuten). De
   database wordt hierbij automatisch klaargezet — je hoeft niets handmatig
   te installeren.
4. Klik op de weergegeven link (iets als `ki-jouwnaam.vercel.app`) om de app
   te openen.

---

## Stap 8 — Je eigen account aanmaken (eenmalig)

Bij het openen van de app voor de allereerste keer zie je automatisch een
welkomstscherm ("Welkom bij Woongroep Admin"). Dit verschijnt **alleen**
zolang er nog geen enkel account bestaat.

1. Vul je eigen naam in.
2. Vul je geboortedatum in (DD-MM-JJJJ). Er is bewust geen wachtwoord — naam
   + geboortedatum samen zijn straks je inloggegevens.
3. Vul het **algemene e-mailadres** in (hier komen rapportages en
   medicatie-overzichten binnen) en het **e-mailadres van de coördinator**
   (voor het maandelijkse to-do overzicht). Dit kun je later altijd wijzigen
   bij **Backend → Instellingen**.
4. Klik op **Account aanmaken en starten**.

Je bent nu automatisch ingelogd als beheerder (rol "Admin") en ziet het
dashboard. Dit scherm kan daarna nooit meer opnieuw verschijnen — voeg
eventuele collega's toe via **Backend → Medewerkers**.

---

## Documenten en protocollen in de app krijgen

Dit is de eenvoudigste stap van allemaal, zodra stap 4 en 6 hierboven
(Cloudinary-account + de drie waarden invullen bij Environment Variables)
zijn gedaan:

1. Log in als admin en ga naar **Backend → Documenten** (alleen een admin
   ziet en gebruikt dit; iedereen met een account kan de documenten
   daarna wél gewoon bekijken en openen via **Documenten** in het hoofdmenu).
2. Klik bij **Bestand** op **Bestand kiezen** en selecteer het document van
   je computer (PDF, Word, Excel of een foto — tot 4 MB per bestand).
3. De **Titel** wordt automatisch overgenomen van de bestandsnaam; pas hem
   aan als je wilt.
4. Kies bij **Hoort bij** waar het document bij hoort: "Algemeen", "Nieuwe
   medewerker" (voor onboarding-documenten), of een specifieke cliënt.
5. Klik op **Uploaden** — een voortgangsbalk laat zien hoe ver de upload is.
   Klaar — het document staat direct in het bijbehorende tabblad. Verwijderen
   kan ook alleen via Backend → Documenten, door een admin.

Protocollen werken net zo, maar staan gewoon in het hoofdmenu voor iedereen
(geen Backend nodig): ga naar **Protocollen**, typ de titel en eventueel
inhoud als tekst, en/of upload een bestand — minstens één van de twee is
verplicht — en klik op **Toevoegen**.

> **Zie je de melding "Uploaden lukt niet"?** Dan zijn de drie
> `CLOUDINARY_*`-waarden uit stap 4/6 hierboven waarschijnlijk nog niet
> (goed) ingevuld, of de laatste deploy dateert van vóór het invullen.
> Controleer de waarden en doorloop stap 7 nogmaals (opnieuw deployen) en
> probeer het daarna nogmaals. Je kunt ondertussen ook gewoon
> een link naar een bestand toevoegen via **"Ik heb al een link naar een
> document"** onder de uploadknop.

---

## Wat kun je hierna doen in de app?

- **Backend** is alleen zichtbaar en toegankelijk voor een admin-account —
  medewerkers en coördinatoren zien dit onderdeel niet in het menu.
  - **Backend → Cliënten**: bewoners/cliënten toevoegen.
  - **Backend → Medewerkers**: collega's toevoegen (naam + geboortedatum +
    rol: medewerker, coördinator of admin).
  - **Backend → Documenten**: documenten uploaden en verwijderen (zie
    hierboven).
  - **Backend → Medicatie beheer**: medicatie per cliënt instellen, met
    tijden en instructies.
  - **Backend → Weekplanning**: het weekschema per cliënt instellen.
  - **Backend → Instellingen**: e-mailadressen later aanpassen.
- **Documenten** (bekijken/openen, niet uploaden) en **Protocollen**
  (toevoegen mag wel) staan in het hoofdmenu voor iedereen — zie hierboven.
- De overige menu's (Rapportage, Medicatie, Aanwezigheid, Overdracht,
  To-Do's, Agenda) gebruikt iedereen dagelijks — zie ook `README.md` voor
  een korte beschrijving van elk onderdeel.

---

## Problemen oplossen

**De "Deploy" is mislukt (rode kruis / "Failed").**
Ga naar **Deployments**, klik op de mislukte deployment en lees de laatste
regels van het logboek. Meestal betekent dit dat stap 3 (database koppelen)
nog niet is gedaan vóór het deployen — doorloop stap 3 en klik daarna
opnieuw op **Redeploy**.

**Ik zie een blanco of foutpagina bij het openen van de link.**
Wacht een minuut (de allereerste keer moet de database nog helemaal
klaargezet worden) en herlaad de pagina.

**Ik kan niet inloggen.**
Controleer of je naam exact klopt (hoofdletters maken niet uit, spaties wel)
en of de geboortedatum in het formaat DD-MM-JJJJ staat. Na 5 verkeerde
pogingen wordt een account 15 minuten vergrendeld als beveiliging tegen
misbruik — wacht in dat geval gewoon even.

**Ik ben mijn beheerderstoegang kwijt (geen enkele admin kan meer inloggen).**
Vraag iemand met technische kennis om via Vercel/de database tijdelijk een
account weer op actief te zetten — dit is de enige stap in deze hele
handleiding die (in het uiterste noodgeval) technische hulp vraagt.

**Ik krijg geen e-mails binnen.**
Gebruik je Resend (Optie A)? Controleer bij Resend (tabblad **Logs**) of de
mail daadwerkelijk is verstuurd. Zonder eigen domein bij Resend (zie stap 5)
komen mails alleen aan bij het e-mailadres waarmee jij bij Resend bent
ingelogd — dit is een beperking van het gratis proefaccount, niet van de app.
Gebruik je Gmail (Optie B)? Controleer of `SMTP_USER` en `SMTP_PASSWORD`
kloppen (het moet het 16-tekens app-wachtwoord zijn, niet je gewone
Gmail-wachtwoord) en of 2-staps-verificatie nog steeds aanstaat op dat
Google-account.

**Ik wil een eigen domeinnaam (bijv. `admin.mijnwoongroep.nl`) in plaats
van het `.vercel.app`-adres.**
Ga naar **Settings → Domains** in je Vercel-project en volg de stappen daar;
je hebt hiervoor toegang nodig tot de instellingen van je domeinnaam (vraag
dit na bij wie je domein beheert).

---

## Kort overzicht van de instellingen (voor later)

Alle onderstaande waarden vind je terug (en kun je aanpassen) via
**Vercel → jouw project → Settings → Environment Variables**:

| Naam | Waar komt dit vandaan | Verplicht? |
|---|---|---|
| `DATABASE_URL` | automatisch, via stap 3 | Ja |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | uit je Cloudinary-account, stap 4 | Voor documenten uploaden |
| `JWT_SECRET` | zelf een lange willekeurige tekst | Ja |
| `CRON_SECRET` | zelf een lange willekeurige tekst | Voor de maandelijkse e-mails |
| `RESEND_API_KEY` | uit je Resend-account, stap 5 (Optie A) | Voor e-mail (kies A of B) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | uit je Gmail-account, stap 5 (Optie B) | Voor e-mail (kies A of B) |
| `EMAIL_FROM` | zelf gekozen afzenderadres | Voor e-mail |
| `GENERAL_EMAIL` / `COORDINATOR_EMAIL` | ingevuld tijdens het eerste opstarten (stap 8), daarna aanpasbaar in de app zelf | Nee, via de app zelf |

Meer technische achtergrond (voor ontwikkelaars) staat in `README.md`.
