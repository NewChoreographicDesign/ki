import { db } from "@/lib/db";
import { SettingsManager, type SettingRow } from "./settings-manager";

export const dynamic = "force-dynamic";

const KNOWN_SETTINGS: Omit<SettingRow, "value">[] = [
  {
    key: "GENERAL_EMAIL",
    label: "Algemeen e-mailadres",
    description: "Ontvangt rapportages, medicatie-overzichten en agenda-herinneringen.",
  },
  {
    key: "COORDINATOR_EMAIL",
    label: "E-mailadres coördinator",
    description: "Ontvangt het maandelijkse to-do overzicht.",
  },
  {
    key: "ORG_NAME",
    label: "Organisatienaam",
    description: "Wordt gebruikt in e-mails en PWA-naam.",
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
          Eén plek voor e-mailadressen en organisatie-instellingen — wijzigingen werken direct overal door.
        </p>
      </div>
      <SettingsManager settings={rows} />
    </div>
  );
}
