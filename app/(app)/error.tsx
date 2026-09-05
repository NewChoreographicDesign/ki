"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-surface p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-400">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div>
        <h1 className="text-lg font-semibold text-slate-50">Er is iets misgegaan</h1>
        <p className="mt-1 max-w-sm text-sm text-slate-400">
          Deze pagina kon niet worden geladen. Probeer het opnieuw — als het blijft gebeuren, meld
          dit bij de beheerder.
        </p>
      </div>
      <Button onClick={() => reset()}>Opnieuw proberen</Button>
    </div>
  );
}
