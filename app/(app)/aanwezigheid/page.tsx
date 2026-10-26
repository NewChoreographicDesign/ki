import { loadPresenceBoard } from "@/lib/presence";
import { PresenceBoard } from "./presence-board";

export const dynamic = "force-dynamic";

export default async function AanwezigheidPage() {
  const entries = await loadPresenceBoard();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Aanwezigheid</h1>
        <p className="mt-1 text-slate-400">
          Wie is er in huis? Eén gedeelde status per cliënt: een wijziging blijft staan tot iemand hem weer aanpast, en iedereen ziet hem direct.
        </p>
      </div>
      <PresenceBoard initialEntries={entries} serverNow={Date.now()} />
    </div>
  );
}
