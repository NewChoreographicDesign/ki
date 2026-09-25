"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBirthDateInput } from "@/lib/format-birthdate-input";

export function InvallerRegisterForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [birthDate, setBirthDate] = React.useState("");
  const [uitzendbureau, setUitzendbureau] = React.useState("");
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/invaller-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, birthDate, uitzendbureau, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Registreren mislukt");
        return;
      }
      toast.success("Account aangemaakt, je bent ingelogd");
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
        <Label htmlFor="uitzendbureau">Uitzendbureau</Label>
        <Input
          id="uitzendbureau"
          placeholder="Bijv. ZorgFlex Uitzendbureau"
          value={uitzendbureau}
          onChange={(e) => setUitzendbureau(e.target.value)}
          required
        />
        <p className="mt-1 text-xs text-slate-500">Voor registratiecontrole door de beheerder.</p>
      </div>
      <div>
        <Label htmlFor="code">Registratiecode</Label>
        <Input
          id="code"
          autoComplete="off"
          placeholder="Van de beheerder of je uitzendbureau"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
        />
      </div>
      <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
        Account aanmaken en starten
      </Button>
    </form>
  );
}
