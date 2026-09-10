"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBirthDateInput } from "@/lib/format-birthdate-input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = React.useState("");
  const [birthDate, setBirthDate] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, birthDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Inloggen mislukt");
        return;
      }
      toast.success(`Welkom, dienst gestart (${data.shift === "MORNING" ? "ochtend" : "avond"})`);
      const next = searchParams.get("next") || "/dashboard";
      router.push(next);
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
        <Label htmlFor="name">Naam</Label>
        <Input
          id="name"
          autoComplete="name"
          placeholder="Bijv. Anna Jansen"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="birthDate">Geboortedatum</Label>
        <Input
          id="birthDate"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          placeholder="DD-MM-JJJJ"
          value={birthDate}
          onChange={(e) => setBirthDate(formatBirthDateInput(e.target.value))}
          maxLength={10}
          required
        />
      </div>
      <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
        Inloggen
      </Button>
    </form>
  );
}
