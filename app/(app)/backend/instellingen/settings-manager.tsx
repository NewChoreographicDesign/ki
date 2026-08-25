"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SettingRow = { key: string; value: string; label: string; description: string };

export function SettingsManager({ settings }: { settings: SettingRow[] }) {
  const router = useRouter();
  const [values, setValues] = React.useState(
    Object.fromEntries(settings.map((s) => [s.key, s.value]))
  );
  const [saving, setSaving] = React.useState<string | null>(null);

  async function handleSave(key: string) {
    setSaving(key);
    try {
      const res = await fetch("/api/backend/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: values[key] }),
      });
      if (!res.ok) throw new Error();
      toast.success("Instelling opgeslagen");
      router.refresh();
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {settings.map((s) => (
        <Card key={s.key}>
          <CardHeader>
            <CardTitle className="text-base">{s.label}</CardTitle>
            <CardDescription>{s.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor={s.key}>{s.key}</Label>
              <Input
                id={s.key}
                value={values[s.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
              />
            </div>
            <Button
              variant="outline"
              disabled={saving === s.key}
              onClick={() => handleSave(s.key)}
              className="sm:w-40"
            >
              {saving === s.key ? "Opslaan..." : "Opslaan"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
