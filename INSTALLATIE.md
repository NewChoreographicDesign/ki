# Installatiehandleiding Woongroep Admin

Deze handleiding is geschreven voor iemand **zonder technische achtergrond**.
Je hoeft geen programmeerkennis te hebben en je hoeft nergens een "terminal"
of code voor te openen — alles gaat via het klikken door websites.

Reken op ongeveer **15-20 minuten** de eerste keer. Je hebt hierna een eigen,
werkende versie van de app online staan, die je zelf kunt bijhouden.

---

## Overzicht: wat ga je doen?

1. Een gratis account aanmaken bij **Vercel** (waar de app op komt te draaien).
2. De app daar "importeren" vanuit GitHub (de code staat daar al klaar).
3. Twee gratis opslagdiensten koppelen: één voor de **database** (waar alle
   gegevens in komen) en één voor **documenten/bestanden**.
4. De app voor het eerst openen en je eigen beheerdersaccount aanmaken.
5. Klaar — vanaf nu werkt alles via de app zelf.

Je hebt hiervoor nodig: een e-mailadres en toegang tot de GitHub-repository
`NewChoreographicDesign/ki` (vraag dit na bij wie de GitHub-organisatie
beheert als je hier nog niet bij kunt).

> De app verstuurt geen e-mails meer (dat stuurde vroeger cliëntgegevens naar
> een externe e-maildienst zonder duidelijke juridische grondslag daarvoor).
> Rapportages, medicatie- en to-do-overzichten haal je nu zelf op in de app
> zelf, via **Weekrapport** — zie "Wat kun je hierna doen in de app?" hieronder.

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
4. Klik **nog niet** op "Deploy" — ga eerst verder met stap 3 hieronder,
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
account aan en kopieert één code over naar Vercel, in stap 5 hieronder.

1. Ga naar [cloudinary.com](https://cloudinary.com) en maak een gratis
   account aan ("Sign up for free").
2. Bevestig je e-mailadres via de mail die je ontvangt.
3. Op het dashboard (de eerste pagina na inloggen) zie je een blok met
   **"API Environment variable"** of **"Product Environment Credentials"**,
   met daarin een regel die begint met `CLOUDINARY_URL=cloudinary://...`.
   Klik op het kopieer-icoontje om de hele regel te kopiëren (of, als je
   liever losse velden ziet: **Cloud name**, **API Key** en **API Secret**
   apart, met een oogicoontje om "API Secret" zichtbaar te maken).
4. Bewaar dit tijdelijk (bijvoorbeeld in een kladblok) — je vult het zo
   dadelijk in bij stap 5.

> Sla je deze stap over? Dan werkt de rest van de app gewoon, alleen het
> uploaden van documenten nog niet. Je kunt dit later altijd alsnog doen.

---

## Stap 5 — De overige instellingen invullen

Terug in je Vercel-project, ga naar het tabblad **Settings** →
**Environment Variables**. Hier voeg je een paar losse instellingen toe.
Voor elke regel: vul de **Name** (naam) en **Value** (waarde) in en klik op
**Save**.

| Naam | Waarde | Uitleg |
|---|---|---|
| `JWT_SECRET` | een lange, willekeurige tekst van minstens 40 tekens | Zie hieronder hoe je dit maakt |
| `CRON_SECRET` | ook een lange, willekeurige tekst | Beveiligt het automatische opschoon-taakje dat 1x per maand draait |

**Voor documenten/protocollen uploaden** (optioneel, sla stap 4 over als je
dit niet wilt): wat je in stap 4 bij Cloudinary hebt bewaard. Heb je de hele
`CLOUDINARY_URL=cloudinary://...`-regel gekopieerd? Vul dan **alleen** deze
ene rij in — plak de hele waarde (inclusief `cloudinary://` maar zonder het
stuk `CLOUDINARY_URL=` ervoor) bij "Value":

| Naam | Waarde | Uitleg |
|---|---|---|
| `CLOUDINARY_URL` | de gekopieerde regel, bijv. `cloudinary://123456789:AbCdEf@jouwcloud` | Alle Cloudinary-gegevens in één keer |

Heb je in plaats daarvan de losse velden (Cloud name/API Key/API Secret)
bewaard? Vul dan **in plaats van** de rij hierboven deze drie rijen in:

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

> **Optioneel — alleen als je later "Netwerkbeveiliging" gaat gebruiken**
> (de app dan alleen laten werken op het netwerk van je organisatie, zie
> "Wat kun je hierna doen in de app?" hieronder): voeg dan nu alvast een
> derde regel toe, `NETWORK_BYPASS_SECRET`, met weer een eigen lange
> willekeurige tekst (zelfde methode als hierboven). Dit is je "noodsleutel"
> mocht je jezelf ooit per ongeluk buitensluiten — bewaar hem ergens veilig
> (een wachtwoordmanager). Gebruik je die functie nooit? Dan kun je deze
> regel gewoon overslaan.

---

## Stap 6 — Online zetten (deployen)

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

## Stap 7 — Je eigen account aanmaken (eenmalig)

Bij het openen van de app voor de allereerste keer zie je automatisch een
welkomstscherm ("Welkom bij Woongroep Admin"). Dit verschijnt **alleen**
zolang er nog geen enkel account bestaat.

1. Vul je eigen naam in.
2. Vul je geboortedatum in (DD-MM-JJJJ). Er is bewust geen wachtwoord — naam
   + geboortedatum samen zijn straks je inloggegevens.
3. Klik op **Account aanmaken en starten**.

Je bent nu automatisch ingelogd als beheerder (rol "Admin") en ziet het
dashboard. Dit scherm kan daarna nooit meer opnieuw verschijnen — voeg
eventuele collega's toe via **Backend → Medewerkers**.

---

## Documenten en protocollen in de app krijgen

Dit is de eenvoudigste stap van allemaal, zodra stap 4 en 5 hierboven
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
> `CLOUDINARY_*`-waarden uit stap 4/5 hierboven waarschijnlijk nog niet
> (goed) ingevuld, of de laatste deploy dateert van vóór het invullen.
> Controleer de waarden en doorloop stap 6 nogmaals (opnieuw deployen) en
> probeer het daarna nogmaals. Je kunt ondertussen ook gewoon
> een link naar een bestand toevoegen via **"Ik heb al een link naar een
> document"** onder de uploadknop.

---

## Wat kun je hierna doen in de app?

- **Backend** is alleen zichtbaar en toegankelijk voor een admin-account —
  medewerkers en coördinatoren zien dit onderdeel niet in het menu.
  - **Backend → Cliënten**: bewoners/cliënten toevoegen (incl. optioneel een
    kamernummer, dat op het dashboard gebruikt wordt).
  - **Backend → Medewerkers**: collega's toevoegen (naam + geboortedatum +
    rol: medewerker, coördinator of admin).
  - **Backend → Documenten**: documenten uploaden en verwijderen (zie
    hierboven).
  - **Backend → Medicatie beheer**: medicatie per cliënt instellen, met
    tijden en instructies.
  - **Backend → Weekplanning**: het weekschema per cliënt instellen.
  - **Backend → Instellingen**: organisatienaam en
    **Netwerkbeveiliging** — optioneel de app beperken tot het netwerk van
    je organisatie (op IP-adres). Lees de waarschuwing op die pagina eerst
    goed door: verkeerd ingesteld kan dit iedereen (ook een admin) buitensluiten.
  - **Backend → Auditlog**: overzicht van wie wat heeft gedaan (inloggen,
    cliënten/accounts aanmaken of wijzigen, documenten verwijderen,
    instellingen wijzigen).
