import { db } from "@/lib/db";
import { SettingsManager, type SettingRow } from "./settings-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const KNOWN_SETTINGS: Omit<SettingRow, "value">[] = [
  {
    key: "ORG_NAME",
    label: "Organisatienaam",
    description: "Wordt gebruikt in de PWA-naam.",
  },
];

export default async function InstellingenPage() {
  const settings = await db.setting.findMany();
  const map = new Map(settings.map((s) => [s.key, s.value]));

  const rows: SettingRow[] = KNOWN_SETTINGS.map((s) => ({ ...s, value: map.get(s.key) ?? "" }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Instellingen</h1>
        <p className="mt-1 text-slate-400">
          Eén plek voor organisatie-instellingen — wijzigingen werken direct overal door.
        </p>
      </div>
      <SettingsManager settings={rows} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apparaatbeveiliging</CardTitle>
          <CardDescription>
            Beperk toegang tot vrijgegeven apparaten (bv. de kantoor-iPads), onafhankelijk van
            wisselende IP-adressen.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-400">
          Dit staat bewust <strong>niet</strong> hier in de instellingen, maar via de
          environment variables <code className="rounded bg-surface2 px-1.5 py-0.5">DEVICE_RESTRICTION_ENABLED</code>{" "}
          en <code className="rounded bg-surface2 px-1.5 py-0.5">DEVICE_PASSCODE</code> in
          Vercel — zie README.md/INSTALLATIE.md. Een aan/uit-schakelaar die de hele app kan
          blokkeren, inclusief de pagina waarmee je hem weer uitzet, is precies hoe de vorige
          (IP-gebaseerde) versie tot een lockout leidde. Via een environment variable kun je
          altijd via het Vercel-dashboard herstellen, ook als de app zelf niet meer bereikbaar is.
        </CardContent>
      </Card>
    </div>
  );
}
