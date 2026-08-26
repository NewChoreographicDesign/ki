"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatBirthDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join("-");
}

export function SetupForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [birthDate, setBirthDate] = React.useState("");
  const [generalEmail, setGeneralEmail] = React.useState("");
  const [coordinatorEmail, setCoordinatorEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, birthDate, generalEmail, coordinatorEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Instellen mislukt");
        return;
      }
      toast.success("Klaar! Je bent ingelogd als beheerder.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan, probeer opnieuw");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <Label htmlFor="name">Jouw naam</Label>
        <Input
          id="name"
          placeholder="Bijv. Anna Jansen"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Hiermee log je straks in — samen met je geboortedatum, geen wachtwoord nodig.
        </p>
      </div>
      <div>
        <Label htmlFor="birthDate">Jouw geboortedatum</Label>
        <Input
          id="birthDate"
          inputMode="numeric"
          placeholder="DD-MM-JJJJ"
          value={birthDate}
          onChange={(e) => setBirthDate(formatBirthDateInput(e.target.value))}
          maxLength={10}
          required
        />
      </div>
      <div>
        <Label htmlFor="generalEmail">Algemeen e-mailadres</Label>
        <Input
          id="generalEmail"
          type="email"
          placeholder="zorg@voorbeeld.nl"
          value={generalEmail}
          onChange={(e) => setGeneralEmail(e.target.value)}
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Hier komen rapportages en medicatie-overzichten binnen.
        </p>
      </div>
      <div>
        <Label htmlFor="coordinatorEmail">E-mailadres coördinator</Label>
        <Input
          id="coordinatorEmail"
          type="email"
          placeholder="coordinator@voorbeeld.nl"
          value={coordinatorEmail}
          onChange={(e) => setCoordinatorEmail(e.target.value)}
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Hier komt het maandelijkse to-do overzicht binnen. Je kunt beide adressen later altijd
          wijzigen bij Backend → Instellingen.
        </p>
      </div>
      <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
        {loading ? "Bezig..." : "Account aanmaken en starten"}
      </Button>
    </form>
  );
}