- **Weekrapport** (zichtbaar voor admin en coördinator): rapportages,
  afgevinkte medicatie, to-do's en afspraken van de huidige week (vanaf
  afgelopen maandag), met een downloadknop. Dit verving de automatische
  e-mails die de app vroeger verstuurde.
- **Documenten** (bekijken/openen, niet uploaden) en **Protocollen**
  (toevoegen mag wel) staan in het hoofdmenu voor iedereen — zie hierboven.
- De overige menu's (Rapportage, Medicatie, Aanwezigheid, Overdracht,
  To-Do's, Agenda) gebruikt iedereen dagelijks — zie ook `README.md` voor
  een korte beschrijving van elk onderdeel.
- Wie een tijdje niets doet op een gedeeld toestel (bijv. een iPad die
  meerdere collega's gebruiken) wordt na 15 minuten automatisch uitgelogd.

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

**Niemand kan meer bij de app (pagina zegt "Geen toegang vanaf dit netwerk").**
Je hebt "Netwerkbeveiliging" aangezet (Backend → Instellingen) en het huidige
netwerk komt niet (meer) overeen met de ingestelde IP-adressen. Heb je bij
stap 5 een `NETWORK_BYPASS_SECRET` ingesteld? Ga dan vanaf een willekeurig
netwerk naar `https://jouw-app-url/login?bypass=<die geheime tekst>` om
tijdelijk weer binnen te komen, en zet de instelling daarna uit of goed bij
Backend → Instellingen. Geen `NETWORK_BYPASS_SECRET` ingesteld? Vraag dan
iemand met technische kennis om de instelling in de database uit te zetten —
zelfde uitzonderingsgeval als hierboven bij "beheerderstoegang kwijt".

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
| `CLOUDINARY_URL` (of los: `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`) | uit je Cloudinary-account, stap 4 | Voor documenten uploaden |
| `JWT_SECRET` | zelf een lange willekeurige tekst | Ja |
| `CRON_SECRET` | zelf een lange willekeurige tekst | Voor het maandelijkse opschoon-taakje |
| `NETWORK_BYPASS_SECRET` | zelf een lange willekeurige tekst | Alleen als je Netwerkbeveiliging gebruikt |

Meer technische achtergrond (voor ontwikkelaars) staat in `README.md`.
