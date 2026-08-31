import { db } from "@/lib/db";
import { SettingsManager, type SettingRow } from "./settings-manager";
import { NetworkSecurityManager } from "./network-security-manager";
import { getRequestIp } from "@/lib/ip-match";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const KNOWN_SETTINGS: Omit<SettingRow, "value">[] = [
  {
    key: "ORG_NAME",
    label: "Organisatienaam",
    description: "Wordt gebruikt in de PWA-naam.",
  },
];

export default async function InstellingenPage() {
  const [settings, headerList] = await Promise.all([db.setting.findMany(), headers()]);
  const map = new Map(settings.map((s) => [s.key, s.value]));

  const rows: SettingRow[] = KNOWN_SETTINGS.map((s) => ({ ...s, value: map.get(s.key) ?? "" }));
  const currentIp = getRequestIp(headerList);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Instellingen</h1>
        <p className="mt-1 text-slate-400">
          Eén plek voor organisatie- en beveiligingsinstellingen — wijzigingen werken direct overal door.
        </p>
      </div>
      <SettingsManager settings={rows} />
      <NetworkSecurityManager
        enabled={map.get("NETWORK_RESTRICTION_ENABLED") === "true"}
        allowedIps={map.get("NETWORK_ALLOWED_IPS") ?? ""}
        currentIp={currentIp}
      />
    </div>
  );
}
